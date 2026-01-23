-- Update to owner-only system
-- This migration updates the role system to only support 'owner' role

-- Update app_role enum to only include 'owner'
ALTER TYPE public.app_role RENAME TO app_role_old;

CREATE TYPE public.app_role AS ENUM ('owner');

-- Drop the default constraint before altering column type
ALTER TABLE public.user_roles 
  ALTER COLUMN role DROP DEFAULT;

-- Update user_roles table
ALTER TABLE public.user_roles 
  ALTER COLUMN role TYPE public.app_role 
  USING CASE 
    WHEN role::text = 'admin' THEN 'owner'::public.app_role
    WHEN role::text = 'cashier' THEN 'owner'::public.app_role
    ELSE 'owner'::public.app_role
  END;

-- Drop functions that depend on the old enum type
DROP FUNCTION IF EXISTS public.has_role(UUID, app_role_old);

-- Drop old enum (now safe since dependent functions are dropped)
DROP TYPE public.app_role_old;

-- Recreate functions with the new enum type
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Update default role to owner
ALTER TABLE public.user_roles 
  ALTER COLUMN role SET DEFAULT 'owner'::public.app_role;

-- Ensure all existing users are owners
UPDATE public.user_roles 
SET role = 'owner'::public.app_role, can_add_products = true
WHERE role IS NOT NULL;

-- Add comment
COMMENT ON TYPE public.app_role IS 'Owner-only system - all authenticated users are owners';

