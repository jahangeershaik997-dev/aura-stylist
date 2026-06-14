"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import ProductPanel from "@/components/ProductPanel";
import type { FaceAnalysis, Product } from "@/types";

const FaceCanvas = dynamic(() => import("@/components/FaceCanvas"), {
  ssr: false,
  loading: () => (
    <div className="grid place-items-center bg-zinc-900 rounded-2xl w-full" style={{aspectRatio:"4/3"}}>
      <div className="flex flex-col items-center gap-3">
        <span className="h-8 w-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
        <p className="text-sm text-zinc-400">Loading camera…</p>
      </div>
    </div>
  ),
});

type View = "camera" | "studio";

export default function Home() {
  const [analysis, setAnalysis] = useState<FaceAnalysis | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [view, setView] = useState<View>("camera");

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-zinc-950/95 backdrop-blur px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold tracking-tight">AURA <span className="text-amber-400">✦</span></h1>
          <p className="text-[9px] text-zinc-500 tracking-widest uppercase">AI Stylist · AR Try-On · ECE Capstone</p>
        </div>
        {analysis && (
          <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-400 px-2 py-0.5 text-[10px] ring-1 ring-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Analyzed
          </span>
        )}
      </header>

      {/* Mobile tabs */}
      <div className="lg:hidden sticky top-[57px] z-40 bg-zinc-950/95 backdrop-blur px-4 py-2 border-b border-white/[0.05]">
        <div className="flex gap-1 rounded-full bg-zinc-900 p-1 ring-1 ring-white/10">
          <button onClick={() => setView("camera")}
            className={`flex-1 rounded-full py-2 text-xs font-semibold transition-all ${view === "camera" ? "bg-amber-400 text-zinc-950" : "text-zinc-400"}`}>
            📷 Camera
          </button>
          <button onClick={() => setView("studio")}
            className={`flex-1 rounded-full py-2 text-xs font-semibold transition-all ${view === "studio" ? "bg-amber-400 text-zinc-950" : "text-zinc-400"}`}>
            ✨ Style Studio {analysis && <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] text-white">✓</span>}
          </button>
        </div>
      </div>

      {/* Main */}
      <main className="flex-1 lg:grid lg:grid-cols-2 lg:gap-5 lg:p-5 lg:max-w-7xl lg:mx-auto lg:w-full">
        {/* Camera panel */}
        <section className={`${view === "camera" ? "flex" : "hidden"} lg:flex flex-col gap-3 p-4 lg:rounded-3xl lg:bg-zinc-900/40 lg:ring-1 lg:ring-white/[0.08]`}>
          <div className="hidden lg:flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-300">Live Face Analysis</h2>
            <span className="text-[10px] text-zinc-600 font-mono">MediaPipe FaceMesh · 468 landmarks</span>
          </div>
          <FaceCanvas
            selectedProduct={selected}
            onAnalyze={(a) => { setAnalysis(a); setView("studio"); }}
          />
          {selected && (
            <div className="flex items-center gap-2 rounded-xl bg-amber-400/10 px-3 py-2 ring-1 ring-amber-400/20 text-xs text-amber-300">
              <span className="text-amber-400">◈</span>
              AR active: <span className="font-semibold ml-1 truncate">{selected.name}</span>
              <button onClick={() => setSelected(null)} className="ml-auto text-zinc-500 hover:text-zinc-300">✕</button>
            </div>
          )}
          <p className="lg:hidden text-center text-xs text-zinc-600">
            After analysis → <button onClick={() => setView("studio")} className="text-amber-400 underline">view Style Studio</button>
          </p>
        </section>

        {/* Studio panel */}
        <section className={`${view === "studio" ? "flex" : "hidden"} lg:flex flex-col gap-3 p-4 lg:rounded-3xl lg:bg-zinc-900/40 lg:ring-1 lg:ring-white/[0.08] lg:max-h-[90vh] lg:overflow-hidden`}>
          <div className="flex items-center justify-between lg:mb-0 mb-1">
            <h2 className="text-sm font-semibold text-zinc-300">Style Studio</h2>
            <button onClick={() => setView("camera")} className="lg:hidden text-xs text-zinc-500 hover:text-zinc-300">← Camera</button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <ProductPanel
              analysis={analysis}
              selectedProduct={selected}
              onSelect={(p) => { setSelected(p); setView("camera"); }}
            />
          </div>
        </section>
      </main>

      {/* Footer with team */}
      <footer className="border-t border-white/[0.05] px-4 py-3 text-[10px] text-zinc-700">
        <div className="flex flex-col sm:flex-row justify-between gap-1">
          <span>Electronics & Communication Engineering · Final Year Capstone 2024–25</span>
          <span>
            Team: <a href="https://github.com/jahangeershaik997-dev" target="_blank" className="text-zinc-500 hover:text-amber-400 transition">jahangeershaik997-dev</a>
            {" · "}
            <a href="https://github.com/gousebajishaik4611-cpu" target="_blank" className="text-zinc-500 hover:text-amber-400 transition">gousebajishaik4611-cpu</a>
          </span>
        </div>
      </footer>
    </div>
  );
}
