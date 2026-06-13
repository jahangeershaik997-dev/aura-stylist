"use client";
// ============================================================================
// app/page.tsx — AURA split-screen parent. Manages all shared state.
// ============================================================================
import { useState } from "react";
import dynamic from "next/dynamic";
import ProductPanel from "@/components/ProductPanel";
import type { FaceAnalysis, Product } from "@/types";

const FaceCanvas = dynamic(() => import("@/components/FaceCanvas"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full min-h-[420px] place-items-center text-zinc-500 text-sm">
      <div className="flex flex-col items-center gap-2">
        <span className="h-8 w-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
        Loading vision engine…
      </div>
    </div>
  ),
});

export default function Home() {
  const [analysis, setAnalysis] = useState<FaceAnalysis | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="border-b border-white/[0.08] px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            AURA <span className="text-amber-400">✦</span>
          </h1>
          <p className="text-[11px] text-zinc-500 tracking-widest uppercase mt-0.5">
            AI Stylist · AR Try-On · Face Analysis
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          {analysis && (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 text-emerald-400 px-3 py-1 ring-1 ring-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Face detected
            </span>
          )}
          <span className="hidden sm:block">
            ECE Capstone 2024–25
          </span>
        </div>
      </header>

      {/* ── Split View ─────────────────────────────────────────────────── */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-5 p-5 max-w-7xl mx-auto w-full">

        {/* Left — Camera + AR canvas */}
        <section className="rounded-3xl bg-zinc-900/40 ring-1 ring-white/[0.08] p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-300">Live Face Analysis</h2>
            <span className="text-[10px] text-zinc-600 font-mono">
              MediaPipe FaceMesh · 468 landmarks
            </span>
          </div>
          <FaceCanvas selectedProduct={selected} onAnalyze={setAnalysis} />
          {selected && (
            <div className="flex items-center gap-2 rounded-xl bg-amber-400/10 px-4 py-2.5 ring-1 ring-amber-400/20 text-xs text-amber-300">
              <span className="text-amber-400">◈</span>
              AR overlay active: <span className="font-semibold ml-1">{selected.name}</span>
              <button
                onClick={() => setSelected(null)}
                className="ml-auto text-zinc-500 hover:text-zinc-300"
              >
                ✕ remove
              </button>
            </div>
          )}
        </section>

        {/* Right — Products + Stylist */}
        <section className="rounded-3xl bg-zinc-900/40 ring-1 ring-white/[0.08] p-5 flex flex-col gap-3 max-h-[90vh] overflow-hidden">
          <div className="flex items-center justify-between flex-shrink-0">
            <h2 className="text-sm font-semibold text-zinc-300">Style Studio</h2>
            <span className="text-[10px] text-zinc-600 font-mono">
              claude-sonnet-4-6 · Supabase-ready
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            <ProductPanel
              analysis={analysis}
              selectedProduct={selected}
              onSelect={setSelected}
            />
          </div>
        </section>

      </main>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.05] px-6 py-3 text-[10px] text-zinc-700 flex justify-between">
        <span>Electronics & Communication Engineering · Final Year Project</span>
        <span>Deployed on Vercel · CI/CD via GitHub</span>
      </footer>
    </div>
  );
}
