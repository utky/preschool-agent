// auth.ts
import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  ],
  secret: process.env.AUTH_SECRET,
  callbacks: {
    /**
     * ユーザーがサインインを試みたときに実行されるコールバック。
     * メールアドレスが許可リストに含まれているかを確認する。
     * @returns {boolean} サインインを許可する場合は true, 拒否する場合は false
     */
    async signIn({ user, account, profile }) {
      if (!profile?.email) {
        console.error("No email found in profile");
        return false; // メールアドレスがなければ拒否
      }

      const allowedEmails = (process.env.ALLOWED_USER_EMAILS || "").split(",");
      if (allowedEmails.includes(profile.email)) {
        return true; // 許可リストにあればサインインを許可
      } else {
        console.warn(`Unauthorized access attempt by ${profile.email}`);
        return false; // 許可リストになければ拒否
      }
    },
    async session({ session, token }) {
      // 必要に応じてセッション情報を拡張
      return session
    },
  },
})
