import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedHost } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { validateAndExtractZip } from "@/lib/zip-validator";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { getLocalTestSiteStore } from "@/lib/cleanup";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { meetingId: string } }
) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: params.meetingId }
  });

  if (!meeting || meeting.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "Active meeting not found." },
      { status: 404 }
    );
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

  // SECURITY: Unauthenticated / non-joined callers are strictly blocked with 403 Forbidden.
  if (!isAuthorizedHost && !joinedSession) {
    return NextResponse.json(
      { error: "Forbidden: Only joined meeting participants or the host can upload a website ZIP." },
      { status: 403 }
    );
  }

  if (!isAuthorizedHost && meeting.safeMode) {
    return NextResponse.json(
      { error: "Class Safe Mode is active. Only the host can upload files." },
      { status: 403 }
    );
  }

  const rateKey = isAuthorizedHost
    ? `upload:host:${meeting.hostId}`
    : `upload:session:${joinedSession!.id}`;
  const rate = await checkRateLimit(rateKey, 10, 60 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Upload rate limit exceeded. Try again later." },
      { status: 429 }
    );
  }

  const hasRealSupabase =
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder") &&
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  let buffer: Buffer;
  let uploadId = crypto.randomUUID();
  const contentTypeHeader = req.headers.get("content-type") || "";

  if (contentTypeHeader.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    const tempZipPath = String(body.tempZipPath || "");
    if (body.uploadId && typeof body.uploadId === "string") {
      uploadId = body.uploadId;
    }
    const expectedPrefix = `${meeting.hostId}/${meeting.id}/pending/`;
    if (!hasRealSupabase || !tempZipPath.startsWith(expectedPrefix)) {
      return NextResponse.json({ error: "Invalid pending upload path." }, { status: 400 });
    }
    const supabaseAdmin = createSupabaseServiceClient();
    const { data, error } = await supabaseAdmin.storage
      .from("meeting-sites")
      .download(tempZipPath);
    if (error || !data) {
      return NextResponse.json(
        { error: "Could not read uploaded ZIP from storage." },
        { status: 400 }
      );
    }
    buffer = Buffer.from(await data.arrayBuffer());
    await supabaseAdmin.storage.from("meeting-sites").remove([tempZipPath]);
  } else {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Missing ZIP file in form data." },
        { status: 400 }
      );
    }
    buffer = Buffer.from(await file.arrayBuffer());
  }

  const validation = validateAndExtractZip(buffer);
  if (!validation.valid || !validation.files) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const uploaderName = joinedSession
    ? joinedSession.displayName
    : isAuthorizedHost
    ? "Host"
    : "Participant";
  const storagePrefix = `${meeting.hostId}/${meeting.id}/${uploadId}`;

  if (hasRealSupabase) {
    const supabaseAdmin = createSupabaseServiceClient();
    await supabaseAdmin.storage
      .from("meeting-sites")
      .upload(`${storagePrefix}/source.zip`, buffer, {
        contentType: "application/zip",
        upsert: true
      });

    for (const extracted of validation.files) {
      await supabaseAdmin.storage
        .from("meeting-sites")
        .upload(
          `${storagePrefix}/extracted/${extracted.relativePath}`,
          extracted.data,
          {
            contentType: extracted.contentType,
            upsert: true
          }
        );
    }

    await supabaseAdmin.channel(`meeting:${meeting.id}`).send({
      type: "broadcast",
      event: "site-uploaded",
      payload: {
        uploadId,
        uploaderName,
        fileCount: validation.files.length,
        totalBytes: validation.totalBytes || 0,
        createdAt: new Date().toISOString()
      }
    });
  } else {
    const fileMap = new Map<string, { data: Buffer; contentType: string }>();
    for (const extracted of validation.files) {
      fileMap.set(extracted.relativePath, {
        data: extracted.data,
        contentType: extracted.contentType
      });
    }
    getLocalTestSiteStore().set(`${meeting.id}:${uploadId}`, fileMap);
  }

  const uploadRecord = await prisma.siteUpload.create({
    data: {
      id: uploadId,
      meetingId: meeting.id,
      hostId: meeting.hostId,
      uploaderName,
      uploaderSessionId: joinedSession?.id ?? null,
      storagePrefix,
      fileCount: validation.files.length,
      totalBytes: validation.totalBytes || 0,
      fileManifest: validation.files.map((f) => f.relativePath)
    }
  });

  if (!meeting.activeUploadId || isAuthorizedHost) {
    await prisma.meeting.update({
      where: { id: meeting.id },
      data: { activeUploadId: uploadRecord.id }
    });
  }

  return NextResponse.json({
    ok: true,
    uploadId: uploadRecord.id,
    uploaderName: uploadRecord.uploaderName,
    fileCount: uploadRecord.fileCount,
    totalBytes: uploadRecord.totalBytes,
    createdAt: uploadRecord.createdAt
  });
}
