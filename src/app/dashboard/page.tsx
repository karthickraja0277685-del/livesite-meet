"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Button, Input, Card } from "@/components/ui/primitives";
import { Shield, Lock, Sparkles } from "lucide-react";

interface MeetingItem {
  id: string;
  title: string;
  status: "ACTIVE" | "ENDED";
  passcode?: string | null;
  safeMode?: boolean;
  isLocked?: boolean;
  allowedEmails?: string[];
  createdAt: string;
}

interface PlanConfig {
  tier: "FREE" | "PLUS" | "PRO";
  name: string;
  maxParticipants: number;
  maxZipMb: number;
  allowPasscode: boolean;
  allowSafeMode: boolean;
  allowAllowlist: boolean;
}

export default function DashboardPage() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [planConfig, setPlanConfig] = useState<PlanConfig | null>(null);
  const [title, setTitle] = useState("");
  const [passcode, setPasscode] = useState("");
  const [safeMode, setSafeMode] = useState(false);
  const [allowedEmails, setAllowedEmails] = useState("");
  const [showSecurity, setShowSecurity] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMeetings = async () => {
    const res = await fetch("/api/meetings");
    if (res.status === 401) {
      router.push("/login");
      return;
    }
    const data = await res.json();
    if (data.meetings) setMeetings(data.meetings);
    if (data.planConfig) setPlanConfig(data.planConfig);
  };

  useEffect(() => {
    loadMeetings();
  }, []);

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    const res = await fetch("/api/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        passcode: passcode.trim() || undefined,
        safeMode,
        allowedEmails: allowedEmails.trim() || undefined
      })
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(data.error || "Failed to create meeting.");
    } else {
      setTitle("");
      setPasscode("");
      setSafeMode(false);
      setAllowedEmails("");
      setShowSecurity(false);
      setMeetings((prev) => [data.meeting, ...prev]);
    }
  };

  const handleSignOut = async () => {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
      await fetch("/api/demo-login", { method: "DELETE" });
      router.push("/");
      return;
    }
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-[#050508] text-white p-6 md:p-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold">Host Dashboard</h1>
              {planConfig && (
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-1 rounded-full border border-indigo-400/30 bg-indigo-500/15 px-2.5 py-0.5 text-xs font-semibold text-indigo-200 hover:bg-indigo-500/25"
                >
                  <Sparkles className="h-3 w-3" />
                  {planConfig.name} Plan ({planConfig.maxParticipants} max)
                </Link>
              )}
            </div>
            <p className="text-sm text-neutral-400 mt-1">
              Create meetings, configure anti-raid access, and present sites or PDF slides.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/pricing"
              className="rounded-lg border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-semibold text-neutral-200 hover:bg-white/10"
            >
              Plans & Upgrade
            </Link>
            <Button variant="outline" onClick={handleSignOut}>
              Log Out
            </Button>
          </div>
        </header>

        <Card>
          <h2 className="text-lg font-semibold mb-4">Create a New Meeting</h2>
          <form onSubmit={handleCreateMeeting} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="e.g., CS101 Live Project Presentations"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowSecurity((v) => !v)}
              >
                <Shield className="mr-1.5 h-4 w-4 text-indigo-400" />
                Access Controls
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? "Creating..." : "Create Meeting"}
              </Button>
            </div>

            {showSecurity && (
              <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1">
                      Meeting Passcode (Plus / Pro)
                    </label>
                    <Input
                      placeholder={
                        planConfig?.allowPasscode
                          ? "Optional 4-8 digit PIN"
                          : "Upgrade to Plus/Pro to set PIN"
                      }
                      disabled={!planConfig?.allowPasscode}
                      value={passcode}
                      onChange={(e) => setPasscode(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2.5 pt-5">
                    <input
                      id="safe-mode-toggle"
                      type="checkbox"
                      className="h-4 w-4 accent-indigo-500"
                      disabled={!planConfig?.allowSafeMode}
                      checked={safeMode}
                      onChange={(e) => setSafeMode(e.target.checked)}
                    />
                    <label htmlFor="safe-mode-toggle" className="text-xs text-neutral-200">
                      <span className="font-semibold">Class Safe Mode</span> (Host-only uploads & muted on join — Plus/Pro)
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    Approved Email / Domain Allowlist (Pro — stops link-leaks & fake names)
                  </label>
                  <textarea
                    rows={2}
                    disabled={!planConfig?.allowAllowlist}
                    placeholder={
                      planConfig?.allowAllowlist
                        ? "e.g. arjun@college.edu, priya@college.edu, @cs.college.edu"
                        : "Switch to Pro plan on /pricing to enable email allowlists"
                    }
                    value={allowedEmails}
                    onChange={(e) => setAllowedEmails(e.target.value)}
                    className="w-full rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                  />
                </div>
              </div>
            )}
          </form>
          {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
        </Card>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Your Meetings</h2>
          {meetings.length === 0 ? (
            <p className="text-sm text-neutral-400">
              No meetings yet. Create your first meeting above!
            </p>
          ) : (
            <div className="grid gap-4">
              {meetings.map((m) => (
                <Card
                  key={m.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{m.title}</span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs ${
                          m.status === "ACTIVE"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-neutral-700 text-neutral-300"
                        }`}
                      >
                        {m.status}
                      </span>
                      {m.passcode && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-300">
                          <Lock className="h-3 w-3" /> PIN
                        </span>
                      )}
                      {m.safeMode && (
                        <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-[11px] text-indigo-300">
                          Safe Mode
                        </span>
                      )}
                      {m.allowedEmails && m.allowedEmails.length > 0 && (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-300">
                          Allowlist ({m.allowedEmails.length})
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-400 mt-1">
                      Shareable Join Link:{" "}
                      {typeof window !== "undefined"
                        ? `${window.location.origin}/meet/${m.id}`
                        : `/meet/${m.id}`}
                    </p>
                  </div>

                  {m.status === "ACTIVE" && (
                    <Link
                      href={`/meet/${m.id}`}
                      className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-neutral-200"
                    >
                      Open Meeting Room
                    </Link>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}