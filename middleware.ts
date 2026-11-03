import { NextRequest, NextResponse } from "next/server";

/**
 * Domain regularization: 301 any legacy host to the canonical URL (rifasmtz.web.app),
 * preserving the exact path + query string. Runs on every site that serves this build;
 * only the legacy hosts trigger a redirect, so the canonical host passes through untouched.
 */
const LEGACY_HOSTS = new Set([
  "raffleapp-dbc1b.web.app",
  "raffleapp-dbc1b.firebaseapp.com",
]);

const CANONICAL_BASE = "https://rifasmtz.web.app";

export function middleware(request: NextRequest) {
  const host = (request.headers.get("host") || "").toLowerCase();

  if (LEGACY_HOSTS.has(host)) {
    const { pathname, search } = request.nextUrl;
    return NextResponse.redirect(`${CANONICAL_BASE}${pathname}${search}`, 301);
  }

  return NextResponse.next();
}

export const config = {
  // Redirect all routes except versioned/static assets so every entry point,
  // including deep links, lands on the canonical host.
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|css|js)).*)",
  ],
};
