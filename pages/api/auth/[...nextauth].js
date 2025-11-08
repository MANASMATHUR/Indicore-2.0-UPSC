import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import googleProvider from 'next-auth/providers/google';

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
    async signIn({ user, account }) {
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
          return true;
        } catch (error) {
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

