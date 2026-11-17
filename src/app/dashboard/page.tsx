"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Button, Input, Card } from "@/components/ui/primitives";

interface MeetingItem {
  id: string;
  title: string;
  status: "ACTIVE" | "ENDED";
  createdAt: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [title, setTitle] = useState("");
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
      body: JSON.stringify({ title })
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(data.error || "Failed to create meeting.");
    } else {
      setTitle("");
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
        <header className="flex items-center justify-between border-b border-white/10 pb-6">
          <div>
            <h1 className="text-2xl font-bold">Host Dashboard</h1>
            <p className="text-sm text-neutral-400">
              Create meetings, share links, and present static websites in real time.
            </p>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            Log Out
          </Button>
        </header>

        <Card>
          <h2 className="text-lg font-semibold mb-4">Create a New Meeting</h2>
          <form onSubmit={handleCreateMeeting} className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="e.g., Product Launch Interactive Walkthrough"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Button type="submit" disabled={creating}>
              {creating ? "Creating..." : "Create Meeting"}
            </Button>
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
                    <div className="flex items-center gap-2.5">
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
                    </div>
                    <p className="text-xs text-neutral-400 mt-1">
                      Shareable Join Link: {typeof window !== "undefined" ? `${window.location.origin}/meet/${m.id}` : `/meet/${m.id}`}
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