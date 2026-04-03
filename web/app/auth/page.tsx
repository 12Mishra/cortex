"use client";

import { signIn } from "next-auth/react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/dist/client/components/navigation";
import { useEffect } from "react";

export default function AuthPage() {
  const { data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) {
      router.push("/");
    }
  }, [session, router]);

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="w-150 h-150 rounded-full blur-[120px]"
          style={{
            background:
              "radial-gradient(circle, rgba(0,90,194,0.12) 0%, transparent 70%)",
          }}
        />
      </div>

      <div className="relative z-10 mb-8 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary-fixed flex items-center justify-center">
            <span
              className="material-symbols-outlined text-white"
              style={{ fontSize: "18px", fontVariationSettings: "'FILL' 1" }}
            >
              hub
            </span>
          </div>
          <span className="text-2xl font-bold tracking-tighter text-white">
            Cortex
          </span>
        </div>
      </div>

      <div className="auth-card auth-card-enter relative z-10 w-full max-w-105 mx-6 rounded-[12px] p-10 flex flex-col">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white tracking-tight mb-2">
            Welcome to Cortex
          </h2>
          <p className="text-[14px] text-on-surface-variant leading-relaxed">
            Sign in to start building your knowledge base.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button
              onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
              className="w-full h-11 bg-white hover:bg-[#F2F2F2] transition-colors duration-150 rounded-lg flex items-center justify-center gap-3 px-4"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              <span className="text-[14px] font-semibold text-[#1F1F1F]">
                Continue with Google
              </span>
            </button>

          <div className="flex items-center gap-4 my-1">
            <div className="h-px flex-1 bg-white/5" />
            <span className="text-[11px] uppercase tracking-widest text-on-surface-variant/50 font-medium">
              or
            </span>
            <div className="h-px flex-1 bg-white/5" />
          </div>

          <button className="w-full h-11 bg-[#1a1a1a] hover:bg-[#252525] border border-white/10 transition-colors duration-150 rounded-lg flex items-center justify-center gap-3 px-4">
            <svg className="w-5 h-5 fill-white shrink-0" viewBox="0 0 24 24">
              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.43.372.823 1.102.823 2.222 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
            </svg>
            <span className="text-[14px] font-semibold text-white">
              Continue with GitHub
            </span>
          </button>
        </div>

        <p className="mt-8 text-[12px] text-on-surface-variant/60 leading-relaxed text-center">
          By continuing, you agree to Cortex&apos;s{" "}
          <a className="text-primary-fixed hover:underline" href="#">
            Terms of Service
          </a>{" "}
          and{" "}
          <a className="text-primary-fixed hover:underline" href="#">
            Privacy Policy
          </a>
          .
        </p>
      </div>

      <div className="relative z-10 mt-10 flex items-center gap-2 px-4 py-2 rounded-full bg-surface-container-low border border-white/5">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[11px] font-medium text-on-surface-variant/60 tracking-tight uppercase">
          All systems operational
        </span>
      </div>
    </div>
  );
}
