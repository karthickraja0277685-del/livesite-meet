"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { InstallAppButton } from "@/components/InstallAppButton";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/versions", label: "Versions" },
  { href: "/ai", label: "AI" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" }
];

export function SiteNavbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="relative z-20 mx-auto w-full max-w-6xl px-6 py-5">
      <div className="flex items-center justify-between gap-4">
        <Link href="/" className="text-lg font-bold tracking-tight text-white">
          LiveSite Meet
        </Link>

        <nav className="hidden md:flex items-center gap-5 rounded-full border border-white/15 bg-white/5 px-5 py-2 text-sm text-neutral-200 backdrop-blur-md">
          {NAV_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="hover:text-white transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          <InstallAppButton />
          <Link
            href="/login"
            className="hidden sm:inline-flex rounded-full bg-white px-4 py-2 text-xs font-semibold text-black transition hover:bg-neutral-200"
          >
            Get Started
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="md:hidden rounded-lg border border-white/15 bg-white/5 p-2 text-neutral-200"
            aria-label="Toggle menu"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-white/15 bg-neutral-950/95 p-4 text-sm text-neutral-200 md:hidden backdrop-blur-md">
          {NAV_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 hover:bg-white/10"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/login"
            onClick={() => setOpen(false)}
            className="mt-1 rounded-lg bg-white px-3 py-2 text-center font-semibold text-black"
          >
            Get Started
          </Link>
        </div>
      )}
    </header>
  );
}
