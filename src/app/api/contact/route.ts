import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, hashIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
  const rate = await checkRateLimit(`contact:${hashIp(ip)}`, 5, 60 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: `Too many messages sent. Try again in ${rate.retryAfterSeconds}s.`
      },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));

  // Honeypot anti-bot trap: real users never fill this hidden field
  if (typeof body.website === "string" && body.website.trim().length > 0) {
    return NextResponse.json({ ok: true, receivedAt: new Date().toISOString() });
  }

  const name = String(body.name || "").trim().slice(0, 80);
  const email = String(body.email || "").trim().slice(0, 254);
  const message = String(body.message || "").trim().slice(0, 1500);

  if (!name || !email.includes("@") || message.length < 10) {
    return NextResponse.json(
      { error: "Please enter a valid name, email, and message (min 10 chars)." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    receivedAt: new Date().toISOString()
  });
}
