import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedHost } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { meetingId: string } }
) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: params.meetingId },
    select: { id: true, hostId: true, activePdfPath: true, activePdfName: true }
  });

  if (!meeting || !meeting.activePdfPath) {
    return NextResponse.json({ error: "No active PDF slides found." }, { status: 404 });
  }

  const sessionId = req.cookies.get(`livesite_session_${meeting.id}`)?.value;
  const hostCookie = req.cookies.get(`livesite_host_${meeting.id}`)?.value;
  const authUser = await getAuthenticatedHost(req);

  const isHost =
    (authUser && authUser.id === meeting.hostId) ||
    hostCookie === meeting.hostId;

  if (!isHost && !sessionId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const hasRealSupabase =
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder") &&
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!hasRealSupabase) {
    return NextResponse.json({ error: "Storage not configured." }, { status: 503 });
  }

  const supabaseAdmin = createSupabaseServiceClient();
  const { data, error } = await supabaseAdmin.storage
    .from("meeting-sites")
    .download(meeting.activePdfPath);

  if (error || !data) {
    return NextResponse.json({ error: "PDF not found in storage." }, { status: 404 });
  }

  const arrayBuffer = await data.arrayBuffer();
  return new NextResponse(arrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${meeting.activePdfName || "slides.pdf"}"`,
      "Cache-Control": "private, max-age=60"
    }
  });
}
