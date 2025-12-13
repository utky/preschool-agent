import NextAuth from "next-auth";
import type { NextAuthOptions } from "next-auth";
import Google from "next-auth/providers/google";

export const authConfig: NextAuthOptions = {
  debug: true,
  session: {
    strategy: "jwt",
    maxAge: 90 * 24 * 60 * 60,
  },
  callbacks: {
    async signIn({ user, profile, email, account}) {
      console.log("signIn callback called.");
      console.log("User object:", user);

      if (!user.email) {
        console.log("User email is missing. Denying access.");
        return false;
      }

      console.log("User email:", user.email);
      const allowedUsers = process.env.ALLOWED_USER_EMAILS;
      console.log("ALLOWED_USER_EMAILS from environment:", allowedUsers);

      if (!allowedUsers) {
        console.log("ALLOWED_USER_EMAILS environment variable is not set. Denying access.");
        return false;
      }

      const allowedUserEmails = allowedUsers.split(",").map((e) => e.trim());
      console.log("Parsed allowed user emails:", allowedUserEmails);

      const isAllowed = allowedUserEmails.includes(user.email);
      console.log(`User email "${user.email}" is ${isAllowed ? "" : "NOT "}in the allowed list. ${isAllowed ? "Granting" : "Denying"} access.`);
      return isAllowed;
    },
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID || "",
      clientSecret: process.env.AUTH_GOOGLE_SECRET || "",
    }),
  ],
};

export type Session = {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  expires: string;
}
export const handler = NextAuth(authConfig);
