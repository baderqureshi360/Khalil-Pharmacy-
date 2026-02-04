-- File: supabase/migrations/20260105000000_add_salt_formula_to_products.sql
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS salt_formula TEXT;

COMMENT ON COLUMN public.products.salt_formula IS 'Optional - Active ingredient or formula';
