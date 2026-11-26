import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedHost } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { meetingId: string } }
) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: params.meetingId }
  });

  if (!meeting || meeting.status !== "ACTIVE") {
    return NextResponse.json({ error: "Active meeting not found." }, { status: 404 });
  }

  const authUser = await getAuthenticatedHost(req);
  const hostCookie = req.cookies.get(`livesite_host_${meeting.id}`)?.value;
  const isHost =
    (authUser && authUser.id === meeting.hostId) ||
    hostCookie === meeting.hostId;

  if (!isHost) {
    return NextResponse.json(
      { error: "Only the host can trigger Follow Me sync." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const stageMode = body.stageMode === "SLIDES" ? "SLIDES" : "SITE";
  const pdfPage = Math.max(1, Number(body.pdfPage || meeting.activePdfPage || 1));
  const uploadId = typeof body.uploadId === "string" ? body.uploadId : meeting.activeUploadId;
  const pagePath =
    typeof body.pagePath === "string" && body.pagePath.trim()
      ? body.pagePath.trim().replace(/^\/+/, "")
      : "index.html";

  await prisma.meeting.update({
    where: { id: meeting.id },
    data: {
      stageMode,
      activePdfPage: pdfPage,
      ...(uploadId ? { activeUploadId: uploadId } : {})
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
      event: "follow-me",
      payload: {
        stageMode,
        pdfPage,
        uploadId,
        pagePath,
        syncedAt: Date.now()
      }
    });
  }

  return NextResponse.json({ ok: true, stageMode, pdfPage, uploadId, pagePath });
}
