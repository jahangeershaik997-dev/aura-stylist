"use client";
// ============================================================================
// components/ProductPanel.tsx — Right panel with product images, tabs, and
// AI stylist recommendation display.
// ============================================================================
import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import type {
  Product,
  ProductCategory,
  FaceAnalysis,
  StylistRecommendation,
} from "@/types";

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
    <div className="rounded-xl bg-zinc-900/60 p-3 ring-1 ring-white/10 animate-pulse">
      <div className="aspect-square rounded-lg bg-zinc-800" />
      <div className="mt-2 h-3 w-3/4 rounded bg-zinc-700" />
      <div className="mt-1 h-3 w-1/2 rounded bg-zinc-800" />
    </div>
  );
}

export default function ProductPanel({ analysis, selectedProduct, onSelect }: Props) {
  const [tab, setTab] = useState<ProductCategory>("accessories");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [rec, setRec] = useState<StylistRecommendation | null>(null);
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ category: tab, inStock: "true" });
    if (analysis) params.set("faceShape", analysis.faceShape);

    fetch(`/api/products?${params}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setProducts(d.products ?? []); })
      .catch(() => { if (!cancelled) setProducts([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tab, analysis]);

  const fetchStylist = useCallback(async (a: FaceAnalysis) => {
    setRecLoading(true);
    setRecError(null);
    try {
      const res = await fetch("/api/stylist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis: a }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setRec(data.recommendation ?? null);
    } catch (e) {
      setRecError(e instanceof Error ? e.message : "Stylist unavailable.");
    } finally {
      setRecLoading(false);
    }
  }, []);

  useEffect(() => {
    if (analysis) fetchStylist(analysis);
  }, [analysis, fetchStylist]);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pr-1">

      {/* ── Analysis Summary Card ─────────────────────────────────────── */}
      {!analysis && (
        <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-zinc-500">
          Click <span className="text-amber-400 font-medium">Analyze my face</span> on
          the left to get personalized recommendations.
        </div>
      )}

      {analysis && (
        <section className="rounded-2xl bg-zinc-900/60 p-4 ring-1 ring-white/10 space-y-3">
          <div className="flex items-center gap-3">
            <span
              className="h-11 w-11 flex-shrink-0 rounded-full ring-2 ring-white/20 shadow-lg"
              style={{ background: analysis.skinToneHex }}
              title={`Skin tone: ${analysis.skinToneHex}`}
            />
            <div>
              <p className="font-semibold capitalize text-zinc-100 text-sm">
                {analysis.faceShape} face &middot;{" "}
                <span className="text-amber-400 capitalize">{analysis.seasonalTone}</span>
              </p>
              <p className="text-xs text-zinc-400 font-mono">{analysis.skinToneHex}</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                PD {(analysis.metrics.pupillaryDistance * 100).toFixed(1)}% &middot;
                W:H {analysis.metrics.faceWidthRatio.toFixed(2)}
              </p>
            </div>
          </div>

          {recLoading && (
            <div className="flex items-center gap-2 text-sm text-amber-300/80">
              <span className="inline-block h-3 w-3 rounded-full bg-amber-400 animate-ping" />
              Consulting AI stylist…
            </div>
          )}

          {recError && (
            <p className="text-xs text-rose-400">{recError}</p>
          )}

          {rec && (
            <div className="space-y-3 pt-1 border-t border-white/10">
              <p className="text-sm text-zinc-200 leading-relaxed">{rec.summary}</p>

              {/* Palette swatches */}
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs text-zinc-500 w-full">Your palette</span>
                {rec.colorPalette.map((c) => (
                  <div key={c.hex} className="group relative">
                    <span
                      className="block h-8 w-8 rounded-lg ring-1 ring-white/20 cursor-help"
                      style={{ background: c.hex }}
                    />
                    <div className="pointer-events-none absolute bottom-10 left-1/2 -translate-x-1/2 z-10 hidden group-hover:block bg-zinc-800 text-xs text-zinc-100 rounded-lg px-2 py-1 w-36 shadow-xl ring-1 ring-white/10">
                      <p className="font-semibold">{c.name}</p>
                      <p className="text-zinc-400 font-mono">{c.hex}</p>
                      <p className="text-zinc-300 mt-0.5">{c.reason}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Style tips */}
              <div className="space-y-1">
                <p className="text-xs text-zinc-500">Style tips</p>
                {rec.styleAdvice.map((tip, i) => (
                  <p key={i} className="text-xs text-zinc-300 flex gap-1.5">
                    <span className="text-amber-400 flex-shrink-0">→</span> {tip}
                  </p>
                ))}
              </div>

              {/* Avoid */}
              <div className="space-y-1">
                <p className="text-xs text-zinc-500">Avoid</p>
                {rec.avoid.map((a, i) => (
                  <p key={i} className="text-xs text-zinc-400 flex gap-1.5">
                    <span className="text-rose-400 flex-shrink-0">✕</span> {a}
                  </p>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── Category Tabs ──────────────────────────────────────────────── */}
      <div className="flex gap-1 rounded-full bg-zinc-900/60 p-1 ring-1 ring-white/10">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-full px-3 py-2 text-xs font-medium transition-all duration-200 ${
              tab === t.key
                ? "bg-amber-400 text-zinc-950 shadow"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* ── Product Grid ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        {loading && Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}

        {!loading && products.length === 0 && (
          <div className="col-span-2 py-10 text-center text-sm text-zinc-500">
            No items match your profile in this category.
          </div>
        )}

        {!loading && products.map((p) => {
          const active = selectedProduct?.id === p.id;
          const wearable = p.anchor !== "none";
          return (
            <button
              key={p.id}
              onClick={() => onSelect(p)}
              className={`group rounded-xl bg-zinc-900/60 p-3 text-left ring-1 transition-all duration-200 ${
                active
                  ? "ring-amber-400 bg-zinc-800/80 scale-[0.98]"
                  : "ring-white/10 hover:ring-white/30 hover:bg-zinc-800/50"
              }`}
            >
              <div className="relative aspect-square rounded-lg overflow-hidden bg-zinc-800">
                <Image
                  src={p.imageUrl}
                  alt={p.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 50vw, 200px"
                />
                {wearable && (
                  <span className="absolute top-2 right-2 rounded-full bg-amber-400/90 px-1.5 py-0.5 text-[10px] font-bold text-zinc-950">
                    AR
                  </span>
                )}
                {active && (
                  <div className="absolute inset-0 bg-amber-400/10 ring-2 ring-amber-400 ring-inset rounded-lg" />
                )}
              </div>
              <p className="mt-2 line-clamp-1 text-sm font-medium text-zinc-100">
                {p.name}
              </p>
              <div className="flex items-center justify-between mt-0.5">
                <p className="text-xs text-zinc-400">
                  ₹{p.price.toLocaleString("en-IN")}
                </p>
                {wearable && (
                  <p className="text-[10px] text-amber-300">Try on →</p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
