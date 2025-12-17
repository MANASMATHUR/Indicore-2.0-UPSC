import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import googleProvider from 'next-auth/providers/google';
import { migrateGuestData } from '@/lib/personalizationHelpers';

const GoogleProviderFactory = (() => {
  const mod = googleProvider;
  return mod?.default?.default ?? mod?.default ?? mod;
})();

export const baseAuthOptions = {
  providers: [
    GoogleProviderFactory({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  pages: {
    signIn: '/',
  },
  callbacks: {
    async signIn({ user, account, profile, req }) {
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
            });
          } else {
            await User.findOneAndUpdate(
              { email: user.email },
              {
                googleId: user.id,
                name: user.name,
                picture: user.picture,
                lastLogin: new Date(),
              }
            );
          }

          // Migrate guest data if session ID exists
          // Note: req might not be available in all NextAuth contexts
          // This is a best-effort migration
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
            // Don't fail sign-in if migration fails
          }

          return true;
        } catch (error) {
          console.error('Sign-in error:', error);
          return false;
        }
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
          }
        } catch (error) {
        }
      }
      return session;
    },
    async jwt({ token, user, account }) {
      if (account && user) {
        token.accessToken = account.access_token;
        token.id = user.id;
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

