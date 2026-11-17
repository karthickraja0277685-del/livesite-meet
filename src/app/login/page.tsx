"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Button, Input, Card } from "@/components/ui/primitives";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const supabase = createSupabaseBrowserClient();
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setMessage(error.message);
      else {
        setMessage("Account created! Redirecting to dashboard...");
        router.push("/dashboard");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) setMessage(error.message);
      else router.push("/dashboard");
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/dashboard`
      }
    });
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/demo-login", { method: "POST" });
    setLoading(false);
    if (!res.ok) {
      setMessage("Demo login is disabled.");
      return;
    }
    router.push("/dashboard");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050508] p-6">
      <Card className="w-full max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-bold">
            {mode === "signin" ? "Sign in to LiveSite Meet" : "Create Host Account"}
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Host live meetings and upload static websites for attendees to explore.
          </p>
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div>
            <label className="block text-xs text-neutral-300 mb-1">Email</label>
            <Input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-300 mb-1">Password</label>
            <Input
              type="password"
              required
              minLength={6}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {message && <p className="text-xs text-amber-400">{message}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading
              ? "Please wait..."
              : mode === "signin"
              ? "Sign In"
              : "Sign Up"}
          </Button>
        </form>

        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-white/10" />
          <span className="flex-shrink mx-3 text-xs text-neutral-500">OR</span>
          <div className="flex-grow border-t border-white/10" />
        </div>

        <Button
          type="button"
          variant="glass"
          onClick={handleGoogleLogin}
          className="w-full"
        >
          Continue with Google
        </Button>

        {process.env.NEXT_PUBLIC_DEMO_MODE === "true" && (
          <Button
            type="button"
            variant="outline"
            onClick={handleDemoLogin}
            disabled={loading}
            className="w-full"
          >
            Continue as Demo Host (local only)
          </Button>
        )}

        <p className="text-center text-xs text-neutral-400">
          {mode === "signin" ? "Need an account? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="text-white underline"
          >
            {mode === "signin" ? "Sign Up" : "Sign In"}
          </button>
        </p>
      </Card>
    </div>
  );
}