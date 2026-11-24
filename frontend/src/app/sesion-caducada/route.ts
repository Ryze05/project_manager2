import { NextResponse } from "next/server";
import { clearToken } from "@/lib/session";

/**
 * Server Components cannot delete cookies, so a rejected (expired) token ends
 * up here: the cookie is cleared and the user goes back to the login.
 */
export async function GET(request: Request) {
  await clearToken();
  return NextResponse.redirect(new URL("/login", request.url));
}
