import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedHost } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

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

  const body = await req.json().catch(() => ({}));
  const targetSessionId =
    isHost && typeof body.targetSessionId === "string"
      ? body.targetSessionId
      : sessionId;

  if (!targetSessionId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const raised = Boolean(body.raised);
  const updated = await prisma.attendeeSession.update({
    where: { id: targetSessionId },
    data: {
      handRaised: raised,
      handRaisedAt: raised ? new Date() : null
    },
    select: {
      id: true,
      displayName: true,
      handRaised: true,
      handRaisedAt: true
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
      event: "hand-update",
      payload: updated
    });
  }

  return NextResponse.json({ session: updated });
}
