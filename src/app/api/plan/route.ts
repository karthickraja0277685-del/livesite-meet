import { NextRequest, NextResponse } from "next/server";
import { PlanTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedHost } from "@/lib/auth";
import { getPlanConfig, PLAN_CONFIGS } from "@/lib/plans";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const host = await getAuthenticatedHost(req);
  if (!host) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: host.id },
    select: { id: true, email: true, name: true, plan: true, planUpdatedAt: true }
  });

  const tier = user?.plan ?? "FREE";
  return NextResponse.json({
    plan: tier,
    config: getPlanConfig(tier),
    allPlans: Object.values(PLAN_CONFIGS)
  });
}

export async function POST(req: NextRequest) {
  const host = await getAuthenticatedHost(req);
  if (!host) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const requestedPlan = String(body.plan || "").toUpperCase() as PlanTier;

  if (!["FREE", "PLUS", "PRO"].includes(requestedPlan)) {
    return NextResponse.json({ error: "Invalid plan tier." }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: host.id },
    data: {
      plan: requestedPlan,
      planUpdatedAt: new Date()
    },
    select: { id: true, plan: true, planUpdatedAt: true }
  });

  return NextResponse.json({
    plan: updated.plan,
    config: getPlanConfig(updated.plan)
  });
}
