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
      { error: "Class Safe Mode is active. Only the host can upload slides." },
      { status: 403 }
    );
  }

  const planConfig = getPlanConfig(meeting.host.plan);
  const maxBytes = planConfig.maxZipMb * 1024 * 1024;
  const contentType = req.headers.get("content-type") || "";

  let storagePath = "";
  let fileName = "Presentation.pdf";

  const hasRealSupabase =
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder") &&
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    storagePath = String(body.storagePath || "").trim();
    fileName = String(body.fileName || "Presentation.pdf").trim().slice(0, 120);
    if (!storagePath || !storagePath.startsWith(`${meeting.hostId}/${meeting.id}/slides/`)) {
      return NextResponse.json({ error: "Invalid slide storage path." }, { status: 400 });
    }
  } else {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Please attach a PDF file." }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF slide decks are supported for exact layout." },
        { status: 400 }
      );
    }
    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: `PDF exceeds ${planConfig.maxZipMb} MB limit.` },
        { status: 400 }
      );
    }
    fileName = file.name.slice(0, 120);
    const slideId = crypto.randomUUID();
    storagePath = `${meeting.hostId}/${meeting.id}/slides/${slideId}.pdf`;

    if (hasRealSupabase) {
      const supabaseAdmin = createSupabaseServiceClient();
      const buffer = Buffer.from(await file.arrayBuffer());
      const { error } = await supabaseAdmin.storage
        .from("meeting-sites")
        .upload(storagePath, buffer, {
          contentType: "application/pdf",
          upsert: true
        });
      if (error) {
        return NextResponse.json(
          { error: `Failed to store PDF: ${error.message}` },
          { status: 500 }
        );
      }
    }
  }

  const updated = await prisma.meeting.update({
    where: { id: meeting.id },
    data: {
      activePdfPath: storagePath,
      activePdfName: fileName,
      activePdfPage: 1,
      stageMode: "SLIDES"
    }
  });

  if (hasRealSupabase) {
    const supabaseAdmin = createSupabaseServiceClient();
    const channel = supabaseAdmin.channel(`meeting:${meeting.id}`);
    await channel.send({
      type: "broadcast",
      event: "slides-updated",
      payload: {
        activePdfName: updated.activePdfName,
        activePdfPage: 1,
        stageMode: "SLIDES",
        uploaderName: isAuthorizedHost ? "Host" : joinedSession?.displayName || "Participant"
      }
    });
  }

  return NextResponse.json({
    activePdfName: updated.activePdfName,
    activePdfPage: updated.activePdfPage,
    stageMode: updated.stageMode
  });
}
