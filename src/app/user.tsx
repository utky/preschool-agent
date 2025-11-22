'use client'
import { SessionProvider } from "next-auth/react"
import Login from "./login";

export default function User() {
  return (
    <SessionProvider>
      <Login></Login>
    </SessionProvider>
  );
}
