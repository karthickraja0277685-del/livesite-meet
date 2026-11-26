"use client";

import React, { useState } from "react";
import { SiteNavbar } from "@/components/SiteNavbar";
import { Button, Card, Input } from "@/components/ui/primitives";
import { Mail, MapPin, ShieldCheck } from "lucide-react";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [websiteTrap, setWebsiteTrap] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setStatus(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message, website: websiteTrap })
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus({ ok: false, text: data.error || "Could not send message." });
      } else {
        setStatus({
          ok: true,
          text: "Message received! We'll get back to you shortly."
        });
        setName("");
        setEmail("");
        setMessage("");
      }
    } catch {
      setStatus({ ok: false, text: "Network error. Please try again." });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050508] text-white flex flex-col">
      <SiteNavbar />

      <main className="mx-auto w-full max-w-4xl px-6 py-12 grid gap-8 md:grid-cols-5">
        <div className="md:col-span-2 space-y-4">
          <h1 className="text-3xl font-bold">Contact Us</h1>
          <p className="text-sm text-neutral-400 leading-relaxed">
            Questions about classroom plans, agency deployments, or feedback on LiveSite Meet? Reach out anytime.
          </p>
          <div className="space-y-3 pt-2 text-sm text-neutral-300">
            <div className="flex items-center gap-2.5">
              <Mail className="h-4 w-4 text-indigo-400" />
              <span>support@livesitemeet.app</span>
            </div>
            <div className="flex items-center gap-2.5">
              <MapPin className="h-4 w-4 text-indigo-400" />
              <span>Chennai, India</span>
            </div>
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Rate-limited & spam-protected form</span>
            </div>
          </div>
        </div>

        <Card className="md:col-span-3">
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              value={websiteTrap}
              onChange={(e) => setWebsiteTrap(e.target.value)}
              className="sr-only"
            />
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">
                Your Name
              </label>
              <Input
                required
                placeholder="Karthick Raja"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">
                Email Address
              </label>
              <Input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">
                Message
              </label>
              <textarea
                rows={4}
                required
                placeholder="Tell us how we can help..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {status && (
              <p className={`text-xs ${status.ok ? "text-emerald-400" : "text-red-400"}`}>
                {status.text}
              </p>
            )}

            <Button type="submit" disabled={sending} className="w-full">
              {sending ? "Sending..." : "Send Message"}
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
}
