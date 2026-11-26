import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedHost } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { purgeExpiredMeetings } from "@/lib/cleanup";
import { getPlanConfig } from "@/lib/plans";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  await purgeExpiredMeetings();
  const host = await getAuthenticatedHost(req);
  if (!host) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user, meetings] = await Promise.all([
    prisma.user.findUnique({
      where: { id: host.id },
      select: { plan: true }
    }),
    prisma.meeting.findMany({
      where: { hostId: host.id },
      orderBy: { createdAt: "desc" }
    })
  ]);

  const plan = user?.plan ?? "FREE";
  return NextResponse.json({
    meetings,
    plan,
    planConfig: getPlanConfig(plan)
  });
}

export async function POST(req: NextRequest) {
  const host = await getAuthenticatedHost(req);
  if (!host) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rate = await checkRateLimit(`create-meeting:${host.id}`, 15, 60 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded for creating meetings." },
      { status: 429 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: host.id },
    select: { plan: true }
  });
  const planConfig = getPlanConfig(user?.plan);

  const body = await req.json();
  const title = (body.title || "").trim();
  if (!title || title.length > 120) {
    return NextResponse.json(
      { error: "Meeting title is required (max 120 characters)." },
      { status: 400 }
    );
  }

  const rawPasscode = typeof body.passcode === "string" ? body.passcode.trim() : "";
  const passcode = rawPasscode ? rawPasscode.slice(0, 12) : null;
  if (passcode && !planConfig.allowPasscode) {
    return NextResponse.json(
      { error: "Meeting passcodes require Plus or Pro plan." },
      { status: 403 }
    );
  }

  const safeMode = Boolean(body.safeMode);
  if (safeMode && !planConfig.allowSafeMode) {
    return NextResponse.json(
      { error: "Class Safe Mode requires Plus or Pro plan." },
      { status: 403 }
    );
  }

  let allowedEmails: string[] = [];
  if (Array.isArray(body.allowedEmails)) {
    allowedEmails = body.allowedEmails
      .map((e: unknown) => String(e || "").trim().toLowerCase())
      .filter((e: string) => e.length > 0 && e.length <= 254);
  } else if (typeof body.allowedEmails === "string" && body.allowedEmails.trim()) {
    allowedEmails = body.allowedEmails
      .split(/[\n,;]+/)
      .map((e: string) => e.trim().toLowerCase())
      .filter((e: string) => e.length > 0 && e.length <= 254);
  }

  if (allowedEmails.length > 0 && !planConfig.allowAllowlist) {
    return NextResponse.json(
      { error: "Email & domain allowlists require the Pro plan." },
      { status: 403 }
    );
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const meeting = await prisma.meeting.create({
    data: {
      title,
      hostId: host.id,
      passcode,
      safeMode,
      allowedEmails,
      expiresAt
    }
  });

  const response = NextResponse.json({ meeting }, { status: 201 });
  response.cookies.set(`livesite_host_${meeting.id}`, host.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/"
  });
  return response;
}