"use client";

import React, { useEffect, useState } from "react";
import { Download, Smartphone, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      setShowGuide(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setInstalled(true);
        setDeferredPrompt(null);
      }
      return;
    }
    setShowGuide(true);
  };

  if (installed) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/40 bg-cyan-500/15 px-3.5 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/25"
        title="Install LiveSite Meet as an app on your phone or PC"
      >
        <Download className="h-3.5 w-3.5" />
        <span>Install App</span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-neutral-900 p-6 text-left space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-cyan-400" />
                Install LiveSite Meet
              </h3>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed">
              Use LiveSite Meet full-screen like a native app on your phone or desktop:
            </p>
            <ul className="space-y-2 text-xs text-neutral-300 list-disc pl-4">
              <li>
                <strong>Android (Chrome)</strong>: Tap the <strong>⋮ menu</strong> →{" "}
                <strong>Install app</strong> or <strong>Add to Home screen</strong>.
              </li>
              <li>
                <strong>iPhone / iPad (Safari)</strong>: Tap the <strong>Share</strong>{" "}
                button → <strong>Add to Home Screen</strong>.
              </li>
              <li>
                <strong>Windows / Mac (Chrome or Edge)</strong>: Click the{" "}
                <strong>Install icon</strong> in the right side of the address bar.
              </li>
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
