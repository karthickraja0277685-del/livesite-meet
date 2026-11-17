import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedHost } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { validateAndExtractZip } from "@/lib/zip-validator";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { deleteMeetingFiles, getLocalTestSiteStore } from "@/lib/cleanup";

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

  // SECURITY: Strictly verify that ONLY the meeting's host can upload a site ZIP.
  if (!isAuthorizedHost) {
    return NextResponse.json(
      { error: "Forbidden: Only the meeting host can upload a website ZIP." },
      { status: 403 }
    );
  }

  const rate = checkRateLimit(`upload:${meeting.hostId}`, 10, 60 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Upload rate limit exceeded. Try again later." },
      { status: 429 }
    );
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing ZIP file in form data." },
      { status: 400 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const validation = validateAndExtractZip(buffer);
  if (!validation.valid || !validation.files) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  // Delete any previous site upload for this meeting before storing the new one
  await deleteMeetingFiles(meeting.id);

  const storagePrefix = `${meeting.hostId}/${meeting.id}/${Date.now()}`;
  const hasRealSupabase =
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder") &&
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (hasRealSupabase) {
    const supabaseAdmin = createSupabaseServiceClient();
    // Upload raw ZIP to private bucket
    await supabaseAdmin.storage
      .from("meeting-sites")
      .upload(`${storagePrefix}/source.zip`, buffer, {
        contentType: "application/zip",
        upsert: true
      });

    // Upload each validated static file
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

    // Broadcast to attendees in real time that the new site is ready
    await supabaseAdmin.channel(`meeting:${meeting.id}`).send({
      type: "broadcast",
      event: "site-uploaded",
      payload: { uploadedAt: Date.now() }
    });
  } else {
    // Store in local server memory for offline Docker / Playwright E2E runs
    const fileMap = new Map<string, { data: Buffer; contentType: string }>();
    for (const extracted of validation.files) {
      fileMap.set(extracted.relativePath, {
        data: extracted.data,
        contentType: extracted.contentType
      });
    }
    getLocalTestSiteStore().set(meeting.id, fileMap);
  }

  const uploadRecord = await prisma.siteUpload.create({
    data: {
      meetingId: meeting.id,
      hostId: meeting.hostId,
      storagePrefix,
      fileCount: validation.files.length,
      totalBytes: validation.totalBytes || 0,
      fileManifest: validation.files.map((f) => f.relativePath)
    }
  });

  await prisma.meeting.update({
    where: { id: meeting.id },
    data: { activeUploadId: uploadRecord.id }
  });

  return NextResponse.json({
    ok: true,
    uploadId: uploadRecord.id,
    fileCount: uploadRecord.fileCount,
    totalBytes: uploadRecord.totalBytes
  });
}