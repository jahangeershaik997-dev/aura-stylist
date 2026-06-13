// ============================================================================
// lib/products/dataSource.ts — The abstraction that makes the demo "real".
//
// Both implementations satisfy ProductRepository. The API route depends only
// on this interface, so flipping DATA_SOURCE=supabase streams live cloud data
// with ZERO changes to route handlers or the UI.
// ============================================================================
import "server-only";
import type { Product, ProductCategory } from "@/types";
import { MOCK_PRODUCTS } from "./mockData";

export interface ProductQuery {
  category?: ProductCategory;
  faceShape?: string;
  seasonalTone?: string;
  inStockOnly?: boolean;
}

export interface ProductRepository {
  list(query: ProductQuery): Promise<Product[]>;
  getById(id: string): Promise<Product | null>;
}

// ---------------------------------------------------------------------------
// In-memory mock repository
// ---------------------------------------------------------------------------
class MockRepository implements ProductRepository {
  async list(query: ProductQuery): Promise<Product[]> {
    return MOCK_PRODUCTS.filter((p) => {
      if (query.category && p.category !== query.category) return false;
      if (query.inStockOnly && !p.inStock) return false;
      if (query.faceShape && !p.faceShapes.includes(query.faceShape as never))
        return false;
      if (
        query.seasonalTone &&
        !p.seasonalTones.includes(query.seasonalTone as never)
      )
        return false;
      return true;
    });
  }

  async getById(id: string): Promise<Product | null> {
    return MOCK_PRODUCTS.find((p) => p.id === id) ?? null;
  }
}

// ---------------------------------------------------------------------------
// Supabase repository — same contract, live data
// ---------------------------------------------------------------------------
class SupabaseRepository implements ProductRepository {
  async list(query: ProductQuery): Promise<Product[]> {
    const { getServiceClient } = await import("@/lib/supabase/server");
    let q = getServiceClient().from("products").select("*");

    if (query.category) q = q.eq("category", query.category);
    if (query.inStockOnly) q = q.eq("in_stock", true);
    if (query.faceShape) q = q.contains("face_shapes", [query.faceShape]);
    if (query.seasonalTone)
      q = q.contains("seasonal_tones", [query.seasonalTone]);

    const { data, error } = await q;
    if (error) throw new Error(`Supabase list failed: ${error.message}`);
    return (data ?? []).map(mapRow);
  }

  async getById(id: string): Promise<Product | null> {
    const { getServiceClient } = await import("@/lib/supabase/server");
    const { data, error } = await getServiceClient()
      .from("products")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`Supabase getById failed: ${error.message}`);
    return data ? mapRow(data) : null;
  }
}

// snake_case (Postgres) -> camelCase (app contract)
function mapRow(row: Record<string, unknown>): Product {
  return {
    id: row.id as string,
    name: row.name as string,
    category: row.category as Product["category"],
    price: Number(row.price),
    currency: (row.currency as string) ?? "INR",
    imageUrl: row.image_url as string,
    overlayUrl: (row.overlay_url as string) ?? null,
    anchor: (row.anchor as Product["anchor"]) ?? "none",
    faceShapes: (row.face_shapes as Product["faceShapes"]) ?? [],
    seasonalTones: (row.seasonal_tones as Product["seasonalTones"]) ?? [],
    description: (row.description as string) ?? "",
    inStock: Boolean(row.in_stock),
  };
}

// ---------------------------------------------------------------------------
// Factory — selected at runtime by the DATA_SOURCE env flag
// ---------------------------------------------------------------------------
export function getProductRepository(): ProductRepository {
  return process.env.DATA_SOURCE === "supabase"
    ? new SupabaseRepository()
    : new MockRepository();
}
