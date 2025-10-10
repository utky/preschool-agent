import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.AUTH_SECRET });

  // トークンがない、かつ保護対象のページにアクセスしようとしている場合、ログインページにリダイレクト
  if (!token) {
    // ここでは、ホームページ以外を保護対象と仮定します。
    // `/` へのアクセスは許可します。
    if (req.nextUrl.pathname !== "/") {
       // ログインページのURLを環境変数などから取得するか、固定で指定します。
       // ここでは仮に /api/auth/signin とします。
      const signInUrl = new URL("/api/auth/signin", req.nextUrl.origin);
      signInUrl.searchParams.set("callbackUrl", req.nextUrl.href);
      return NextResponse.redirect(signInUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/health|_next/static|_next/image|favicon.ico).*)"],
};