import { NextRequest, NextResponse } from "next/server";

/**
 * Domain regularization: 301 any legacy host to the canonical URL (rifasmtz.web.app),
 * preserving the exact path + query string. The canonical host passes through untouched.
 *
 * When Firebase Hosting proxies to the SSR function it rewrites the `Host` header and
 * delivers the original hostname in `X-Forwarded-Host`, so BOTH headers are checked.
 */
const LEGACY_HOSTS = new Set([
  "raffleapp-dbc1b.web.app",
  "raffleapp-dbc1b.firebaseapp.com",
]);

const CANONICAL_BASE = "https://rifasmtz.web.app";

function requestHost(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-host");
  const raw = forwarded ? forwarded.split(",")[0] : request.headers.get("host") || "";
  return raw.replace(/:\d+$/, "").trim().toLowerCase();
}

export function middleware(request: NextRequest) {
  if (LEGACY_HOSTS.has(requestHost(request))) {
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
