import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedHost } from "@/lib/auth";
import { getPlanConfig } from "@/lib/plans";

export const runtime = "nodejs";

async function authorizeHost(req: NextRequest, meetingId: string) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: { host: { select: { plan: true } } }
  });
  if (!meeting) return null;
  const authUser = await getAuthenticatedHost(req);
  const hostCookie = req.cookies.get(`livesite_host_${meeting.id}`)?.value;
  const isHost =
    (authUser && authUser.id === meeting.hostId) ||
    hostCookie === meeting.hostId;
  return isHost ? meeting : null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { meetingId: string } }
) {
  const meeting = await authorizeHost(req, params.meetingId);
  if (!meeting) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const invites = await prisma.meetingInvite.findMany({
    where: { meetingId: meeting.id },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ invites });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { meetingId: string } }
) {
  const meeting = await authorizeHost(req, params.meetingId);
  if (!meeting) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const planConfig = getPlanConfig(meeting.host.plan);
  if (!planConfig.allowPersonalInvites) {
    return NextResponse.json(
      { error: "Personal single-device invite links require the Pro plan." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const label = String(body.label || "").trim().slice(0, 60);
  const email = typeof body.email === "string" && body.email.trim()
    ? body.email.trim().toLowerCase().slice(0, 254)
    : null;

  if (!label) {
    return NextResponse.json({ error: "Student or guest name is required." }, { status: 400 });
  }

  const token = crypto.randomBytes(12).toString("hex");
  const invite = await prisma.meetingInvite.create({
    data: {
      meetingId: meeting.id,
      label,
      email,
      token
    }
  });

  return NextResponse.json({ invite }, { status: 201 });
}
