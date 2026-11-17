import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";
const DEMO_USER_EMAIL = "demo-host@livesite.local";
const DEMO_COOKIE_NAME = "livesite_demo_session";

function isDemoLoginEnabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.ALLOW_DEMO_LOGIN === "true"
  );
}

export async function POST() {
  if (!isDemoLoginEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const user = await prisma.user.upsert({
    where: { id: DEMO_USER_ID },
    update: {},
    create: {
      id: DEMO_USER_ID,
      email: DEMO_USER_EMAIL,
      name: "Demo Host"
    }
  });

  const response = NextResponse.json({ ok: true, user });
  response.cookies.set(DEMO_COOKIE_NAME, DEMO_USER_ID, {
    httpOnly: true,
    sameSite: "lax",
    path: "/"
  });
  return response;
}

export async function DELETE() {
  if (!isDemoLoginEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(DEMO_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
  return response;
}
