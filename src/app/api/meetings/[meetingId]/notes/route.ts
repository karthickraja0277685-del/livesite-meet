import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedHost } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { meetingId: string } }
) {
  const sessionId = req.cookies.get(`livesite_session_${params.meetingId}`)?.value;
  const hostCookie = req.cookies.get(`livesite_host_${params.meetingId}`)?.value;
  const authUser = await getAuthenticatedHost(req);

  const meeting = await prisma.meeting.findUnique({
    where: { id: params.meetingId },
    select: { id: true, hostId: true }
  });
  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found." }, { status: 404 });
  }

  const isHost =
    (authUser && authUser.id === meeting.hostId) ||
    hostCookie === meeting.hostId;

  if (!isHost && !sessionId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const notes = await prisma.meetingNote.findMany({
    where: { meetingId: meeting.id },
    orderBy: { createdAt: "desc" },
    take: 200
  });

  return NextResponse.json({ notes });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { meetingId: string } }
) {
  const sessionId = req.cookies.get(`livesite_session_${params.meetingId}`)?.value;
  const hostCookie = req.cookies.get(`livesite_host_${params.meetingId}`)?.value;
  const authUser = await getAuthenticatedHost(req);

  const meeting = await prisma.meeting.findUnique({
    where: { id: params.meetingId },
    select: { id: true, hostId: true }
  });
  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found." }, { status: 404 });
  }

  const isHost =
    (authUser && authUser.id === meeting.hostId) ||
    hostCookie === meeting.hostId;

  const session = sessionId
    ? await prisma.attendeeSession.findFirst({
        where: { id: sessionId, meetingId: meeting.id, isBanned: false }
      })
    : null;

  if (!isHost && !session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const content = String(body.content || "").trim().slice(0, 600);
  const pagePath = String(body.pagePath || "index.html").trim().slice(0, 120);
  const viewport = ["DESKTOP", "TABLET", "MOBILE"].includes(String(body.viewport))
    ? String(body.viewport)
    : "DESKTOP";
  const uploadId = typeof body.uploadId === "string" ? body.uploadId : null;

  if (!content) {
    return NextResponse.json({ error: "Feedback note cannot be empty." }, { status: 400 });
  }

  const note = await prisma.meetingNote.create({
    data: {
      meetingId: meeting.id,
      uploadId,
      authorName: session?.displayName || (isHost ? "Host" : "Guest"),
      authorSessionId: session?.id ?? null,
      pagePath,
      viewport,
      content
    }
  });

  const hasRealSupabase =
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder") &&
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (hasRealSupabase) {
    const supabaseAdmin = createSupabaseServiceClient();
    const channel = supabaseAdmin.channel(`meeting:${meeting.id}`);
    await channel.send({
      type: "broadcast",
      event: "note-added",
      payload: note
    });
  }

  return NextResponse.json({ note }, { status: 201 });
}
