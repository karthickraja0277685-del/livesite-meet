import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, hashIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
  const rate = await checkRateLimit(`waitlist:${ip}`, 5, 60 * 60 * 1000); // Max 5 signups per hour per IP

  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many waitlist requests. Please try again later." },
      { status: 429 }
    );
  }

  let body: { email?: string; website?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body.website === "string" && body.website.trim().length > 0) {
    return NextResponse.json({ ok: true });
  }

  const email = (body.email || "").trim().toLowerCase();
  if (!EMAIL_REGEX.test(email) || email.length > 254) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 }
    );
  }

  await prisma.waitlist.upsert({
    where: { email },
    update: {},
    create: {
      email,
      ipHash: hashIp(ip)
    }
  });

  return NextResponse.json({ ok: true });
}