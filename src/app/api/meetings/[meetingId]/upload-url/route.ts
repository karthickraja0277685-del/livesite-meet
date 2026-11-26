import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedHost } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { getPlanConfig } from "@/lib/plans";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { meetingId: string } }
) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: params.meetingId },
    include: { host: { select: { plan: true } } }
  });

  if (!meeting || meeting.status !== "ACTIVE") {
    return NextResponse.json({ error: "Active meeting not found." }, { status: 404 });
  }

  const authUser = await getAuthenticatedHost(req);
  const hostCookie = req.cookies.get(`livesite_host_${meeting.id}`)?.value;
  const isAuthorizedHost =
    (authUser && authUser.id === meeting.hostId) ||
    hostCookie === meeting.hostId;

  const sessionCookieId = req.cookies.get(`livesite_session_${meeting.id}`)?.value;
  const joinedSession = sessionCookieId
    ? await prisma.attendeeSession.findFirst({
        where: { id: sessionCookieId, meetingId: meeting.id, isBanned: false }
      })
    : null;

  if (!isAuthorizedHost && !joinedSession) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isAuthorizedHost && meeting.safeMode) {
    return NextResponse.json(
      { error: "Class Safe Mode is active. Only the host can upload files." },
      { status: 403 }
    );
  }

  const planConfig = getPlanConfig(meeting.host.plan);
  const maxBytes = planConfig.maxZipMb * 1024 * 1024;

  const body = await req.json().catch(() => ({}));
  const fileSize = Number(body.fileSize || 0);
  const fileType = body.fileType === "pdf" ? "pdf" : "zip";

  if (fileSize > maxBytes) {
    return NextResponse.json(
      {
        error: `File exceeds the ${planConfig.name} plan limit of ${planConfig.maxZipMb} MB.`
      },
      { status: 400 }
    );
  }

  const hasRealSupabase =
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder") &&
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!hasRealSupabase) {
    return NextResponse.json({ mode: "direct" });
  }

  const uploadId = crypto.randomUUID();
  const ext = fileType === "pdf" ? "pdf" : "zip";
  const tempPath =
    fileType === "pdf"
      ? `${meeting.hostId}/${meeting.id}/slides/${uploadId}.pdf`
      : `${meeting.hostId}/${meeting.id}/pending/${uploadId}.zip`;

  const supabaseAdmin = createSupabaseServiceClient();
  const { data, error } = await supabaseAdmin.storage
    .from("meeting-sites")
    .createSignedUploadUrl(tempPath);

  if (error || !data) {
    return NextResponse.json({ mode: "direct" });
  }

  return NextResponse.json({
    mode: "signed",
    uploadId,
    tempZipPath: tempPath,
    tempPath,
    signedUrl: data.signedUrl,
    token: data.token,
    ext
  });
}
