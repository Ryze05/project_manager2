import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_PAGES = ["/login", "/registro"];

/**
 * Optimistic check only: it looks at whether the session cookie exists, not
 * whether the token is valid (an expired one is rejected by the API).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has("session");
  const isAuthPage = AUTH_PAGES.includes(pathname);

  if (!hasSession && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (hasSession && isAuthPage) {
    return NextResponse.redirect(new URL("/proyectos", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|componentes).*)"],
};
