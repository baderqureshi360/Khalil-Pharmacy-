-- Create app roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'cashier');

-- Create user roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'cashier',
  can_add_products BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  id_card_number TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create racks table with color coding
CREATE TABLE public.racks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#10b981',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  barcode TEXT UNIQUE,
  strength TEXT,
  dosage_form TEXT,
  category TEXT,
  manufacturer TEXT,
  rack_id UUID REFERENCES public.racks(id) ON DELETE SET NULL,
  min_stock INTEGER NOT NULL DEFAULT 10,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create stock batches table
CREATE TABLE public.stock_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  batch_number TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  cost_price DECIMAL(10,2) NOT NULL,
  selling_price DECIMAL(10,2) NOT NULL,
  expiry_date DATE NOT NULL,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  supplier TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sales table
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number TEXT NOT NULL UNIQUE,
  total DECIMAL(10,2) NOT NULL,
  payment_method TEXT NOT NULL,
  cashier_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sale items table
CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  batch_deductions JSONB
);

-- Create sales returns table
CREATE TABLE public.sales_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id),
  receipt_number TEXT NOT NULL,
  return_reason TEXT NOT NULL,
  returned_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create return items table
CREATE TABLE public.return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES public.sales_returns(id) ON DELETE CASCADE,
  sale_item_id UUID NOT NULL REFERENCES public.sale_items(id),
  product_id UUID NOT NULL REFERENCES public.products(id),
  batch_id UUID REFERENCES public.stock_batches(id),
  quantity INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create audit log table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action_type TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  reason TEXT,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create barcode counter for EAN-13 generation
CREATE TABLE public.barcode_counter (
  id INTEGER PRIMARY KEY DEFAULT 1,
  last_number BIGINT NOT NULL DEFAULT 0,
  CHECK (id = 1)
);

-- Initialize counter
INSERT INTO public.barcode_counter (id, last_number) VALUES (1, 0);

-- Enable RLS on all tables
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.racks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barcode_counter ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
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

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
$$;

-- Function to check if cashier can add products
CREATE OR REPLACE FUNCTION public.can_add_products(_user_id UUID)
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
      AND (role = 'admin' OR (role = 'cashier' AND can_add_products = true))
  )
$$;

-- Function to check if any admin exists
CREATE OR REPLACE FUNCTION public.admin_exists()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin')
$$;

-- Trigger function to auto-assign admin to first user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin_exists BOOLEAN;
BEGIN
  -- Check if admin exists
  SELECT public.admin_exists() INTO _admin_exists;
  
  -- Create profile
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'));
  
  -- Assign role - first user becomes admin
  IF NOT _admin_exists THEN
    INSERT INTO public.user_roles (user_id, role, can_add_products)
    VALUES (NEW.id, 'admin', true);
  ELSE
    INSERT INTO public.user_roles (user_id, role, can_add_products)
    VALUES (NEW.id, 'cashier', false);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Generate next EAN-13 barcode
CREATE OR REPLACE FUNCTION public.generate_ean13()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _next_num BIGINT;
  _base_code TEXT;
  _check_digit INTEGER;
  _sum INTEGER := 0;
  _i INTEGER;
BEGIN
  -- Get and increment counter
  UPDATE public.barcode_counter SET last_number = last_number + 1 WHERE id = 1 RETURNING last_number INTO _next_num;
  
  -- Create 12-digit base (890 prefix for Pakistan + 9 digit sequential)
  _base_code := '890' || LPAD(_next_num::TEXT, 9, '0');
  
  -- Calculate EAN-13 check digit
  FOR _i IN 1..12 LOOP
    IF _i % 2 = 0 THEN
      _sum := _sum + (SUBSTRING(_base_code, _i, 1)::INTEGER * 3);
    ELSE
      _sum := _sum + SUBSTRING(_base_code, _i, 1)::INTEGER;
    END IF;
  END LOOP;
  
  _check_digit := (10 - (_sum % 10)) % 10;
  
  RETURN _base_code || _check_digit::TEXT;
END;
$$;

-- Audit log trigger function
CREATE OR REPLACE FUNCTION public.log_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, action_type, table_name, record_id, new_values)
    VALUES (auth.uid(), TG_OP, TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (user_id, action_type, table_name, record_id, old_values, new_values)
    VALUES (auth.uid(), TG_OP, TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (user_id, action_type, table_name, record_id, old_values)
    VALUES (auth.uid(), TG_OP, TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Add audit triggers for stock-affecting tables
CREATE TRIGGER audit_stock_batches
  AFTER INSERT OR UPDATE OR DELETE ON public.stock_batches
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

CREATE TRIGGER audit_sales
  AFTER INSERT OR UPDATE OR DELETE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

CREATE TRIGGER audit_sales_returns
  AFTER INSERT OR UPDATE OR DELETE ON public.sales_returns
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

CREATE TRIGGER audit_products
  AFTER INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- RLS Policies

-- User roles: users can view their own role, admins can manage all
CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.is_admin(auth.uid()));

-- Profiles: users can view/update own, admins can view all
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.is_admin(auth.uid()));

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can manage profiles" ON public.profiles
  FOR ALL USING (public.is_admin(auth.uid()));

-- Racks: all authenticated can read, admins can manage
CREATE POLICY "Authenticated can read racks" ON public.racks
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage racks" ON public.racks
  FOR ALL USING (public.is_admin(auth.uid()));

-- Products: all authenticated can read, admins/permitted can create/update
CREATE POLICY "Authenticated can read products" ON public.products
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Can create products if permitted" ON public.products
  FOR INSERT WITH CHECK (public.can_add_products(auth.uid()));

CREATE POLICY "Can update products if permitted" ON public.products
  FOR UPDATE USING (public.can_add_products(auth.uid()));

CREATE POLICY "Admins can delete products" ON public.products
  FOR DELETE USING (public.is_admin(auth.uid()));

-- Stock batches: all authenticated can read, admins can manage
CREATE POLICY "Authenticated can read batches" ON public.stock_batches
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage batches" ON public.stock_batches
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update batches" ON public.stock_batches
  FOR UPDATE USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete batches" ON public.stock_batches
  FOR DELETE USING (public.is_admin(auth.uid()));

-- Sales: all authenticated can read, cashiers can create
CREATE POLICY "Authenticated can read sales" ON public.sales
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can create sales" ON public.sales
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admins can update sales" ON public.sales
  FOR UPDATE USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete sales" ON public.sales
  FOR DELETE USING (public.is_admin(auth.uid()));

-- Sale items: all authenticated can read/insert
CREATE POLICY "Authenticated can read sale items" ON public.sale_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can create sale items" ON public.sale_items
  FOR INSERT TO authenticated WITH CHECK (true);

-- Sales returns: specific policies for return window
CREATE POLICY "Authenticated can read returns" ON public.sales_returns
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can create returns" ON public.sales_returns
  FOR INSERT TO authenticated WITH CHECK (true);

-- Return items: all authenticated can read/insert
CREATE POLICY "Authenticated can read return items" ON public.return_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can create return items" ON public.return_items
  FOR INSERT TO authenticated WITH CHECK (true);

-- Audit logs: only admins can read
CREATE POLICY "Admins can read audit logs" ON public.audit_logs
  FOR SELECT USING (public.is_admin(auth.uid()));

-- Barcode counter: all authenticated can use
CREATE POLICY "Authenticated can use barcode counter" ON public.barcode_counter
  FOR ALL TO authenticated USING (true);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default racks
INSERT INTO public.racks (name, color, description) VALUES
  ('A', '#ef4444', 'Shelf A - Pain Relief'),
  ('B', '#f97316', 'Shelf B - Antibiotics'),
  ('C', '#eab308', 'Shelf C - Vitamins'),
  ('D', '#22c55e', 'Shelf D - Cold & Flu'),
  ('E', '#3b82f6', 'Shelf E - General');

-- Create index for barcode lookups
CREATE INDEX idx_products_barcode ON public.products(barcode);
CREATE INDEX idx_stock_batches_product ON public.stock_batches(product_id);
CREATE INDEX idx_stock_batches_expiry ON public.stock_batches(expiry_date);
CREATE INDEX idx_sales_receipt ON public.sales(receipt_number);
CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_table ON public.audit_logs(table_name);