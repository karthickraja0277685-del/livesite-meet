import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedHost } from "@/lib/auth";
import { getPlanConfig } from "@/lib/plans";

export const runtime = "nodejs";

function escapeCsv(val: unknown): string {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(
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
    return NextResponse.json({ error: "Only the host can export CSV reports." }, { status: 403 });
  }

  const planConfig = getPlanConfig(meeting.host.plan);
  if (!planConfig.allowFeedbackExport) {
    return NextResponse.json(
      { error: "CSV Export requires Plus or Pro plan." },
      { status: 403 }
    );
  }

  const type = req.nextUrl.searchParams.get("type") === "attendance" ? "attendance" : "notes";

  if (type === "attendance") {
    const sessions = await prisma.attendeeSession.findMany({
      where: { meetingId: meeting.id },
      orderBy: { createdAt: "asc" }
    });
    const rows = [
      ["Name", "Role", "Verified", "Email", "Joined At", "Banned"].join(","),
      ...sessions.map((s) =>
        [
          escapeCsv(s.displayName),
          escapeCsv(s.isHost ? "Host" : "Participant"),
          escapeCsv(s.isVerified ? "Yes" : "Guest"),
          escapeCsv(s.verifiedEmail || ""),
          escapeCsv(s.createdAt.toISOString()),
          escapeCsv(s.isBanned ? "Yes" : "No")
        ].join(",")
      )
    ];
    return new NextResponse(rows.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="attendance-${meeting.id.slice(0, 8)}.csv"`
      }
    });
  }

  const notes = await prisma.meetingNote.findMany({
    where: { meetingId: meeting.id },
    orderBy: { createdAt: "asc" }
  });
  const rows = [
    ["Author", "Page Path", "Viewport", "Feedback", "Timestamp"].join(","),
    ...notes.map((n) =>
      [
        escapeCsv(n.authorName),
        escapeCsv(n.pagePath),
        escapeCsv(n.viewport),
        escapeCsv(n.content),
        escapeCsv(n.createdAt.toISOString())
      ].join(",")
    )
  ];

  return new NextResponse(rows.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="feedback-${meeting.id.slice(0, 8)}.csv"`
    }
  });
}
