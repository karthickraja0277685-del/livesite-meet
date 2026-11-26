"use client";

import React, { useState } from "react";
import { SiteNavbar } from "@/components/SiteNavbar";
import { Button, Card } from "@/components/ui/primitives";
import { Sparkles, Shield, Gauge, Bot } from "lucide-react";

export default function AiPage() {
  const [prompt, setPrompt] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "AI request failed.");
      } else {
        setReply(data.reply);
      }
    } catch {
      setError("Network error while contacting AI.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050508] text-white flex flex-col">
      <SiteNavbar />

      <main className="mx-auto w-full max-w-5xl px-6 py-12 space-y-10">
        <div className="space-y-3 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-400/30 bg-indigo-500/15 px-3 py-1 text-xs font-semibold text-indigo-200">
            <Sparkles className="h-3.5 w-3.5" /> LiveSite Meet AI
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold">
            Smart Summaries Inside Your Website &amp; Live Meetings
          </h1>
          <p className="text-sm text-neutral-400 leading-relaxed">
            Turn page-tagged client feedback, classroom Q&amp;A, and chat into clean action checklists—protected by strict server-side rate limits and prompt-injection boundaries.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="space-y-2">
            <Bot className="h-5 w-5 text-indigo-400" />
            <h2 className="font-semibold text-sm">In-Meeting AI Tab</h2>
            <p className="text-xs text-neutral-400">
              Inside every meeting room, summarize pinned page notes and chat Q&amp;A in one click.
            </p>
          </Card>
          <Card className="space-y-2">
            <Gauge className="h-5 w-5 text-emerald-400" />
            <h2 className="font-semibold text-sm">Plan-Based Rate Limiting</h2>
            <p className="text-xs text-neutral-400">
              Sliding-window quotas protect your server (5/hr Free, 25/hr Plus, 100/hr Pro).
            </p>
          </Card>
          <Card className="space-y-2">
            <Shield className="h-5 w-5 text-cyan-400" />
            <h2 className="font-semibold text-sm">Zero Key Exposure</h2>
            <p className="text-xs text-neutral-400">
              API keys stay strictly server-side, and untrusted chat/notes are isolated in delimiters.
            </p>
          </Card>
        </div>

        <Card className="space-y-4">
          <h2 className="text-lg font-semibold">Try LiveSite Meet AI Demo</h2>
          <form onSubmit={handleAsk} className="space-y-3">
            <textarea
              rows={3}
              placeholder="Ask for a 5-minute website demo structure, classroom quiz flow, or client review checklist..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <Button type="submit" disabled={loading}>
              {loading ? "Thinking..." : "Ask LiveSite AI"}
            </Button>
          </form>

          {error && <p className="text-xs text-red-400">{error}</p>}
          {reply && (
            <div className="rounded-xl border border-white/10 bg-black/40 p-4 text-sm text-neutral-200 whitespace-pre-line">
              {reply}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
