"use client";

import { useRef, useState } from "react";

const PARTICLES = [
  { id: "pu1", d: "M110,115 L250,115",                       c: "#3B82F6", dur: "1.8s", begin: "0s"     },
  { id: "pu2", d: "M310,115 L450,115",                       c: "#3B82F6", dur: "1.8s", begin: "-0.45s" },
  { id: "pu3", d: "M510,115 L650,115",                       c: "#8B5CF6", dur: "1.8s", begin: "-0.9s"  },
  { id: "pu4", d: "M710,115 L850,115",                       c: "#06B6D4", dur: "1.8s", begin: "-1.35s" },
  { id: "pw1", d: "M680,143 L580,182",                       c: "#8B5CF6", dur: "1.0s", begin: "0s"     },
  { id: "pw2", d: "M680,143 L680,182",                       c: "#8B5CF6", dur: "1.0s", begin: "-0.33s" },
  { id: "pw3", d: "M680,143 L780,182",                       c: "#8B5CF6", dur: "1.0s", begin: "-0.66s" },
  { id: "pv1", d: "M880,143 C880,270 480,250 480,307",       c: "#06B6D4", dur: "2.6s", begin: "0s"     },
  { id: "pv2", d: "M880,143 C880,270 480,250 480,307",       c: "#06B6D4", dur: "2.6s", begin: "-1.3s"  },
  { id: "pq1", d: "M110,335 L250,335",                       c: "#3B82F6", dur: "1.8s", begin: "-0.2s"  },
  { id: "pq2", d: "M310,335 L450,335",                       c: "#8B5CF6", dur: "1.8s", begin: "-0.65s" },
  { id: "pq3", d: "M510,335 L650,335",                       c: "#8B5CF6", dur: "1.8s", begin: "-1.1s"  },
  { id: "pq4", d: "M710,335 L850,335",                       c: "#10B981", dur: "1.8s", begin: "-1.55s" },
  { id: "ps1", d: "M880,363 C880,432 80,432 80,363",         c: "#10B981", dur: "3.6s", begin: "0s"     },
  { id: "ps2", d: "M880,363 C880,432 80,432 80,363",         c: "#10B981", dur: "3.6s", begin: "-1.8s"  },
] as const;

function GearIcon() {
  return (
    <>
      <circle r="6" fill="none" stroke="#8B5CF6" strokeWidth="1.4" />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <line
          key={a}
          x1={Math.cos((a * Math.PI) / 180) * 6}
          y1={Math.sin((a * Math.PI) / 180) * 6}
          x2={Math.cos((a * Math.PI) / 180) * 13}
          y2={Math.sin((a * Math.PI) / 180) * 13}
          stroke="#8B5CF6"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
      ))}
    </>
  );
}

function DBIcon({ c }: { c: string }) {
  return (
    <>
      <ellipse cx="0" cy="-7" rx="9" ry="3.5" fill="none" stroke={c} strokeWidth="1.4" />
      <line x1="-9" y1="-7" x2="-9" y2="7" stroke={c} strokeWidth="1.4" />
      <line x1="9" y1="-7" x2="9" y2="7" stroke={c} strokeWidth="1.4" />
      <ellipse cx="0" cy="7" rx="9" ry="3.5" fill="none" stroke={c} strokeWidth="1.4" />
    </>
  );
}

function NeuralIcon({ c }: { c: string }) {
  return (
    <>
      <circle r="5" fill="none" stroke={c} strokeWidth="1.3" />
      {[0, 72, 144, 216, 288].map((a) => (
        <g key={a}>
          <line
            x1={Math.cos((a * Math.PI) / 180) * 5}
            y1={Math.sin((a * Math.PI) / 180) * 5}
            x2={Math.cos((a * Math.PI) / 180) * 12}
            y2={Math.sin((a * Math.PI) / 180) * 12}
            stroke={c}
            strokeWidth="1.3"
          />
          <circle
            cx={Math.cos((a * Math.PI) / 180) * 12}
            cy={Math.sin((a * Math.PI) / 180) * 12}
            r="2"
            fill={c}
            fillOpacity="0.5"
          />
        </g>
      ))}
    </>
  );
}

export default function WorkflowVisual() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const [hovered, setHovered] = useState(false);

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = wrapRef.current;
    if (!el) return;
    const { left, top, width, height } = el.getBoundingClientRect();
    setTilt({
      rx: -((e.clientY - top - height / 2) / (height / 2)) * 5,
      ry: ((e.clientX - left - width / 2) / (width / 2)) * 9,
    });
  }

  return (
    <div
      id="workflow-section"
      className="mt-20 max-w-6xl mx-auto relative"
      style={{ perspective: "1400px" }}
    >
      <div
        className="absolute -inset-16 pointer-events-none blur-3xl transition-opacity duration-700"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, rgba(0,90,194,0.45) 0%, rgba(124,58,237,0.22) 45%, transparent 70%)",
          opacity: hovered ? 0.45 : 0.22,
        }}
      />

      <div
        ref={wrapRef}
        onMouseMove={onMouseMove}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          setTilt({ rx: 0, ry: 0 });
          setHovered(false);
        }}
        className="hero-float relative rounded-2xl border border-white/[0.07] overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #07070a 0%, #0a0a10 100%)",
          transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
          transformStyle: "preserve-3d",
          transition: hovered
            ? "transform 0.1s ease-out"
            : "transform 0.6s cubic-bezier(0.23,1,0.32,1)",
          boxShadow:
            "0 50px 100px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#07070a] to-transparent pointer-events-none" />

        <div className="absolute top-5 left-6 right-6 flex items-center justify-between pointer-events-none z-10">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-mono text-white/25 uppercase tracking-[0.18em]">
              RAG Pipeline · Live
            </span>
          </div>
          <span className="text-[10px] font-mono text-white/20 uppercase tracking-wider">
            Cortex Architecture
          </span>
        </div>

        <svg
          viewBox="0 0 960 478"
          className="w-full h-auto"
          xmlns="http://www.w3.org/2000/svg"
          style={{ paddingTop: "52px", paddingBottom: "8px" }}
        >
          <defs>
            <filter id="wf-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {[
              { id: "ng-b",  c1: "#3B82F6" },
              { id: "ng-p",  c1: "#8B5CF6" },
              { id: "ng-c",  c1: "#06B6D4" },
              { id: "ng-e",  c1: "#10B981" },
            ].map(({ id, c1 }) => (
              <radialGradient key={id} id={id} cx="50%" cy="30%" r="70%">
                <stop offset="0%" stopColor={c1} stopOpacity="0.22" />
                <stop offset="100%" stopColor={c1} stopOpacity="0.04" />
              </radialGradient>
            ))}
          </defs>

          <text x="80"  y="54" fill="rgba(255,255,255,0.16)" fontSize="8.5" fontFamily="monospace" letterSpacing="3.5">UPLOAD PIPELINE</text>
          <text x="80"  y="298" fill="rgba(255,255,255,0.16)" fontSize="8.5" fontFamily="monospace" letterSpacing="3.5">QUERY PIPELINE</text>

          <path d="M110,115 L250,115" stroke="#3B82F6" strokeWidth="1" strokeOpacity="0.2" fill="none" />
          <path d="M310,115 L450,115" stroke="#3B82F6" strokeWidth="1" strokeOpacity="0.2" fill="none" />
          <path d="M510,115 L650,115" stroke="#8B5CF6" strokeWidth="1" strokeOpacity="0.2" fill="none" />
          <path d="M710,115 L850,115" stroke="#06B6D4" strokeWidth="1" strokeOpacity="0.2" fill="none" />
          <path d="M680,143 L580,182" stroke="#8B5CF6" strokeWidth="1" strokeOpacity="0.18" fill="none" strokeDasharray="3 3" />
          <path d="M680,143 L680,182" stroke="#8B5CF6" strokeWidth="1" strokeOpacity="0.18" fill="none" strokeDasharray="3 3" />
          <path d="M680,143 L780,182" stroke="#8B5CF6" strokeWidth="1" strokeOpacity="0.18" fill="none" strokeDasharray="3 3" />
          <path d="M880,143 C880,272 480,252 480,307" stroke="#06B6D4" strokeWidth="1" strokeOpacity="0.22" fill="none" strokeDasharray="5 4" />
          <text x="735" y="235" fill="rgba(6,182,212,0.35)" fontSize="8" fontFamily="monospace" textAnchor="middle">vector retrieval</text>
          <path d="M110,335 L250,335" stroke="#3B82F6" strokeWidth="1" strokeOpacity="0.2" fill="none" />
          <path d="M310,335 L450,335" stroke="#8B5CF6" strokeWidth="1" strokeOpacity="0.2" fill="none" />
          <path d="M510,335 L650,335" stroke="#8B5CF6" strokeWidth="1" strokeOpacity="0.2" fill="none" />
          <path d="M710,335 L850,335" stroke="#10B981" strokeWidth="1" strokeOpacity="0.2" fill="none" />
          <path d="M880,363 C880,432 80,432 80,363" stroke="#10B981" strokeWidth="1" strokeOpacity="0.15" fill="none" strokeDasharray="5 4" />
          <text x="480" y="450" fill="rgba(16,185,129,0.3)" fontSize="8.5" fontFamily="monospace" letterSpacing="2" textAnchor="middle">← STREAMED TO CLIENT VIA SSE</text>

          {PARTICLES.map(({ id, d, c, dur, begin }) => (
            <circle key={id} r="3.5" fill={c} filter="url(#wf-glow)">
              <animateMotion path={d} dur={dur} begin={begin} repeatCount="indefinite" calcMode="linear" />
            </circle>
          ))}


          <g transform="translate(80,115)">
            <circle r="28" fill="url(#ng-b)" />
            <circle r="28" fill="none" stroke="#3B82F6" strokeWidth="1.5" strokeOpacity="0.65" />
            <text textAnchor="middle" dy="6" fill="#3B82F6" fontSize="17" fontWeight="700" fontFamily="system-ui,sans-serif">G</text>
            <text textAnchor="middle" y="47" fill="rgba(255,255,255,0.4)" fontSize="9" fontFamily="system-ui,sans-serif">Google Auth</text>
          </g>

          <g transform="translate(280,115)">
            <circle r="28" fill="url(#ng-b)" />
            <circle r="28" fill="none" stroke="#3B82F6" strokeWidth="1.5" strokeOpacity="0.65" />
            <path d="M-11,5 C-15,-3 -8,-12 0,-12 C5,-12 10,-8 12,-3 C17,-3 21,2 18,7 C16,11 11,11 8,11 L-9,11 C-13,11 -16,7 -11,5Z" fill="none" stroke="#3B82F6" strokeWidth="1.4" />
            <text textAnchor="middle" y="47" fill="rgba(255,255,255,0.4)" fontSize="9" fontFamily="system-ui,sans-serif">S3 Upload</text>
          </g>

          <g transform="translate(480,115)">
            <circle r="28" fill="url(#ng-p)" />
            <circle r="28" fill="none" stroke="#8B5CF6" strokeWidth="1.5" strokeOpacity="0.65" />
            <line x1="-10" y1="-7" x2="10" y2="-7" stroke="#8B5CF6" strokeWidth="1.7" strokeLinecap="round" />
            <line x1="-10" y1="0"  x2="10" y2="0"  stroke="#8B5CF6" strokeWidth="1.7" strokeLinecap="round" />
            <line x1="-10" y1="7"  x2="10" y2="7"  stroke="#8B5CF6" strokeWidth="1.7" strokeLinecap="round" />
            <text textAnchor="middle" y="47" fill="rgba(255,255,255,0.4)" fontSize="9" fontFamily="system-ui,sans-serif">BullMQ</text>
          </g>

          <g transform="translate(680,115)">
            <circle r="28" fill="url(#ng-p)" />
            <circle r="28" fill="none" stroke="#8B5CF6" strokeWidth="1.5" strokeOpacity="0.65" />
            <GearIcon />
            <text textAnchor="middle" y="47" fill="rgba(255,255,255,0.4)" fontSize="9" fontFamily="system-ui,sans-serif">Worker</text>
          </g>

          <g transform="translate(880,115)">
            <circle r="28" fill="url(#ng-c)" />
            <circle r="28" fill="none" stroke="#06B6D4" strokeWidth="1.5" strokeOpacity="0.65" />
            <DBIcon c="#06B6D4" />
            <text textAnchor="middle" y="47" fill="rgba(255,255,255,0.4)" fontSize="9" fontFamily="system-ui,sans-serif">pgvector</text>
          </g>

          {[
            { x: 580, label: "Extract" },
            { x: 680, label: "Chunk" },
            { x: 780, label: "Embed" },
          ].map(({ x, label }) => (
            <g key={label} transform={`translate(${x},210)`}>
              <rect x="-34" y="-14" width="68" height="28" rx="6"
                fill="rgba(139,92,246,0.07)" stroke="#8B5CF6" strokeWidth="1" strokeOpacity="0.3" />
              <text textAnchor="middle" dy="4" fill="rgba(139,92,246,0.7)" fontSize="9" fontFamily="monospace">{label}</text>
            </g>
          ))}


          <g transform="translate(80,335)">
            <circle r="28" fill="url(#ng-b)" />
            <circle r="28" fill="none" stroke="#3B82F6" strokeWidth="1.5" strokeOpacity="0.65" />
            <path d="M-9,-8 L9,-8 C11,-8 12,-7 12,-5 L12,4 C12,6 11,7 9,7 L0,7 L-3,12 L-3,7 L-9,7 C-11,7 -12,6 -12,4 L-12,-5 C-12,-7 -11,-8 -9,-8Z"
              fill="none" stroke="#3B82F6" strokeWidth="1.4" />
            <text textAnchor="middle" y="47" fill="rgba(255,255,255,0.4)" fontSize="9" fontFamily="system-ui,sans-serif">User Query</text>
          </g>

          <g transform="translate(280,335)">
            <circle r="28" fill="url(#ng-b)" />
            <circle r="28" fill="none" stroke="#3B82F6" strokeWidth="1.5" strokeOpacity="0.65" />
            <path d="M-10,-1 L5,-1 L2,-4 M5,-1 L2,2"  fill="none" stroke="#3B82F6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10,1 L-5,1 L-2,4 M-5,1 L-2,-2" fill="none" stroke="#3B82F6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <text textAnchor="middle" y="47" fill="rgba(255,255,255,0.4)" fontSize="9" fontFamily="system-ui,sans-serif">Embedding</text>
          </g>

          <g transform="translate(480,335)">
            <circle r="28" fill="url(#ng-p)" />
            <circle r="28" fill="none" stroke="#8B5CF6" strokeWidth="1.5" strokeOpacity="0.65" />
            <circle cx="-2" cy="-2" r="8" fill="none" stroke="#8B5CF6" strokeWidth="1.5" />
            <line x1="4" y1="4" x2="10" y2="10" stroke="#8B5CF6" strokeWidth="2.2" strokeLinecap="round" />
            <text textAnchor="middle" y="47" fill="rgba(255,255,255,0.4)" fontSize="9" fontFamily="system-ui,sans-serif">Similarity</text>
          </g>

          <g transform="translate(680,335)">
            <circle r="28" fill="url(#ng-p)" />
            <circle r="28" fill="none" stroke="#8B5CF6" strokeWidth="1.5" strokeOpacity="0.65" />
            <NeuralIcon c="#8B5CF6" />
            <text textAnchor="middle" y="47" fill="rgba(255,255,255,0.4)" fontSize="9" fontFamily="system-ui,sans-serif">LLM</text>
          </g>

          <g transform="translate(880,335)">
            <circle r="28" fill="url(#ng-e)" />
            <circle r="28" fill="none" stroke="#10B981" strokeWidth="1.5" strokeOpacity="0.65" />
            <path d="M-8,0 L-2,7 L9,-7" fill="none" stroke="#10B981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <text textAnchor="middle" y="47" fill="rgba(255,255,255,0.4)" fontSize="9" fontFamily="system-ui,sans-serif">Response</text>
          </g>
        </svg>
      </div>

      <div
        className="absolute -bottom-8 left-16 right-16 h-16 blur-3xl rounded-full pointer-events-none transition-opacity duration-500"
        style={{
          background: "linear-gradient(to right, rgba(59,130,246,0.3), rgba(139,92,246,0.35), rgba(6,182,212,0.2))",
          opacity: hovered ? 0.7 : 0.35,
        }}
      />
    </div>
  );
}
