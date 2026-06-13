# AURA — AI Stylist & AR Try-On

ECE Capstone · Next.js 15 (App Router) · MediaPipe FaceMesh · Claude · Supabase-ready

---

## 1. Production Infrastructure & CI/CD Architecture

```
 ┌─────────────┐   git push    ┌──────────────┐   webhook    ┌─────────────────┐
 │  Local Dev  │ ───────────▶ │    GitHub    │ ───────────▶ │     Vercel      │
 │  (your PC)  │   main/PR     │   repo       │   push event │  Build Pipeline │
 └─────────────┘               └──────────────┘              └────────┬────────┘
                                                                       │
                          ┌────────────────────────────────────────────┘
                          ▼
        ┌──────────────────────────────────────────────┐
        │ 1. npm install                                │
        │ 2. next build  (compiles app + API routes)    │
        │ 3. Env vars injected from Vercel project       │
        │    settings (NOT from the repo)                │
        │ 4. Static assets → CDN edge                    │
        │ 5. /api/* routes → serverless functions        │
        └───────────────────────┬──────────────────────┘
                                 ▼
        ┌──────────────────────────────────────────────┐
        │ Preview deploy (per PR) + Production (on main) │
        │ Secrets live ONLY in the serverless runtime.   │
        │ ANTHROPIC_API_KEY / SERVICE_ROLE never shipped │
        │ to the browser bundle.                         │
        └──────────────────────────────────────────────┘
```

**Step-by-step flow**

1. You commit and `git push` to GitHub.
2. GitHub fires a webhook to Vercel (the GitHub↔Vercel integration registers it
   automatically on first import).
3. Vercel checks out the commit, runs `npm install`, then `next build`.
4. During build/runtime, Vercel injects environment variables from
   **Project → Settings → Environment Variables** — never from the repo. The repo
   only ever contains `.env.local.example`.
5. `NEXT_PUBLIC_*` vars are inlined into the client bundle at build time. All
   other vars stay in the serverless function runtime only.
6. Static pages/assets deploy to the edge CDN; `/api/products` and `/api/stylist`
   deploy as Node serverless functions.
7. Every PR gets an isolated Preview URL; merging to `main` promotes to Production.

---

## 2. Environment Variable Blueprint

See `.env.local.example`. Summary:

| Variable | Scope | Why |
|---|---|---|
| `DATA_SOURCE` | server | `mock` or `supabase` — the live-data toggle |
| `ANTHROPIC_API_KEY` | **server only** | secret; read only inside `/api/stylist` |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | bypasses RLS; never client |
| `NEXT_PUBLIC_SUPABASE_URL` | client-safe | public project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client-safe | safe **only** because RLS limits it |
| `NEXT_PUBLIC_APP_NAME` | client-safe | display string |

Rule: if it has no `NEXT_PUBLIC_` prefix, it physically cannot reach the browser
bundle in Next.js. Keep every credential unprefixed.

---

## 3. Going live with Supabase (final-review switch)

1. Create a Supabase project.
2. SQL Editor → run `supabase/schema.sql`, then `supabase/seed.sql`.
3. Fill the four Supabase env vars (URL + anon + service role) in Vercel.
4. Set `DATA_SOURCE=supabase`.
5. Redeploy. No code changes — the repository pattern in
   `lib/products/dataSource.ts` swaps implementations at runtime.

---

## 4. Local setup (PowerShell — Windows)

See `SETUP.ps1` in this repo for the full scaffold-from-scratch script.
If you already have these files, just:

```powershell
npm install
Copy-Item .env.local.example .env.local
# edit .env.local, paste your ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000 and allow camera access.

---

## File map

```
app/
  layout.tsx              Root layout
  page.tsx                Split-view parent (client state hub)
  globals.css             Tailwind + reduced-motion
  api/products/route.ts   Inventory endpoint (typed, validated)
  api/stylist/route.ts    Claude stylist engine (server secret)
components/
  FaceCanvas.tsx          Webcam + FaceMesh + AR overlay (left)
  ProductPanel.tsx        Tabs + grid + stylist results (right)
lib/
  ar/transform.ts         Affine transform math + classifiers (DSP core)
  products/dataSource.ts  Repository abstraction (mock ↔ supabase)
  products/mockData.ts    Seed catalog
  supabase/server.ts      Service-role client (server-only)
types/index.ts            Cross-layer contracts
supabase/
  schema.sql              Tables, indexes, RLS
  seed.sql                Seed rows
ABSTRACT.md               300-word ECE review abstract
```
