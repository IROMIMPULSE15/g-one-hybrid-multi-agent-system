import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { MongoDBAdapter } from "@next-auth/mongodb-adapter";
import clientPromise from "@/lib/mongodb-client";
import User from "@/models/User";
import connectDB from "@/lib/mongodb";

// Verify environment variables are loaded
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  throw new Error(
    `Missing Google OAuth credentials. GOOGLE_CLIENT_ID: ${!!process.env.GOOGLE_CLIENT_ID}, GOOGLE_CLIENT_SECRET: ${!!process.env.GOOGLE_CLIENT_SECRET}`
  );
}

const handler = NextAuth({
  adapter: MongoDBAdapter(clientPromise),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials");
        }

        try {
          await connectDB();

          const user = await User.findOne({ email: credentials.email });

          if (!user) {
            throw new Error("No user found");
          }

          const isPasswordValid = await user.comparePassword(credentials.password);

          if (!isPasswordValid) {
            throw new Error("Invalid password");
          }

          return {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            image: user.image,
            plan: user.plan || "Free",
            chatsUsed: user.chatsUsed || 0,
            chatsLimit: user.plan === "Pro" ? 10000 : user.plan === "Enterprise" ? 50000 : 200,
          };
        } catch (error) {
          throw new Error("Authentication failed");
        }
      },
    }),
  ],
  pages: {
    signIn: "/auth/login",
    error: "/auth/login",
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.plan = user.plan;
        token.chatsUsed = user.chatsUsed;
        token.chatsLimit = user.chatsLimit;
      }
      if (account?.provider === "google") {
        token.provider = "google";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.plan = token.plan as string;
        session.user.chatsUsed = token.chatsUsed as number;
        session.user.chatsLimit = token.chatsLimit as number;
      }
      return session;
    },
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        try {
          await connectDB();

          let dbUser = await User.findOne({ email: user.email });

          if (!dbUser) {
            // Create new user from Google profile
            console.log(`✅ Creating new Google user: ${user.email}`);
            dbUser = await User.create({
              email: user.email,
              name: user.name || profile?.name || "Google User",
              image: user.image || profile?.image,
              plan: "Free",
              chatsUsed: 0,
              chatsLimit: 200,
              googleId: user.id,
              password: Math.random().toString(36).slice(-20), // Random password for Google users
              isActive: true,
              lastLogin: new Date(),
            });
            console.log(`✅ Google user created successfully`);
          } else {
            // Update existing user with Google info if missing
            if (!dbUser.googleId) {
              console.log(`📝 Linking Google account to existing user: ${user.email}`);
              dbUser.googleId = user.id;
              dbUser.lastLogin = new Date();
              await dbUser.save();
            }
          }

          return true;
        } catch (error) {
          console.error("❌ Error in Google signIn callback:", error);
          return false;
        }
      }
      return true;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
