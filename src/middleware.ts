import { NextRequest, NextResponse } from "next/server";

// Supports two isolation modes:
// 1. Wildcard mode (local `*.sites.localhost:3000` or custom domain `*.sites.yourdomain.com`)
// 2. Single-host opaque mode (`NEXT_PUBLIC_SITES_SINGLE_HOST=true` on a separate free Vercel URL
//    like `livesite-meet-sites.vercel.app`, serving `/s/{sessionSubdomain}/...` inside an opaque sandbox)

export function middleware(req: NextRequest) {
  const hostHeader = (req.headers.get("host") || "").toLowerCase();
  const sitesBaseDomain = (
    process.env.NEXT_PUBLIC_SITES_BASE_DOMAIN || "sites.localhost:3000"
  ).toLowerCase();
  const singleHostMode = process.env.NEXT_PUBLIC_SITES_SINGLE_HOST === "true";

  const isWildcardSiteHost =
    hostHeader.endsWith(`.${sitesBaseDomain}`) && hostHeader !== sitesBaseDomain;
  const isDedicatedSingleSiteHost =
    singleHostMode && hostHeader === sitesBaseDomain;

  // Never serve `/api/site-proxy` from the main app origin
  if (
    !isWildcardSiteHost &&
    !isDedicatedSingleSiteHost &&
    req.nextUrl.pathname.startsWith("/api/site-proxy")
  ) {
    return new NextResponse(
      "Forbidden: Presented sites are never served from the main app origin.",
      { status: 403 }
    );
  }

  // Mode 1: Wildcard subdomain `{sessionSubdomain}.sites.*`
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

  // Mode 2: Dedicated free sites host `{sitesBaseDomain}/s/{sessionSubdomain}/...`
  if (isDedicatedSingleSiteHost) {
    const match = req.nextUrl.pathname.match(/^\/s\/([a-z0-9-]+)(\/.*)?$/);
    if (match) {
      const sessionSubdomain = match[1];
      const restPath = !match[2] || match[2] === "/" ? "/index.html" : match[2];
      const rewriteUrl = req.nextUrl.clone();
      rewriteUrl.pathname = `/api/site-proxy/${sessionSubdomain}${restPath}`;
      return NextResponse.rewrite(rewriteUrl);
    }
    if (req.nextUrl.pathname.startsWith("/api/site-proxy")) {
      return NextResponse.next();
    }
    return new NextResponse("Sites host only serves /s/{sessionId}/...", { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
