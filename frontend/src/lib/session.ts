import "server-only";
import { cookies } from "next/headers";

/**
 * The API's JWT lives in an httpOnly cookie: client-side JavaScript can never
 * read it. Only Server Actions and Route Handlers may set or delete it.
 */
const COOKIE = "session";
/** Same lifetime as the API's JWT (24h at level 1). */
const MAX_AGE_SECONDS = 60 * 60 * 24;

export async function getToken(): Promise<string | undefined> {
  return (await cookies()).get(COOKIE)?.value;
}

export async function setToken(token: string): Promise<void> {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearToken(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
