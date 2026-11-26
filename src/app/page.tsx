"use client";

import React, { useState } from "react";
import Link from "next/link";
import { FluidInkCanvas } from "@/components/FluidInkCanvas";
import { SiteNavbar } from "@/components/SiteNavbar";

const HEADING_WORDS = [
  "Present",
  "Your",
  "Website.",
  "Let",
  "Everyone",
  "Explore",
  "It."
];

export default function LandingPage() {
  const [email, setEmail] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setStatusMessage(null);
    setIsError(false);

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) {
        setIsError(true);
        setStatusMessage(data.error || "Could not join waitlist.");
      } else {
        setIsError(false);
        setStatusMessage("You're on the waitlist! We'll be in touch soon.");
        setEmail("");
      }
    } catch {
      setIsError(true);
      setStatusMessage("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col justify-between overflow-hidden bg-[#050508]/80 text-white">
      {/* Full-bleed WebGL fluid ink simulation (used ONLY on the landing page) */}
      <FluidInkCanvas />

      {/* Soft dark radial scrim behind hero text for high contrast */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_center,rgba(5,5,8,0.78)_0%,rgba(5,5,8,0.45)_55%,rgba(5,5,8,0.88)_100%)]"
      />

      <SiteNavbar />

      {/* Main Hero Section */}
      <main className="mx-auto flex max-w-4xl flex-col items-center px-6 text-center my-auto py-16">
        {/* Glass-style pill badge */}
        <div className="mb-6 inline-flex items-center rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-medium tracking-wide text-neutral-100 backdrop-blur-md">
          Present live. Everyone explores.
        </div>

        {/* Large heading revealed word by word */}
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
          {HEADING_WORDS.map((word, idx) => (
            <span
              key={word + idx}
              className="animate-word-reveal mr-[0.26em] last:mr-0"
              style={{ animationDelay: `${idx * 90}ms` }}
            >
              {word}
            </span>
          ))}
        </h1>

        {/* Sub-line */}
        <p className="max-w-2xl text-base sm:text-lg text-neutral-300 mb-10">
          Upload your site, start a meeting, and give every attendee their own independent live session.
        </p>

        {/* Glass email waitlist bar */}
        <form
          onSubmit={handleWaitlistSubmit}
          className="flex w-full max-w-md flex-col sm:flex-row items-center gap-2 rounded-2xl border border-white/15 bg-white/10 p-2 backdrop-blur-md shadow-2xl"
        >
          <input
            type="email"
            required
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 w-full flex-1 bg-transparent px-4 text-sm text-white placeholder:text-neutral-300 focus:outline-none"
          />
          <button
            type="submit"
            disabled={submitting}
            className="h-11 w-full sm:w-auto whitespace-nowrap rounded-xl bg-white px-6 text-sm font-semibold text-black transition hover:bg-neutral-200 disabled:opacity-50"
          >
            {submitting ? "Joining..." : "Join Waitlist"}
          </button>
        </form>

        {statusMessage && (
          <p
            role="status"
            className={`mt-3 text-sm ${
              isError ? "text-red-400" : "text-emerald-400"
            }`}
          >
            {statusMessage}
          </p>
        )}
      </main>

      {/* Footer line */}
      <footer className="w-full border-t border-white/10 py-6 text-center text-xs text-neutral-400">
        © 2026 LiveSite Meet
      </footer>
    </div>
  );
}