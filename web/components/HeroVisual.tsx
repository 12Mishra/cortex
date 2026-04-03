"use client";

import { useRef, useState } from "react";

const IMG_SRC =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCFldnXjzpnaR-wkw1-Dnqb7HZHiumcZ-1IEaKufzhNgoG-n_GP-b6KoWp5n1NylvtlOdzLfRcWrLS2mUtNpugIKaKRMSMuDCfVVMMszzWXv6UinG0m2_Aci_6mhUbeJtnpo0aOz8ihGs3L5QgycTzUIDH0auIcC7dL7ZAK7lD9Br2D2u_xX38syWq-MRQ8d6kOurVY7C67a9ZHYPbONm2wzwfqzoM9k6qsyH_W0oTo53REMX5DiIm1Qv5sqt7S0y34LacRhwG2Tt0";

export default function HeroVisual() {
  const cardRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState("rotateX(0deg) rotateY(0deg)");
  const [glowPos, setGlowPos] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const rotateY = ((x - cx) / cx) * 12;
    const rotateX = -((y - cy) / cy) * 8;
    setTransform(`rotateX(${rotateX}deg) rotateY(${rotateY}deg)`);
    setGlowPos({ x: (x / rect.width) * 100, y: (y / rect.height) * 100 });
  }

  function onMouseLeave() {
    setTransform("rotateX(0deg) rotateY(0deg)");
    setGlowPos({ x: 50, y: 50 });
    setIsHovered(false);
  }

  return (
    <div className="mt-24 max-w-6xl mx-auto" style={{ perspective: "1200px" }}>
      {/* Ambient glow behind */}
      <div
        className="absolute -inset-8 blur-3xl transition-opacity duration-700 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at ${glowPos.x}% ${glowPos.y}%, rgba(0,90,194,0.35) 0%, rgba(221,183,255,0.15) 50%, transparent 70%)`,
          opacity: isHovered ? 0.7 : 0.3,
        }}
      />

      {/* 3D card */}
      <div
        ref={cardRef}
        onMouseMove={onMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={onMouseLeave}
        className="relative hero-float"
        style={{
          transform,
          transformStyle: "preserve-3d",
          transition: isHovered
            ? "transform 0.1s ease-out"
            : "transform 0.6s cubic-bezier(0.23, 1, 0.32, 1)",
          willChange: "transform",
        }}
      >
        {/* Card frame */}
        <div
          className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest overflow-hidden aspect-video shadow-2xl"
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt="Cortex Interface"
            className="w-full h-full object-cover"
            src={IMG_SRC}
          />

          {/* Gradient overlay bottom */}
          <div className="absolute inset-0 bg-linear-to-t from-surface-container-lowest via-transparent to-transparent" />

          {/* Dynamic specular highlight that moves with mouse */}
          <div
            className="absolute inset-0 pointer-events-none transition-opacity duration-300"
            style={{
              background: `radial-gradient(circle at ${glowPos.x}% ${glowPos.y}%, rgba(255,255,255,0.07) 0%, transparent 60%)`,
              opacity: isHovered ? 1 : 0,
            }}
          />

          {/* Top edge shine */}
          <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent" />
        </div>

        {/* Floating shadow beneath */}
        <div
          className="absolute -bottom-6 left-8 right-8 h-12 blur-2xl rounded-full pointer-events-none transition-all duration-500"
          style={{
            background: "rgba(0,90,194,0.4)",
            opacity: isHovered ? 0.8 : 0.4,
            transform: isHovered ? "scaleX(0.95)" : "scaleX(0.85)",
          }}
        />
      </div>
    </div>
  );
}
