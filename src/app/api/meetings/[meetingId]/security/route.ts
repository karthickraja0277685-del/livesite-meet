import { NextRequest, NextResponse } from "next/server";
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

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found." }, { status: 404 });
  }

  const authUser = await getAuthenticatedHost(req);
  const hostCookie = req.cookies.get(`livesite_host_${meeting.id}`)?.value;
  const isHost =
    (authUser && authUser.id === meeting.hostId) ||
    hostCookie === meeting.hostId;

  if (!isHost) {
    return NextResponse.json({ error: "Only the host can manage security." }, { status: 403 });
  }

  const planConfig = getPlanConfig(meeting.host.plan);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");

  let updatedMeeting = meeting;
  let bannedSessionId: string | null = null;

  if (action === "toggle_lock") {
    updatedMeeting = await prisma.meeting.update({
      where: { id: meeting.id },
      data: { isLocked: Boolean(body.isLocked) },
      include: { host: { select: { plan: true } } }
    });
  } else if (action === "toggle_safe_mode") {
    if (Boolean(body.safeMode) && !planConfig.allowSafeMode) {
      return NextResponse.json(
        { error: "Class Safe Mode requires Plus or Pro plan." },
        { status: 403 }
      );
    }
    updatedMeeting = await prisma.meeting.update({
      where: { id: meeting.id },
      data: { safeMode: Boolean(body.safeMode) },
      include: { host: { select: { plan: true } } }
    });
  } else if (action === "ban_session") {
    const targetSessionId = String(body.targetSessionId || "");
    if (!targetSessionId) {
      return NextResponse.json({ error: "targetSessionId is required." }, { status: 400 });
    }
    const target = await prisma.attendeeSession.findFirst({
      where: { id: targetSessionId, meetingId: meeting.id, isHost: false }
    });
    if (!target) {
      return NextResponse.json({ error: "Participant not found." }, { status: 404 });
    }
    await prisma.attendeeSession.update({
      where: { id: target.id },
      data: { isBanned: true, leftAt: new Date(), handRaised: false }
    });
    if (target.userId && !meeting.bannedUserIds.includes(target.userId)) {
      updatedMeeting = await prisma.meeting.update({
        where: { id: meeting.id },
        data: { bannedUserIds: { push: target.userId } },
        include: { host: { select: { plan: true } } }
      });
    }
    bannedSessionId = target.id;
  } else {
    return NextResponse.json({ error: "Unsupported security action." }, { status: 400 });
  }

  const hasRealSupabase =
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder") &&
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (hasRealSupabase) {
    const supabaseAdmin = createSupabaseServiceClient();
    const channel = supabaseAdmin.channel(`meeting:${meeting.id}`);
    if (bannedSessionId) {
      await channel.send({
        type: "broadcast",
        event: "session-banned",
        payload: { sessionId: bannedSessionId }
      });
    } else {
      await channel.send({
        type: "broadcast",
        event: "security-update",
        payload: {
          isLocked: updatedMeeting.isLocked,
          safeMode: updatedMeeting.safeMode
        }
      });
    }
  }

  return NextResponse.json({
    isLocked: updatedMeeting.isLocked,
    safeMode: updatedMeeting.safeMode,
    bannedSessionId
  });
}
