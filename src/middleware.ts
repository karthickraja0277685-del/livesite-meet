import { NextRequest, NextResponse } from "next/server";

// Concept: Wildcard Subdomain Isolation
// Every attendee loads the presented website from `{sessionSubdomain}.sites.example.com`
// (or `{sessionSubdomain}.sites.localhost:3000` in local dev).
// Because browsers isolate cookies, localStorage, IndexedDB, and DOM access by origin
// (scheme + hostname + port), two attendees on different subdomains can never read
// or overwrite each other's state—and neither can touch the main app origin!

export function middleware(req: NextRequest) {
  const hostHeader = (req.headers.get("host") || "").toLowerCase();
  const sitesBaseDomain = (
    process.env.NEXT_PUBLIC_SITES_BASE_DOMAIN || "sites.localhost:3000"
  ).toLowerCase();

  // Block direct access to `/api/site-proxy` from the main app domain so presented
  // sites are NEVER served from the main application's origin.
  const isWildcardSiteHost =
    hostHeader.endsWith(`.${sitesBaseDomain}`) && hostHeader !== sitesBaseDomain;

  if (!isWildcardSiteHost && req.nextUrl.pathname.startsWith("/api/site-proxy")) {
    return new NextResponse(
      "Forbidden: Presented sites are never served from the main app origin.",
      { status: 403 }
    );
  }

  // If the request arrives on `{sessionSubdomain}.sites.example.com/path`,
  // internally rewrite it to `/api/site-proxy/{sessionSubdomain}/path`.
  if (isWildcardSiteHost) {
    const sessionSubdomain = hostHeader.slice(0, -(sitesBaseDomain.length + 1));
    if (!/^[a-z0-9-]+$/.test(sessionSubdomain)) {
      return new NextResponse("Invalid session subdomain", { status: 400 });
    }

    const pathname = req.nextUrl.pathname === "/" ? "/index.html" : req.nextUrl.pathname;
    const rewriteUrl = req.nextUrl.clone();
    rewriteUrl.pathname = `/api/site-proxy/${sessionSubdomain}${pathname}`;
    return NextResponse.rewrite(rewriteUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};