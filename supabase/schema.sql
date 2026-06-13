-- ============================================================================
-- supabase/schema.sql — Run in Supabase SQL Editor to go live.
-- Mirrors the Product TypeScript contract. snake_case columns.
-- ============================================================================

create type product_category as enum ('clothes', 'accessories', 'skincare');
create type anchor_type as enum ('eyes', 'forehead', 'chin', 'none');

create table if not exists products (
  id            text primary key,
  name          text not null,
  category      product_category not null,
  price         numeric(10,2) not null,
  currency      text not null default 'INR',
  image_url     text not null,
  overlay_url   text,
  anchor        anchor_type not null default 'none',
  face_shapes   text[] not null default '{}',
  seasonal_tones text[] not null default '{}',
  description   text not null default '',
  in_stock      boolean not null default true,
  created_at    timestamptz not null default now()
);

create index if not exists idx_products_category on products (category);
create index if not exists idx_products_face_shapes on products using gin (face_shapes);
create index if not exists idx_products_seasonal on products using gin (seasonal_tones);

-- ---- Row Level Security --------------------------------------------------
-- The anon key (NEXT_PUBLIC_SUPABASE_ANON_KEY) is public, so RLS must allow
-- ONLY read access to in-stock products. Writes go through the service role
-- key, which bypasses RLS and lives server-side only.
alter table products enable row level security;

create policy "public read in-stock"
  on products for select
  to anon
  using (in_stock = true);

-- Seed: see supabase/seed.sql (generated from lib/products/mockData.ts).
