import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import googleProvider from 'next-auth/providers/google';
import credentialsProvider from 'next-auth/providers/credentials';
import { migrateGuestData } from '@/lib/personalizationHelpers';
import { comparePassword, sanitizeEmail } from '@/lib/authUtils';

const GoogleProviderFactory = (() => {
  const mod = googleProvider;
  return mod?.default?.default ?? mod?.default ?? mod;
})();

const CredentialsProviderFactory = (() => {
  const mod = credentialsProvider;
  return mod?.default?.default ?? mod?.default ?? mod;
})();

export const baseAuthOptions = {
  providers: [
    GoogleProviderFactory({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    CredentialsProviderFactory({
      name: 'Email and Password',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required');
        }

        try {
          await connectToDatabase();

          const sanitizedEmail = sanitizeEmail(credentials.email);

          // Find user with password field included
          const user = await User.findOne({ email: sanitizedEmail }).select('+password');

          if (!user) {
            throw new Error('No account found with this email');
          }

          // Check if user has a password (email auth)
          if (!user.password) {
            throw new Error('This account uses Google sign-in. Please use "Continue with Google"');
          }

          // Verify password
          const isValidPassword = await comparePassword(credentials.password, user.password);

          if (!isValidPassword) {
            throw new Error('Incorrect password');
          }

          // Update last login
          user.lastLogin = new Date();
          await user.save();

          // Return user object for session
          return {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            picture: user.picture,
            authProvider: user.authProvider,
          };
        } catch (error) {
          console.error('Credentials auth error:', error);
          throw error;
        }
      }
    }),
  ],
  pages: {
    signIn: '/',
  },
  callbacks: {
    async signIn({ user, account, profile, req }) {
      // Handle Google OAuth
      if (account?.provider === 'google') {
        try {
          await connectToDatabase();
          const existingUser = await User.findOne({ email: user.email });

          if (!existingUser) {
            await User.create({
              googleId: user.id,
              name: user.name,
              email: user.email,
              picture: user.picture,
              authProvider: 'google',
            });
          } else {
            // Update existing user
            const updateData = {
              googleId: user.id,
              name: user.name,
              picture: user.picture,
              lastLogin: new Date(),
            };

            // If user previously used email auth, update to 'both'
            if (existingUser.authProvider === 'email') {
              updateData.authProvider = 'both';
            }

            await User.findOneAndUpdate(
              { email: user.email },
              updateData
            );
          }

          // Migrate guest data if session ID exists
          try {
            if (req?.cookies?.sessionId) {
              const sessionId = req.cookies.sessionId;
              console.log(`Attempting to migrate guest data for session: ${sessionId}`);
              const migrationResult = await migrateGuestData(sessionId, user.email);

              if (migrationResult.success) {
                console.log(`✓ Successfully migrated ${migrationResult.interactionsMigrated} interactions and ${migrationResult.topicsUpdated} topics for ${user.email}`);
              }
            }
          } catch (migrationError) {
            console.warn('Guest data migration failed (non-critical):', migrationError.message);
          }

          return true;
        } catch (error) {
          console.error('Google sign-in error:', error);
          return false;
        }
      }

      // Handle Credentials (email/password) - already authenticated in authorize()
      if (account?.provider === 'credentials') {
        try {
          // Migrate guest data if session ID exists
          if (req?.cookies?.sessionId) {
            const sessionId = req.cookies.sessionId;
            console.log(`Attempting to migrate guest data for session: ${sessionId}`);
            const migrationResult = await migrateGuestData(sessionId, user.email);

            if (migrationResult.success) {
              console.log(`✓ Successfully migrated ${migrationResult.interactionsMigrated} interactions and ${migrationResult.topicsUpdated} topics for ${user.email}`);
            }
          }
        } catch (migrationError) {
          console.warn('Guest data migration failed (non-critical):', migrationError.message);
        }
        return true;
      }

      return true;
    },
    async session({ session }) {
      if (session?.user?.email) {
        try {
          await connectToDatabase();
          const user = await User.findOne({ email: session.user.email });
          if (user) {
            session.user.id = user._id.toString();
            session.user.googleId = user.googleId;
            session.user.picture = user.picture;
            session.user.authProvider = user.authProvider;
          }
        } catch (error) {
          console.error('Session error:', error);
        }
      }
      return session;
    },
    async jwt({ token, user, account }) {
      if (account && user) {
        token.accessToken = account.access_token;
        token.id = user.id;
        token.authProvider = user.authProvider;
      }
      return token;
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export const authOptions = baseAuthOptions;

export default async function auth(req, res) {
  const nextAuthModule = await import('next-auth/next');
  const NextAuth =
    nextAuthModule?.default?.default ??
    nextAuthModule?.default ??
    nextAuthModule;

  return NextAuth(req, res, baseAuthOptions);
}
