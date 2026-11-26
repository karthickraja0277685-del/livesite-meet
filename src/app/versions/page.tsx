import React from "react";
import { SiteNavbar } from "@/components/SiteNavbar";
import { Card } from "@/components/ui/primitives";
import { Sparkles, ShieldCheck, Globe } from "lucide-react";

const RELEASES = [
  {
    version: "v2.1",
    date: "Nov 2026",
    title: "Installable PWA, Site Navigation & Rate-Limited AI Assistant",
    badge: "Latest",
    icon: Sparkles,
    items: [
      "Top-right Install App button (PWA) for Android, iOS, Windows, and macOS",
      "Unified website navigation: Dashboard, Versions, AI, Pricing, Contact, and Get Started",
      "In-meeting & website AI Assistant with plan-based rate limiting and prompt-injection protection"
    ]
  },
  {
    version: "v2.0",
    date: "Nov 2026",
    title: "Pitch Mode, Anti-Raid Security & Live Collaboration",
    badge: "Major",
    icon: ShieldCheck,
    items: [
      "Built-in crisp PDF Slide Viewer + 1-click Slides / Live Website toggle synced via Follow Me",
      "Anti-Raid Class Security: Email/Domain Allowlists, Personal Single-Device Links, Lock Room, Safe Mode, and Kick & Ban",
      "In-meeting Chat, Emoji Reactions, Raise Hand Queue, Viewport Switcher, Demo Timer, and Notes CSV Export"
    ]
  },
  {
    version: "v1.0",
    date: "Nov 2026",
    title: "Core Isolated Sessions & LiveKit WebRTC",
    badge: "Foundation",
    icon: Globe,
    items: [
      "Per-attendee sandboxed iframe origins on dedicated sites host",
      "Two-way static ZIP uploads up to 25 MB via signed Supabase Storage URLs",
      "QR Code invite modal, Mobile Tabs, Live Upload Toasts, and LiveKit audio/video"
    ]
  }
];

export default function VersionsPage() {
  return (
    <div className="min-h-screen bg-[#050508] text-white flex flex-col">
      <SiteNavbar />

      <main className="mx-auto w-full max-w-4xl px-6 py-12 space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Versions & Changelog</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Track every milestone shipped in LiveSite Meet.
          </p>
        </div>

        <div className="space-y-6">
          {RELEASES.map((rel) => {
            const Icon = rel.icon;
            return (
              <Card key={rel.version} className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <Icon className="h-5 w-5 text-indigo-400" />
                    <span className="text-lg font-bold">{rel.version}</span>
                    <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-xs font-semibold text-indigo-300">
                      {rel.badge}
                    </span>
                  </div>
                  <span className="text-xs text-neutral-400">{rel.date}</span>
                </div>
                <h2 className="text-base font-semibold text-neutral-100">{rel.title}</h2>
                <ul className="list-disc pl-5 space-y-1.5 text-sm text-neutral-300">
                  {rel.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
