# ============================================================================
# SETUP.ps1 — AURA "4th year project" bootstrap for Windows PowerShell
# Run from wherever you want to place the project:
#   PS C:\dev> .\SETUP.ps1
# ============================================================================

$ErrorActionPreference = "Stop"
$ProjectFolder = "4th year project"

Write-Host ""
Write-Host "  AURA — 4th Year Project Setup" -ForegroundColor Cyan
Write-Host "  ================================" -ForegroundColor Cyan
Write-Host ""

# ── Prerequisite checks ─────────────────────────────────────────────────────
function Check($cmd, $label, $url) {
    try { $v = & $cmd --version 2>&1; Write-Host "  ✔ $label : $v" -ForegroundColor Green }
    catch { Write-Host "  ✘ $label not found. Install from $url" -ForegroundColor Red; exit 1 }
}
Check "node" "Node.js (18.18+ required)" "https://nodejs.org"
Check "npm"  "npm"                        "https://nodejs.org"
Check "git"  "Git"                        "https://git-scm.com"
Write-Host ""

# ── Create folder structure ──────────────────────────────────────────────────
Write-Host "==> Creating '4th year project' folder structure..." -ForegroundColor Cyan

$dirs = @(
    "$ProjectFolder\app\api\products",
    "$ProjectFolder\app\api\stylist",
    "$ProjectFolder\components",
    "$ProjectFolder\lib\products",
    "$ProjectFolder\lib\ar",
    "$ProjectFolder\lib\supabase",
    "$ProjectFolder\types",
    "$ProjectFolder\supabase",
    "$ProjectFolder\scripts",
    "$ProjectFolder\public\products",
    "$ProjectFolder\public\overlays"
)
foreach ($d in $dirs) { New-Item -ItemType Directory -Force -Path $d | Out-Null }
Write-Host "  ✔ All directories created." -ForegroundColor Green

# ── Instruction: copy source files ──────────────────────────────────────────
Write-Host ""
Write-Host "==> Now copy these files from the Cowork download into '$ProjectFolder\':" -ForegroundColor Yellow
Write-Host "    types\index.ts"                       -ForegroundColor Gray
Write-Host "    lib\ar\transform.ts"                  -ForegroundColor Gray
Write-Host "    lib\products\mockData.ts"             -ForegroundColor Gray
Write-Host "    lib\products\dataSource.ts"           -ForegroundColor Gray
Write-Host "    lib\supabase\server.ts"               -ForegroundColor Gray
Write-Host "    app\layout.tsx"                       -ForegroundColor Gray
Write-Host "    app\page.tsx"                         -ForegroundColor Gray
Write-Host "    app\globals.css"                      -ForegroundColor Gray
Write-Host "    app\api\products\route.ts"            -ForegroundColor Gray
Write-Host "    app\api\stylist\route.ts"             -ForegroundColor Gray
Write-Host "    components\FaceCanvas.tsx"            -ForegroundColor Gray
Write-Host "    components\ProductPanel.tsx"          -ForegroundColor Gray
Write-Host "    scripts\seedSupabase.mjs"             -ForegroundColor Gray
Write-Host "    package.json  tsconfig.json"          -ForegroundColor Gray
Write-Host "    tailwind.config.ts  postcss.config.js  next.config.ts" -ForegroundColor Gray
Write-Host "    vercel.json  .env.local.example  .gitignore" -ForegroundColor Gray
Write-Host "    supabase\schema.sql  supabase\seed.sql" -ForegroundColor Gray
Write-Host "    public\products\*.png  public\overlays\*.png" -ForegroundColor Gray
Write-Host ""

# ── Offer to run install if package.json already present ────────────────────
Set-Location $ProjectFolder

if (Test-Path "package.json") {
    Write-Host "==> package.json found. Installing dependencies..." -ForegroundColor Cyan
    npm install

    if (-not (Test-Path ".env.local")) {
        Copy-Item ".env.local.example" ".env.local"
        Write-Host "  ✔ .env.local created from example." -ForegroundColor Green
        Write-Host "  → Open .env.local and paste your ANTHROPIC_API_KEY!" -ForegroundColor Yellow
    }

    if (-not (Test-Path ".git")) {
        Write-Host "==> Initialising git repository..." -ForegroundColor Cyan
        git init | Out-Null
        git add .
        git commit -m "feat: AURA capstone initial commit" | Out-Null
        Write-Host "  ✔ Git repo initialised." -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "  ALL DONE. Next steps:" -ForegroundColor Green
    Write-Host ""
    Write-Host "  1. Edit .env.local  →  paste your ANTHROPIC_API_KEY"
    Write-Host "  2. npm run dev      →  open http://localhost:3000"
    Write-Host "  3. Push to GitHub:"
    Write-Host "       git remote add origin https://github.com/<you>/aura-stylist.git"
    Write-Host "       git branch -M main"
    Write-Host "       git push -u origin main"
    Write-Host "  4. Import at vercel.com → add env vars → deploy automatically."
    Write-Host "  5. To go live with Supabase:"
    Write-Host "       Run supabase\schema.sql in Supabase SQL Editor"
    Write-Host "       node scripts\seedSupabase.mjs"
    Write-Host "       Set DATA_SOURCE=supabase in Vercel env vars"
    Write-Host ""
} else {
    Write-Host "  Waiting for source files. Once copied, re-run this script or run 'npm install' manually." -ForegroundColor Yellow
}
