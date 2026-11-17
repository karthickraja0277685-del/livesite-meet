import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedHost } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { purgeExpiredMeetings } from "@/lib/cleanup";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  await purgeExpiredMeetings();
  const host = await getAuthenticatedHost(req);
  if (!host) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meetings = await prisma.meeting.findMany({
    where: { hostId: host.id },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ meetings });
}

export async function POST(req: NextRequest) {
  const host = await getAuthenticatedHost(req);
  if (!host) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rate = checkRateLimit(`create-meeting:${host.id}`, 15, 60 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded for creating meetings." },
      { status: 429 }
    );
  }

  const body = await req.json();
  const title = (body.title || "").trim();
  if (!title || title.length > 120) {
    return NextResponse.json(
      { error: "Meeting title is required (max 120 characters)." },
      { status: 400 }
    );
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // Auto-expires in 24 hours
  const meeting = await prisma.meeting.create({
    data: {
      title,
      hostId: host.id,
      expiresAt
    }
  });

  const response = NextResponse.json({ meeting }, { status: 201 });
  // Set an HttpOnly host marker cookie for same-browser host recognition during local/test flows
  response.cookies.set(`livesite_host_${meeting.id}`, host.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/"
  });
  return response;
}