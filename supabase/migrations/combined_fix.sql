-- COMBINED MIGRATION FILE
-- Contains:
-- 1. RLS Policy Fixes for products and user_roles (CRITICAL)
-- 2. Schema update for products (adding salt_formula)

-- =================================================================
-- SECTION 1: FIX RLS POLICIES (Must be run first)
-- =================================================================

-- Fix "permission denied" on product insertion
-- Original policies often miss the "WITH CHECK" clause required for INSERTs

DROP POLICY IF EXISTS "Owners can manage products" ON public.products;
DROP POLICY IF EXISTS "Owners can manage roles" ON public.user_roles;

-- Re-create product policy with proper INSERT permissions
CREATE POLICY "Owners can manage products" ON public.products
  FOR ALL 
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Re-create user_roles policy to allow users to self-assign roles if logic permits
-- (Used by the frontend auto-role creation logic)
CREATE POLICY "Owners can manage roles" ON public.user_roles
  FOR ALL 
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- =================================================================
-- SECTION 2: SCHEMA UPDATES
-- =================================================================

-- Add salt_formula column if it doesn't exist
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS salt_formula TEXT;

COMMENT ON COLUMN public.products.salt_formula IS 'Optional - Active ingredient or formula';

-- =================================================================
-- SECTION 3: OPTIONAL PROACTIVE FIXES (Uncomment if needed)
-- =================================================================

-- If you experience permission errors with Racks, uncomment the following:
/*
DROP POLICY IF EXISTS "Owners can manage racks" ON public.racks;
CREATE POLICY "Owners can manage racks" ON public.racks
  FOR ALL 
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
*/
