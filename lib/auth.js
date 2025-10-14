import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import  connectToDatabase from './mongodb';
import User from '@/models/User';

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      }
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account.provider === 'google') {
        try {
          await connectToDatabase();
          
          // Check if user exists
          const existingUser = await User.findOne({ email: user.email });
          
          if (!existingUser) {
            // Create new user
            await User.create({
              googleId: user.id,
              name: user.name,
              email: user.email,
              picture: user.picture,
            });
          } else {
            // Update existing user info
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
          console.error('Error in signIn callback:', error);
          return false;
        }
      }
      return true;
    },
    async session({ session, token }) {
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
          console.error('Error in session callback:', error);
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
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
  trustHost: true,
};

export default NextAuth(authOptions);
