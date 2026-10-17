"use client";

import { useEffect, useRef, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import Link from "next/link";
import DashboardPage from "../dashboard/page";

export default function TestPage() {
  const { status, update } = useSession();
  const started = useRef(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (status !== "unauthenticated" || started.current) return;
    started.current = true;
    async function startGuestSession() {
      try {
        const result = await signIn("guest", { redirect: false });
        if (!result?.ok || result.error) throw new Error("Could not start test session");
        await update();
      } catch {
        setError(true);
      }
    }
    void startGuestSession();
  }, [status, update]);

  if (status === "authenticated") return <DashboardPage />;

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-6 text-center">
      <div className="space-y-4 max-w-sm" role="status" aria-live="polite">
        <h1 className="text-xl font-bold text-white">Try Cortex</h1>
        <p className="text-sm text-on-surface-variant">
          {error ? "We couldn’t start your test workspace. Please try again." : "Preparing your workspace. No Google account or sign-in needed."}
        </p>
        {error ? (
          <button onClick={() => window.location.reload()} className="rounded-lg bg-primary-fixed px-5 py-2 text-sm font-semibold text-white">Try again</button>
        ) : (
          <span className="inline-block w-2 h-2 rounded-full bg-primary-fixed animate-pulse" />
        )}
        <Link href="/" className="block text-sm text-on-surface-variant hover:text-white">Back to home</Link>
      </div>
    </main>
  );
}
