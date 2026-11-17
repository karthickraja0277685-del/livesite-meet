import { NextRequest, NextResponse } from "next/server";
import path from "path";
import mime from "mime-types";
import { prisma } from "@/lib/prisma";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { getLocalTestSiteStore } from "@/lib/cleanup";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string; path?: string[] } }
) {
  const hostHeader = (req.headers.get("host") || "").toLowerCase();
  const sitesBaseDomain = (
    process.env.NEXT_PUBLIC_SITES_BASE_DOMAIN || "sites.localhost:3000"
  ).toLowerCase();

  // Defense-in-depth: verify the request arrived on a wildcard session subdomain,
  // never on the main app domain.
  if (!hostHeader.endsWith(`.${sitesBaseDomain}`)) {
    return new NextResponse(
      "Forbidden: Presented sites are only served from isolated wildcard subdomains.",
      { status: 403 }
    );
  }

  const sessionSubdomain = params.sessionId;
  const attendeeSession = await prisma.attendeeSession.findUnique({
    where: { sessionSubdomain },
    include: { meeting: true }
  });

  if (
    !attendeeSession ||
    attendeeSession.meeting.status !== "ACTIVE" ||
    !attendeeSession.meeting.activeUploadId
  ) {
    return new NextResponse("No active site for this session.", { status: 404 });
  }

  const rawSegments = params.path && params.path.length > 0 ? params.path : ["index.html"];
  const joinedPath = rawSegments.join("/");
  const normalizedPath = path.posix.normalize(joinedPath);

  if (normalizedPath.startsWith("..") || normalizedPath.startsWith("/")) {
    return new NextResponse("Invalid file path.", { status: 400 });
  }

  const upload = await prisma.siteUpload.findUnique({
    where: { id: attendeeSession.meeting.activeUploadId }
  });

  if (!upload) {
    return new NextResponse("Uploaded site record not found.", { status: 404 });
  }

  const contentType = mime.lookup(normalizedPath) || "application/octet-stream";
  let fileBuffer: Buffer | null = null;

  const localStore = getLocalTestSiteStore().get(attendeeSession.meetingId);
  if (localStore && localStore.has(normalizedPath)) {
    fileBuffer = localStore.get(normalizedPath)!.data;
  } else if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder") &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    const supabaseAdmin = createSupabaseServiceClient();
    const { data, error } = await supabaseAdmin.storage
      .from("meeting-sites")
      .download(`${upload.storagePrefix}/extracted/${normalizedPath}`);
    if (!error && data) {
      fileBuffer = Buffer.from(await data.arrayBuffer());
    }
  }

  if (!fileBuffer) {
    return new NextResponse("File not found in uploaded site.", { status: 404 });
  }

  return new NextResponse(new Uint8Array(fileBuffer), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "no-store",
      // Allow scripts/forms inside the isolated subdomain while restricting external framing
      "Content-Security-Policy":
        "default-src 'self' 'unsafe-inline' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self';"
    }
  });
}