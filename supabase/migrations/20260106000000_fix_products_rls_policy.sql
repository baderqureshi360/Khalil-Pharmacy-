-- File: supabase/migrations/20260106000000_fix_products_rls_policy.sql
-- This fixes the RLS policy to allow INSERT operations
DROP POLICY IF EXISTS "Owners can manage products" ON public.products;
DROP POLICY IF EXISTS "Owners can manage roles" ON public.user_roles;

CREATE POLICY "Owners can manage products" ON public.products
  FOR ALL 
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Owners can manage roles" ON public.user_roles
  FOR ALL 
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
