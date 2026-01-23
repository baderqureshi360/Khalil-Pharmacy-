-- Update RLS policies to owner-only system
-- All authenticated users are owners, so we only need to check authentication

-- Drop old policies that use admin/cashier checks
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage racks" ON public.racks;
DROP POLICY IF EXISTS "Can create products if permitted" ON public.products;
DROP POLICY IF EXISTS "Can update products if permitted" ON public.products;
DROP POLICY IF EXISTS "Admins can delete products" ON public.products;
DROP POLICY IF EXISTS "Admins can manage batches" ON public.stock_batches;
DROP POLICY IF EXISTS "Admins can update batches" ON public.stock_batches;
DROP POLICY IF EXISTS "Admins can delete batches" ON public.stock_batches;
DROP POLICY IF EXISTS "Admins can update sales" ON public.sales;
DROP POLICY IF EXISTS "Admins can delete sales" ON public.sales;
DROP POLICY IF EXISTS "Admins can read audit logs" ON public.audit_logs;

-- User roles: owners can view their own role, all owners can manage
CREATE POLICY "Owners can view own role" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Owners can manage roles" ON public.user_roles
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Profiles: owners can view/update own, all owners can view all
CREATE POLICY "Owners can view profiles" ON public.profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Owners can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Owners can insert profiles" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Racks: all owners can read and manage
CREATE POLICY "Owners can manage racks" ON public.racks
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Products: all owners can read and manage
CREATE POLICY "Owners can manage products" ON public.products
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Stock batches: all owners can read and manage
CREATE POLICY "Owners can manage batches" ON public.stock_batches
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Sales: all owners can read, create, update, and delete
CREATE POLICY "Owners can manage sales" ON public.sales
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Sale items: all owners can read and create
CREATE POLICY "Owners can manage sale items" ON public.sale_items
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Sales returns: all owners can read and create
CREATE POLICY "Owners can manage returns" ON public.sales_returns
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Return items: all owners can read and create
CREATE POLICY "Owners can manage return items" ON public.return_items
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Audit logs: all owners can read
CREATE POLICY "Owners can read audit logs" ON public.audit_logs
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Update functions to work with owner-only system
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- In owner-only system, if user is authenticated and has a role, they are owner
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
  ) AND _role = 'owner'::app_role
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- In owner-only system, all authenticated users with roles are owners (equivalent to admin)
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.can_add_products(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- In owner-only system, all authenticated users with roles can add products
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
  )
$$;

-- Update trigger to assign owner role to all new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'));
  
  -- Assign owner role to all new users
  INSERT INTO public.user_roles (user_id, role, can_add_products)
  VALUES (NEW.id, 'owner', true)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$;

