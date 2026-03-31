"use client";
import WorkflowVisual from "./components/WorkflowVisual";
import ScrollReveal from "./components/ScrollReveal";
import { useRouter } from "next/navigation";
 
export default function Home() {
  const router = useRouter();

  return (
    <>
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 bg-[#0A0A0A]/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex justify-between items-center px-8 py-4 max-w-[1440px] mx-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-primary-fixed flex items-center justify-center">
              <span
                className="material-symbols-outlined text-white"
                style={{ fontSize: "16px", fontVariationSettings: "'FILL' 1" }}
              >
                hub
              </span>
            </div>
            <button
              onClick={() => {
                router.push("/");
              }}
              className="text-xl font-bold tracking-tighter text-white"
            >
              Cortex
            </button>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {["Product", "Solutions", "Developers", "Pricing"].map((link) => (
              <a
                key={link}
                href="#"
                className="text-[#C6C6C6] hover:text-white transition-colors duration-200 text-sm font-medium"
              >
                {link}
              </a>
            ))}
          </div>
          <a
            href="/auth"
            className="bg-primary-fixed text-white px-5 py-2 rounded-lg font-semibold text-sm hover:opacity-90 transition-all duration-200"
          >
            Get Started
          </a>
        </div>
      </nav>

      <main>
        {/* ── Hero ───────────────────────────────────────────── */}
        <section className="relative pt-48 pb-40 px-8 overflow-hidden">
          <div className="hero-gradient absolute inset-0 -z-10" />
          <div className="max-w-4xl mx-auto text-center space-y-8">
            {/* Beta pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs text-on-surface-variant tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Now in public beta · Free to get started
            </div>

            <h1 className="text-6xl md:text-[88px] font-extrabold tracking-tighter text-white leading-[0.95]">
              Your knowledge base.
              <br />
              <span className="text-on-surface-variant">
                Finally understood.
              </span>
            </h1>

            <p className="text-xl text-on-surface-variant max-w-2xl mx-auto leading-relaxed">
              Ask anything. From any document. From any codebase. Cortex reads,
              indexes, and reasons over everything you feed it — so you never
              dig through files again.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <a
                href="/auth"
                className="w-full sm:w-auto px-8 py-4 bg-primary-fixed text-white rounded-xl font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2"
              >
                Get Started Free
                <span
                  className="material-symbols-outlined text-base"
                  style={{ fontVariationSettings: "'FILL' 0" }}
                >
                  arrow_forward
                </span>
              </a>
              <a
                href="#workflow-section"
                className="w-full sm:w-auto px-8 py-4 bg-white/5 text-white rounded-xl font-bold hover:bg-white/10 transition-all border border-white/10 flex items-center justify-center gap-2"
              >
                <span
                  className="material-symbols-outlined text-base"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  play_circle
                </span>
                See it in action
              </a>
            </div>
          </div>

          {/* Hero Visual — 3D workflow diagram */}
          <WorkflowVisual />
        </section>

        {/* ── Features ───────────────────────────────────────── */}
        <section className="py-40 px-4 max-w-[1440px] mx-auto">
          <ScrollReveal className="mb-20">
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-white leading-tight">
              Built for depth,
              <br />
              not just search.
            </h2>
            <p className="mt-4 text-on-surface-variant text-lg">
              Four core engines. One unified intelligence layer.
            </p>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            {/* Card 1 — Document Intelligence (large) */}
            <ScrollReveal delay={0} className="md:col-span-8">
              <div className="h-full bg-surface-container-low p-10 rounded-xl hover:bg-surface-container-high transition-all duration-300 flex flex-col">
                <div className="w-10 h-10 rounded-lg bg-primary-fixed/10 flex items-center justify-center mb-6 border border-primary-fixed/20">
                  <span
                    className="material-symbols-outlined text-primary-fixed"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    description
                  </span>
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">
                  Document Intelligence
                </h3>
                <p className="text-on-surface-variant leading-relaxed max-w-md">
                  Any PDF, report, or research paper. Upload it and start asking
                  questions that actually matter. Cortex understands context,
                  not just keywords.
                </p>
                {/* Mini mockup */}
                <div className="mt-8 rounded-xl bg-black/50 border border-white/5 p-5 font-mono text-xs">
                  <div className="flex items-center gap-2 mb-4 text-on-surface-variant/60">
                    <span
                      className="material-symbols-outlined"
                      style={{
                        fontSize: "14px",
                        fontVariationSettings: "'FILL' 1",
                      }}
                    >
                      picture_as_pdf
                    </span>
                    <span>Q3_Research_Report.pdf</span>
                    <span className="ml-auto text-emerald-400/80 text-[10px]">
                      indexed
                    </span>
                  </div>
                  <div className="space-y-1.5 mb-4">
                    <div className="h-1.5 w-full bg-white/5 rounded-full" />
                    <div className="h-1.5 w-4/5 bg-white/5 rounded-full" />
                    <div className="h-1.5 w-3/4 bg-primary-fixed/30 rounded-full" />
                    <div className="h-1.5 w-full bg-white/5 rounded-full" />
                    <div className="h-1.5 w-2/3 bg-white/5 rounded-full" />
                  </div>
                  <div className="pt-3 border-t border-white/5 text-[11px]">
                    <span className="text-on-surface-variant/40">↳ </span>
                    <span className="text-primary-fixed/90">
                      Efficiency gains of 47% identified in section 3.2 — cited
                      from page 14.
                    </span>
                  </div>
                </div>
              </div>
            </ScrollReveal>

            {/* Card 2 — Codebase Awareness */}
            <ScrollReveal delay={80} className="md:col-span-4">
              <div className="h-full bg-surface-container-lowest p-10 rounded-xl border border-outline-variant/10 hover:border-primary-fixed/20 transition-all duration-300 flex flex-col">
                <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center mb-6 border border-secondary/20">
                  <span
                    className="material-symbols-outlined text-secondary"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    code
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">
                  Codebase Awareness
                </h3>
                <p className="text-on-surface-variant text-sm leading-relaxed">
                  Connect your GitHub and ask Cortex about your architecture,
                  functions, and decisions. It reads code the way a senior
                  engineer would.
                </p>
                {/* Mini mockup */}
                <div className="mt-auto pt-6 rounded-xl bg-black/50 border border-white/5 p-4 font-mono text-[11px] overflow-hidden">
                  <div className="text-on-surface-variant/40 mb-2">
                    {"// auth/middleware.ts"}
                  </div>
                  <div>
                    <span className="text-secondary/70">function </span>
                    <span className="text-white">verifyToken</span>
                    <span className="text-on-surface-variant/50">
                      (token: string)
                    </span>
                  </div>
                  <div className="mt-3 pt-2 border-t border-white/5 text-[10px] text-primary-fixed/80 leading-relaxed">
                    ↳ Handles JWT verification and attaches user context to
                    req.user before routing.
                  </div>
                </div>
              </div>
            </ScrollReveal>

            {/* Card 3 — RAG-Powered Retrieval */}
            <ScrollReveal delay={120} className="md:col-span-4">
              <div className="h-full bg-surface-container-lowest p-10 rounded-xl border border-outline-variant/10 hover:border-secondary/20 transition-all duration-300 flex flex-col">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-6 border border-primary/20">
                  <span
                    className="material-symbols-outlined text-primary"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    database
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">
                  RAG-Powered Retrieval
                </h3>
                <p className="text-on-surface-variant text-sm leading-relaxed">
                  Not a chatbot. A retrieval engine. Every answer is grounded in
                  your actual content with sources cited — no hallucinations, no
                  guesswork.
                </p>
                {/* Mini mockup */}
                <div className="mt-auto pt-6 rounded-xl bg-black/50 border border-white/5 p-4 text-[11px]">
                  <div className="text-on-surface-variant/50 mb-2 font-mono">
                    How does pricing work?
                  </div>
                  <div className="text-white/70 text-[10px] leading-relaxed mb-3">
                    Usage-based tiers. Free plan includes 1,000 queries/mo with
                    a 100MB document limit...
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <span className="px-2 py-0.5 rounded-md bg-primary-fixed/10 border border-primary-fixed/20 text-primary-fixed/80 text-[9px] font-mono">
                      pricing.pdf §3.1
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-primary-fixed/10 border border-primary-fixed/20 text-primary-fixed/80 text-[9px] font-mono">
                      faq.md #billing
                    </span>
                  </div>
                </div>
              </div>
            </ScrollReveal>

            {/* Card 4 — Real-time Processing (large) */}
            <ScrollReveal delay={160} className="md:col-span-8">
              <div className="h-full bg-surface-container-low p-10 rounded-xl hover:bg-surface-container-high transition-all duration-300 flex flex-col md:flex-row gap-8 items-start">
                <div className="flex-1">
                  <div className="w-10 h-10 rounded-lg bg-secondary-fixed/10 flex items-center justify-center mb-6 border border-secondary-fixed/20">
                    <span
                      className="material-symbols-outlined text-secondary-fixed"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      bolt
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">
                    Real-time Processing
                  </h3>
                  <p className="text-on-surface-variant leading-relaxed max-w-sm">
                    Watch your documents go from upload to ready in seconds.
                    Live progress, instant feedback, no waiting around wondering
                    if it worked.
                  </p>
                </div>
                {/* Mini mockup */}
                <div className="w-full md:w-2/5 rounded-xl bg-black/50 border border-white/5 p-5 font-mono text-[11px]">
                  <div className="text-on-surface-variant/40 mb-4 text-[10px] uppercase tracking-widest">
                    Indexing queue
                  </div>
                  {[
                    { name: "annual_report.pdf", pct: 100, done: true },
                    { name: "codebase.zip", pct: 85, done: false },
                    { name: "docs/", pct: 43, done: false },
                  ].map(({ name, pct, done }) => (
                    <div key={name} className="mb-3">
                      <div className="flex justify-between text-[10px] text-on-surface-variant/60 mb-1.5">
                        <span>{name}</span>
                        <span className={done ? "text-emerald-400" : ""}>
                          {done ? "✓" : `${pct}%`}
                        </span>
                      </div>
                      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${done ? "bg-emerald-500/50" : "bg-primary-fixed"}`}
                          style={{
                            width: `${pct}%`,
                            boxShadow: done
                              ? "none"
                              : "0 0 8px rgba(0,90,194,0.7)",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* ── How it works ───────────────────────────────────── */}
        <section className="py-40 px-8 border-t border-white/5">
          <div className="max-w-5xl mx-auto">
            <ScrollReveal className="text-center mb-24">
              <h2 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-white mb-4">
                How it works.
              </h2>
              <p className="text-on-surface-variant">
                Three steps to universal intelligence.
              </p>
            </ScrollReveal>

            <div className="relative flex flex-col md:flex-row justify-between items-center md:items-start gap-16">
              <div className="hidden md:block absolute top-10 left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-outline-variant/20 to-transparent -z-10" />
              {[
                {
                  icon: "upload_file",
                  label: "Upload",
                  color: "text-primary-fixed",
                  bg: "bg-primary-fixed/10",
                  border: "border-primary-fixed/20",
                  desc: "Drop any PDF, code repo, or text document into the engine.",
                },
                {
                  icon: "memory",
                  label: "Process",
                  color: "text-secondary",
                  bg: "bg-secondary/10",
                  border: "border-secondary/20",
                  desc: "Cortex builds a semantic map of your data with lightning speed.",
                },
                {
                  icon: "chat_bubble",
                  label: "Ask",
                  color: "text-primary",
                  bg: "bg-primary/10",
                  border: "border-primary/20",
                  desc: "Natural language queries yield exact answers with cited sources.",
                },
              ].map(({ icon, label, color, bg, border, desc }, i) => (
                <ScrollReveal
                  key={label}
                  delay={i * 120}
                  className="flex flex-col items-center text-center max-w-[240px]"
                >
                  <div
                    className={`w-20 h-20 rounded-full ${bg} flex items-center justify-center mb-6 border ${border}`}
                  >
                    <span
                      className={`material-symbols-outlined text-2xl ${color}`}
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      {icon}
                    </span>
                  </div>
                  <h4 className="text-xl font-bold text-white mb-2">{label}</h4>
                  <p className="text-sm text-on-surface-variant">{desc}</p>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ──────────────────────────────────────── */}
        <section className="py-40 px-8">
          <div className="max-w-5xl mx-auto">
            <ScrollReveal>
              <div className="cta-card-border p-16 md:p-24 rounded-2xl bg-surface-container-low text-center overflow-hidden relative">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(0,90,194,0.08),transparent_50%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(221,183,255,0.06),transparent_50%)]" />
                <div className="relative z-10 space-y-8">
                  <h2 className="text-4xl md:text-6xl font-extrabold tracking-tighter text-white leading-tight">
                    Start building
                    <br />
                    with Cortex.
                  </h2>
                  <p className="text-xl text-on-surface-variant max-w-xl mx-auto">
                    Join 10,000+ developers turning static data into active
                    intelligence. No credit card required.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
                    <a
                      href="/auth"
                      className="px-12 py-5 bg-primary-fixed text-white rounded-xl font-bold text-lg hover:opacity-90 transition-all"
                    >
                      Get Started Free
                    </a>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="bg-[#0A0A0A] w-full py-20 px-8 border-t border-white/5">
        <div className="flex flex-col md:flex-row justify-between items-center max-w-[1440px] mx-auto gap-8">
          <div className="text-center md:text-left">
            <div className="flex items-center gap-2 justify-center md:justify-start mb-2">
              <div className="w-6 h-6 rounded-md bg-primary-fixed flex items-center justify-center">
                <span
                  className="material-symbols-outlined text-white"
                  style={{
                    fontSize: "14px",
                    fontVariationSettings: "'FILL' 1",
                  }}
                >
                  hub
                </span>
              </div>
              <span className="text-lg font-bold tracking-tighter text-white">
                Cortex
              </span>
            </div>
            <p className="text-[#C6C6C6] text-sm">Think deeper.</p>
            <p className="text-[#C6C6C6] text-xs mt-6 opacity-40">
              © 2024 Cortex. All rights reserved.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-8">
            {["Privacy", "Terms", "Security", "Status"].map((link) => (
              <a
                key={link}
                href="#"
                className="text-[#C6C6C6] hover:text-white transition-colors text-sm"
              >
                {link}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </>
  );
}
