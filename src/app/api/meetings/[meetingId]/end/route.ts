import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedHost } from "@/lib/auth";
import { deleteMeetingFiles } from "@/lib/cleanup";
import { createSupabaseServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { meetingId: string } }
) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: params.meetingId }
  });

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found." }, { status: 404 });
  }

  const authUser = await getAuthenticatedHost(req);
  const hostCookie = req.cookies.get(`livesite_host_${meeting.id}`)?.value;
  const isAuthorizedHost =
    (authUser && authUser.id === meeting.hostId) ||
    hostCookie === meeting.hostId;

  // SECURITY: Only the meeting's host can end the meeting and delete its files.
  if (!isAuthorizedHost) {
    return NextResponse.json(
      { error: "Forbidden: Only the host can end this meeting." },
      { status: 403 }
    );
  }

  await deleteMeetingFiles(meeting.id);

  await prisma.meeting.update({
    where: { id: meeting.id },
    data: {
      status: "ENDED",
      endedAt: new Date(),
      activeUploadId: null
    }
  });

  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder") &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    const supabaseAdmin = createSupabaseServiceClient();
    await supabaseAdmin.channel(`meeting:${meeting.id}`).send({
      type: "broadcast",
      event: "meeting-ended",
      payload: { endedAt: Date.now() }
    });
  }

  return NextResponse.json({ ok: true, status: "ENDED" });
}