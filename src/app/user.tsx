import Image from 'next/image'
import { authConfig } from "@/auth";
import { getServerSession } from "next-auth/next"
import Login from "./login";

export default async function User() {
  const session = await getServerSession(authConfig)

  return (
    <div>
      {session?.user ? (
        <div>
          {/* session.user.nameも表示する */}
          <p>{session.user.name}</p>
          <p>{session.user.email}</p>
          {session.user.image && (
            <Image
              src={session.user.image}
              alt="User Image"
              width={100}
              height={100}
            />
          )}
        </div>
      ) : (
        <p>No user logged in</p>
      )}
      <Login session={session} />
    </div>
  );
}
