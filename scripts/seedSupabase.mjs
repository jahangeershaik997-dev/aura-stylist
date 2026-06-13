// ============================================================================
// scripts/seedSupabase.mjs — Run this ONCE to push the catalog to Supabase.
// Usage:
//   node scripts/seedSupabase.mjs
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
// ============================================================================
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));

// Parse .env.local manually (no dotenv dep needed)
function loadEnv() {
  const envPath = resolve(__dir, "../.env.local");
  const lines = readFileSync(envPath, "utf-8").split("\n");
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

const env = loadEnv();
const url = env["NEXT_PUBLIC_SUPABASE_URL"];
const key = env["SUPABASE_SERVICE_ROLE_KEY"];

if (!url || !key || key.startsWith("eyJh") === false) {
  console.error("❌  Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PRODUCTS = [
  { id:"acc-001", name:"Aviator Frames — Gold",       category:"accessories", price:2499, currency:"INR", image_url:"/products/aviator-gold.png",    overlay_url:"/overlays/aviator-gold.png",    anchor:"eyes",     face_shapes:["square","heart","oval"],                         seasonal_tones:["autumn","spring"],          description:"Lightweight teardrop aviators with a warm gold finish.",                         in_stock:true },
  { id:"acc-002", name:"Rounded Acetate — Tortoise",  category:"accessories", price:1899, currency:"INR", image_url:"/products/round-tortoise.png",  overlay_url:"/overlays/round-tortoise.png",  anchor:"eyes",     face_shapes:["square","oblong","diamond"],                     seasonal_tones:["autumn","winter"],          description:"Soft round acetate frames that offset angular jawlines.",                        in_stock:true },
  { id:"acc-003", name:"Wayfarer — Matte Black",      category:"accessories", price:2199, currency:"INR", image_url:"/products/wayfarer-black.png",  overlay_url:"/overlays/wayfarer-black.png",  anchor:"eyes",     face_shapes:["round","oval","heart"],                          seasonal_tones:["winter","summer"],          description:"Bold squared frames that add structure to softer faces.",                        in_stock:true },
  { id:"acc-004", name:"Felt Fedora — Camel",         category:"accessories", price:1599, currency:"INR", image_url:"/products/fedora-camel.png",    overlay_url:"/overlays/fedora-camel.png",    anchor:"forehead", face_shapes:["oval","round","heart"],                          seasonal_tones:["autumn","spring"],          description:"Wide-brim camel fedora that elongates rounder faces.",                          in_stock:true },
  { id:"clo-001", name:"Linen Shirt — Sage",          category:"clothes",     price:1799, currency:"INR", image_url:"/products/linen-sage.png",      overlay_url:null,                            anchor:"none",     face_shapes:["oval","oblong","diamond"],                       seasonal_tones:["spring","summer"],          description:"Breathable sage linen — flatters cool, muted complexions.",                     in_stock:true },
  { id:"clo-002", name:"Merino Crew — Charcoal",      category:"clothes",     price:2999, currency:"INR", image_url:"/products/merino-charcoal.png", overlay_url:null,                            anchor:"none",     face_shapes:["round","heart","square"],                        seasonal_tones:["winter","summer"],          description:"Deep charcoal merino with high contrast for winter tones.",                     in_stock:true },
  { id:"clo-003", name:"Oxford Shirt — Rust",         category:"clothes",     price:2199, currency:"INR", image_url:"/products/oxford-rust.png",     overlay_url:null,                            anchor:"none",     face_shapes:["square","oval"],                                 seasonal_tones:["autumn"],                   description:"Earthy rust oxford that warms autumn complexions.",                             in_stock:false },
  { id:"skn-001", name:"Hydrating SPF 50 — Universal",category:"skincare",    price:899,  currency:"INR", image_url:"/products/spf50.png",           overlay_url:null,                            anchor:"none",     face_shapes:["oval","round","square","heart","oblong","diamond"],seasonal_tones:["spring","summer","autumn","winter"], description:"Lightweight broad-spectrum SPF, no white cast on deeper tones.", in_stock:true },
  { id:"skn-002", name:"Warm-Tone Tinted Balm",       category:"skincare",    price:749,  currency:"INR", image_url:"/products/tinted-warm.png",     overlay_url:null,                            anchor:"none",     face_shapes:["oval","round","square","heart","oblong","diamond"],seasonal_tones:["autumn","spring"],           description:"Sheer balm tuned for warm undertones and golden skin.",                         in_stock:true },
  { id:"skn-003", name:"Cool-Tone Brightening Serum", category:"skincare",    price:1299, currency:"INR", image_url:"/products/serum-cool.png",      overlay_url:null,                            anchor:"none",     face_shapes:["oval","round","square","heart","oblong","diamond"],seasonal_tones:["summer","winter"],           description:"Vitamin-C serum that evens cool, pink-based complexions.",                      in_stock:true },
];

async function seed() {
  console.log("🌱  Seeding products table in Supabase…");

  // Upsert so re-running is safe.
  const { data, error } = await supabase
    .from("products")
    .upsert(PRODUCTS, { onConflict: "id" });

  if (error) {
    console.error("❌  Seed failed:", error.message);
    process.exit(1);
  }

  console.log(`✅  Seeded ${PRODUCTS.length} products. Run DATA_SOURCE=supabase to use them.`);
}

seed();
