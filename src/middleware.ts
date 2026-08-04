import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();

  // Protect dashboard route from unauthorized direct URL access
  if (url.pathname.includes("/dashboard")) {
    const session = request.cookies.get("spil_admin_session");
    if (!session || session.value !== "authenticated") {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "/app/ijin-kerja";
      const loginUrl = new URL(basePath, request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
