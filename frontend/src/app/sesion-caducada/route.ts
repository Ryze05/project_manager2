import { NextResponse } from "next/server";
import { api } from "@/lib/api";
import { clearToken, getToken } from "@/lib/session";

/**
 * Server Components cannot delete cookies, so a rejected (expired) token ends
 * up here: the cookie is cleared and the user goes back to the login.
 *
 * It is a GET, so another site could point a link or an image at it. To keep
 * that from logging anyone out, the cookie is only cleared when the API really
 * rejects the token (or there is none); a valid session just goes back in.
 */
export async function GET(request: Request) {
  if (await getToken()) {
    const me = await api("/auth/me");
    // Any answer but "unauthorized" (including the API being down) keeps the session.
    if (me.ok || me.status !== 401) {
      return NextResponse.redirect(new URL("/proyectos", request.url));
    }
  }
  await clearToken();
  return NextResponse.redirect(new URL("/login", request.url));
}
