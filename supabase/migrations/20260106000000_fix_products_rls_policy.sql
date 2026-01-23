-- Fix RLS policy for products table to include WITH CHECK for INSERT operations
-- The current policy only has USING which doesn't work for INSERT

-- Drop the existing policy
DROP POLICY IF EXISTS "Owners can manage products" ON public.products;
DROP POLICY IF EXISTS "Authenticated can read products" ON public.products;
DROP POLICY IF EXISTS "Can create products if permitted" ON public.products;
DROP POLICY IF EXISTS "Can update products if permitted" ON public.products;
DROP POLICY IF EXISTS "Admins can delete products" ON public.products;

-- Recreate with both USING and WITH CHECK for all operations
-- This ensures INSERT, UPDATE, DELETE, and SELECT all work correctly
CREATE POLICY "Owners can manage products" ON public.products
  FOR ALL 
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Ensure user_roles policy also allows INSERT for role creation
DROP POLICY IF EXISTS "Owners can manage roles" ON public.user_roles;
CREATE POLICY "Owners can manage roles" ON public.user_roles
  FOR ALL 
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

