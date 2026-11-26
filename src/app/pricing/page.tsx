"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Sparkles, ShieldCheck, ArrowLeft } from "lucide-react";
import { Button, Card } from "@/components/ui/primitives";

interface PlanItem {
  tier: "FREE" | "PLUS" | "PRO";
  name: string;
  priceLabel: string;
  tagline: string;
  maxParticipants: number;
  maxZipMb: number;
  allowPasscode: boolean;
  allowSafeMode: boolean;
  allowFeedbackExport: boolean;
  allowAllowlist: boolean;
  allowPersonalInvites: boolean;
}

const DEFAULT_PLANS: PlanItem[] = [
  {
    tier: "FREE",
    name: "Free",
    priceLabel: "$0",
    tagline: "Core isolated site sharing & live video for quick demos.",
    maxParticipants: 10,
    maxZipMb: 10,
    allowPasscode: false,
    allowSafeMode: false,
    allowFeedbackExport: false,
    allowAllowlist: false,
    allowPersonalInvites: false
  },
  {
    tier: "PLUS",
    name: "Plus",
    priceLabel: "$12/mo",
    tagline: "Built for teachers, freelancers, and live interactive classes.",
    maxParticipants: 30,
    maxZipMb: 25,
    allowPasscode: true,
    allowSafeMode: true,
    allowFeedbackExport: true,
    allowAllowlist: false,
    allowPersonalInvites: false
  },
  {
    tier: "PRO",
    name: "Pro",
    priceLabel: "$29/mo",
    tagline: "Verified anti-raid class security, personal links & agency workflows.",
    maxParticipants: 100,
    maxZipMb: 25,
    allowPasscode: true,
    allowSafeMode: true,
    allowFeedbackExport: true,
    allowAllowlist: true,
    allowPersonalInvites: true
  }
];

export default function PricingPage() {
  const [currentPlan, setCurrentPlan] = useState<"FREE" | "PLUS" | "PRO" | null>(null);
  const [plans, setPlans] = useState<PlanItem[]>(DEFAULT_PLANS);
  const [switching, setSwitching] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/plan")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.plan) setCurrentPlan(data.plan);
        if (data?.allPlans) setPlans(data.allPlans);
      })
      .catch(() => {});
  }, []);

  const handleSwitch = async (tier: "FREE" | "PLUS" | "PRO") => {
    setSwitching(tier);
    setMessage(null);
    const res = await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: tier })
    });
    const data = await res.json().catch(() => ({}));
    setSwitching(null);
    if (!res.ok) {
      setMessage(data.error || "Sign in as a host first to switch plans.");
      return;
    }
    setCurrentPlan(data.plan);
    setMessage(`Switched active plan to ${data.plan} (Test Mode).`);
  };

  return (
    <div className="min-h-screen bg-[#050508] text-white p-6 md:p-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex items-center justify-between border-b border-white/10 pb-6">
          <div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white mb-2"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
            </Link>
            <h1 className="text-3xl font-bold">Plans & Security Tiers</h1>
            <p className="text-sm text-neutral-400 mt-1">
              Test Free, Plus, and Pro gates live in your dashboard and meeting rooms.
            </p>
          </div>
          {currentPlan && (
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
              Current Plan: {currentPlan}
            </span>
          )}
        </div>

        {message && (
          <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-200">
            {message}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((p) => {
            const isCurrent = currentPlan === p.tier;
            return (
              <Card
                key={p.tier}
                className={`flex flex-col justify-between ${
                  p.tier === "PRO"
                    ? "border-indigo-500/50 bg-indigo-950/20"
                    : p.tier === "PLUS"
                    ? "border-emerald-500/30"
                    : ""
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      {p.tier === "PRO" ? (
                        <ShieldCheck className="h-5 w-5 text-indigo-400" />
                      ) : p.tier === "PLUS" ? (
                        <Sparkles className="h-5 w-5 text-emerald-400" />
                      ) : null}
                      {p.name}
                    </h2>
                    <span className="text-lg font-bold text-white">{p.priceLabel}</span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-2">{p.tagline}</p>

                  <ul className="mt-5 space-y-2.5 text-sm text-neutral-200">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                      Up to {p.maxParticipants} participants
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                      Up to {p.maxZipMb} MB ZIP & PDF slides
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                      Follow Me sync, Chat, Reactions & Hand Raise
                    </li>
                    {p.allowPasscode && (
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                        Meeting Passcode & Class Safe Mode
                      </li>
                    )}
                    {p.allowFeedbackExport && (
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                        Feedback Notes & Attendance CSV Export
                      </li>
                    )}
                    {p.allowAllowlist && (
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-indigo-400 shrink-0" />
                        Email / Domain Allowlist (Anti-Impersonation)
                      </li>
                    )}
                    {p.allowPersonalInvites && (
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-indigo-400 shrink-0" />
                        Personal Single-Device Invite Links
                      </li>
                    )}
                  </ul>
                </div>

                <div className="mt-6">
                  {currentPlan ? (
                    <Button
                      variant={isCurrent ? "outline" : "primary"}
                      className="w-full"
                      disabled={isCurrent || switching === p.tier}
                      onClick={() => handleSwitch(p.tier)}
                    >
                      {isCurrent
                        ? "Active Plan"
                        : switching === p.tier
                        ? "Switching..."
                        : `Switch to ${p.name} (Test)`}
                    </Button>
                  ) : (
                    <Link
                      href="/login"
                      className="block w-full rounded-lg bg-white px-4 py-2 text-center text-sm font-semibold text-black hover:bg-neutral-200"
                    >
                      Sign in to Test {p.name}
                    </Link>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
