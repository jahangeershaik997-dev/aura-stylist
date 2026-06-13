"use client";
import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import type { Product, ProductCategory, FaceAnalysis, StylistRecommendation } from "@/types";

interface Props {
  analysis: FaceAnalysis | null;
  selectedProduct: Product | null;
  onSelect: (p: Product) => void;
}

const TABS: { key: ProductCategory; label: string; emoji: string }[] = [
  { key: "accessories", label: "Accessories", emoji: "👓" },
  { key: "clothes",     label: "Clothes",     emoji: "👔" },
  { key: "skincare",    label: "Skincare",    emoji: "✨" },
];

function SkeletonCard() {
  return (
    <div className="rounded-2xl bg-zinc-900/60 ring-1 ring-white/10 animate-pulse overflow-hidden">
      <div className="aspect-square bg-zinc-800" />
      <div className="p-3 space-y-2">
        <div className="h-3 w-3/4 rounded bg-zinc-700" />
        <div className="h-3 w-1/2 rounded bg-zinc-800" />
      </div>
    </div>
  );
}

export default function ProductPanel({ analysis, selectedProduct, onSelect }: Props) {
  const [tab, setTab] = useState<ProductCategory>("accessories");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [rec, setRec] = useState<StylistRecommendation | null>(null);
  const [recLoading, setRecLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ category: tab, inStock: "true" });
    if (analysis) params.set("faceShape", analysis.faceShape);
    fetch(`/api/products?${params}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setProducts(d.products ?? []); })
      .catch(() => { if (!cancelled) setProducts([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tab, analysis]);

  const fetchStylist = useCallback(async (a: FaceAnalysis) => {
    setRecLoading(true);
    try {
      const res = await fetch("/api/stylist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis: a }),
      });
      const data = await res.json();
      setRec(data.recommendation ?? null);
    } catch { setRec(null); }
    finally { setRecLoading(false); }
  }, []);

  useEffect(() => { if (analysis) fetchStylist(analysis); }, [analysis, fetchStylist]);

  return (
    <div className="flex h-full flex-col gap-4">

      {/* Prompt before analysis */}
      {!analysis && (
        <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-zinc-500">
          Click <span className="text-amber-400 font-semibold">✦ Analyze My Face</span> on the left to get AI-powered style recommendations.
        </div>
      )}

      {/* Analysis result card */}
      {analysis && (
        <section className="rounded-2xl bg-zinc-900/60 p-4 ring-1 ring-white/10 space-y-3">
          <div className="flex items-center gap-3">
            <span className="h-12 w-12 flex-shrink-0 rounded-full ring-2 ring-white/20 shadow-lg" style={{ background: analysis.skinToneHex }} />
            <div>
              <p className="font-semibold capitalize text-zinc-100 text-sm">
                {analysis.faceShape} face · <span className="text-amber-400 capitalize">{analysis.seasonalTone}</span>
              </p>
              <p className="text-xs text-zinc-400 font-mono">{analysis.skinToneHex}</p>
            </div>
          </div>

          {recLoading && (
            <div className="flex items-center gap-2 text-sm text-amber-300/80">
              <span className="h-3 w-3 rounded-full bg-amber-400 animate-ping" />
              AI Stylist analyzing your profile…
            </div>
          )}

          {rec && (
            <div className="space-y-3 pt-2 border-t border-white/10">
              <p className="text-sm text-zinc-200 leading-relaxed">{rec.summary}</p>
              <div className="flex flex-wrap gap-2">
                {rec.colorPalette.map((c) => (
                  <div key={c.hex} className="group relative">
                    <span className="block h-8 w-8 rounded-lg ring-1 ring-white/20 cursor-help" style={{ background: c.hex }} />
                    <div className="pointer-events-none absolute bottom-10 left-1/2 -translate-x-1/2 z-10 hidden group-hover:block bg-zinc-800 text-xs text-zinc-100 rounded-lg px-2 py-1.5 w-36 shadow-xl ring-1 ring-white/10">
                      <p className="font-semibold">{c.name}</p>
                      <p className="text-zinc-400 font-mono text-[10px]">{c.hex}</p>
                      <p className="text-zinc-300 mt-0.5">{c.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-1">
                {rec.styleAdvice.map((tip, i) => (
                  <p key={i} className="text-xs text-zinc-300 flex gap-1.5">
                    <span className="text-amber-400">→</span> {tip}
                  </p>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Category tabs */}
      <div className="flex gap-1 rounded-full bg-zinc-900/60 p-1 ring-1 ring-white/10 flex-shrink-0">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold transition-all duration-200 ${
              tab === t.key ? "bg-amber-400 text-zinc-950 shadow" : "text-zinc-400 hover:text-zinc-200"
            }`}>
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-2 gap-3 overflow-y-auto pb-2">
        {loading && Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}

        {!loading && products.length === 0 && (
          <div className="col-span-2 py-10 text-center text-sm text-zinc-500">
            No items match your profile here.
          </div>
        )}

        {!loading && products.map((p) => {
          const active = selectedProduct?.id === p.id;
          const wearable = p.anchor !== "none";
          return (
            <button key={p.id} onClick={() => onSelect(p)}
              className={`group rounded-2xl overflow-hidden text-left ring-1 transition-all duration-200 ${
                active ? "ring-amber-400 scale-[0.97]" : "ring-white/10 hover:ring-white/30"
              }`}>
              {/* Product image - full bleed, no padding */}
              <div className="relative aspect-square w-full overflow-hidden bg-zinc-800">
                <Image
                  src={p.imageUrl}
                  alt={p.name}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="(max-width: 768px) 50vw, 200px"
                  unoptimized
                />
                {/* AR badge */}
                {wearable && (
                  <span className="absolute top-2 right-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-zinc-950 shadow">
                    AR
                  </span>
                )}
                {/* Active overlay */}
                {active && (
                  <div className="absolute inset-0 bg-amber-400/15 ring-2 ring-amber-400 ring-inset" />
                )}
              </div>
              {/* Name only — no price */}
              <div className="bg-zinc-900/80 px-3 py-2.5 flex items-center justify-between">
                <p className="text-xs font-semibold text-zinc-100 line-clamp-1">{p.name}</p>
                {wearable && <p className="text-[10px] text-amber-300 flex-shrink-0 ml-2">Try on →</p>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
