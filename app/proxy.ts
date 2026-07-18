import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, authToken } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const cookie = request.cookies.get(AUTH_COOKIE)?.value;
  if (cookie === (await authToken())) {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  // Everything except the login page, tracker API (secret-header auth),
  // and static assets.
  matcher: ["/((?!login|api/tracker|_next/static|_next/image|favicon.ico).*)"],
};
