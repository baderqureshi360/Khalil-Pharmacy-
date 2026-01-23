-- Performance optimization: Add indexes for frequently queried fields
-- This migration adds indexes to improve query performance without changing schema

-- Index for product name searches (used in POS and Products page filtering)
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products(name);

-- Index for product rack_id filtering (used in Products page)
CREATE INDEX IF NOT EXISTS idx_products_rack_id ON public.products(rack_id);

-- Composite index for stock_batches queries (product_id + expiry_date for FEFO)
-- This significantly improves queries that filter by product and expiry date
CREATE INDEX IF NOT EXISTS idx_stock_batches_product_expiry ON public.stock_batches(product_id, expiry_date);

-- Index for stock_batches quantity queries (used in stock calculations)
CREATE INDEX IF NOT EXISTS idx_stock_batches_quantity ON public.stock_batches(quantity) WHERE quantity > 0;

-- Index for sale_items product_id lookups
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON public.sale_items(product_id);

-- Index for sale_items sale_id lookups
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON public.sale_items(sale_id);

-- Index for sales created_at sorting (used in sales reports)
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(created_at DESC);
