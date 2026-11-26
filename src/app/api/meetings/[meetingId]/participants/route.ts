import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedHost } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { meetingId: string } }
) {
  const sessionId = req.cookies.get(`livesite_session_${params.meetingId}`)?.value;
  const authUser = await getAuthenticatedHost(req);
  const hostCookie = req.cookies.get(`livesite_host_${params.meetingId}`)?.value;

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

  const sessions = await prisma.attendeeSession.findMany({
    where: {
      meetingId: params.meetingId,
      isBanned: false,
      leftAt: null
    },
    orderBy: [{ handRaised: "desc" }, { handRaisedAt: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      displayName: true,
      isHost: true,
      isVerified: true,
      verifiedEmail: true,
      handRaised: true,
      handRaisedAt: true,
      createdAt: true
    }
  });

  return NextResponse.json({ participants: sessions });
}
