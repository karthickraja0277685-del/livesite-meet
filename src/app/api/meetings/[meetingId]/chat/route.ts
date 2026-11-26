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

  const messages = await prisma.meetingChatMessage.findMany({
    where: { meetingId: meeting.id },
    orderBy: { createdAt: "asc" },
    take: 100
  });

  return NextResponse.json({ messages });
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
    select: { id: true, hostId: true, safeMode: true }
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
  const text = String(body.message || "").trim().slice(0, 500);
  if (!text) {
    return NextResponse.json({ error: "Message cannot be empty." }, { status: 400 });
  }

  const created = await prisma.meetingChatMessage.create({
    data: {
      meetingId: meeting.id,
      senderName: session?.displayName || (isHost ? "Host" : "Guest"),
      senderSessionId: session?.id ?? null,
      isHost: Boolean(isHost),
      message: text
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
      event: "chat-message",
      payload: created
    });
  }

  return NextResponse.json({ message: created }, { status: 201 });
}
