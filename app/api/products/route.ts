// ============================================================================
// app/api/products/route.ts — Inventory endpoint (App Router, runtime=nodejs)
// GET /api/products?category=accessories&faceShape=oval&inStock=true
// ============================================================================
import { NextRequest, NextResponse } from "next/server";
import { getProductRepository } from "@/lib/products/dataSource";
import type { ProductCategory } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // never statically cache inventory

const VALID_CATEGORIES: ProductCategory[] = [
  "clothes",
  "accessories",
  "skincare",
];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const categoryParam = searchParams.get("category");

    if (categoryParam && !VALID_CATEGORIES.includes(categoryParam as ProductCategory)) {
      return NextResponse.json(
        { error: `Invalid category. Use one of: ${VALID_CATEGORIES.join(", ")}` },
        { status: 400 }
      );
    }

    const repo = getProductRepository();
    const products = await repo.list({
      category: (categoryParam as ProductCategory) ?? undefined,
      faceShape: searchParams.get("faceShape") ?? undefined,
      seasonalTone: searchParams.get("seasonalTone") ?? undefined,
      inStockOnly: searchParams.get("inStock") === "true",
    });

    return NextResponse.json(
      { count: products.length, products },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[/api/products] failure:", err);
    return NextResponse.json(
      { error: "Could not load inventory. Try again." },
      { status: 500 }
    );
  }
}
