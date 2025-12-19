import Image from 'next/image'
import { authConfig } from "@/auth";
import { getServerSession } from "next-auth/next"
import Login from "./login";

export default async function User({buttonClassName, spanClassName}: {buttonClassName: string; spanClassName: string}) {
  const session = await getServerSession(authConfig)

  return (
    <>
      {session?.user ? (
        <button className={buttonClassName}>
          {session.user.image && (
            <Image
              src={session.user.image}
              alt="User settings"
              width={9}
              height={9}
            />
          )}
          <span className={spanClassName}>{session.user.name}</span>
        </button>
      ) : (
        <p>No user logged in</p>
      )}
      <Login session={session} />
    </>
  );
}
