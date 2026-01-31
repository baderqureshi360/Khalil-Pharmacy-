-- ============================================================================
-- ZamZam Pharmacy - Comprehensive Database Schema
-- Created: 2026-01-31
-- Description: This script sets up the entire database schema from scratch.
--              It includes tables, security policies, automation triggers, and initial data.
-- Usage: Run this script in the Supabase SQL Editor or via CLI.
-- ============================================================================

-- Enable necessary extensions if they are not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. ENUMS AND TYPES
-- ============================================================================

-- Define user roles for the application
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'cashier', 'owner');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- 2. TABLES
-- ============================================================================

-- PROFILES: Stores extra user information linked to auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  id_card_number TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- USER ROLES: Manages permissions for users
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'cashier',
  can_add_products BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- RACKS: Physical locations for products
CREATE TABLE IF NOT EXISTS public.racks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#10b981',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- PRODUCTS: The main product catalog
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  barcode TEXT UNIQUE,
  strength TEXT,
  dosage_form TEXT,
  category TEXT,
  manufacturer TEXT,
  salt_formula TEXT,
  rack_id UUID REFERENCES public.racks(id) ON DELETE SET NULL,
  min_stock INTEGER NOT NULL DEFAULT 10,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT check_min_stock_non_negative CHECK (min_stock >= 0),
  CONSTRAINT check_product_name_not_empty CHECK (LENGTH(TRIM(name)) > 0)
);

-- STOCK BATCHES: Inventory tracking (First Expiry First Out)
CREATE TABLE IF NOT EXISTS public.stock_batches (
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
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT check_quantity_non_negative CHECK (quantity >= 0),
  CONSTRAINT check_cost_price_positive CHECK (cost_price > 0),
  CONSTRAINT check_selling_price_positive CHECK (selling_price > 0),
  CONSTRAINT check_expiry_date_valid CHECK (expiry_date >= purchase_date)
);

-- SALES: Records of sales transactions
CREATE TABLE IF NOT EXISTS public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number TEXT NOT NULL UNIQUE,
  total DECIMAL(10,2) NOT NULL,
  discount DECIMAL(10,2) DEFAULT 0,
  payment_method TEXT NOT NULL,
  cashier_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT check_total_non_negative CHECK (total >= 0),
  CONSTRAINT check_receipt_number_not_empty CHECK (LENGTH(TRIM(receipt_number)) > 0)
);

-- SALE ITEMS: Individual items within a sale
CREATE TABLE IF NOT EXISTS public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  batch_deductions JSONB, -- Stores which batches were deducted from
  CONSTRAINT check_sale_item_quantity_positive CHECK (quantity > 0)
);

-- SALES RETURNS: Records of returned sales
CREATE TABLE IF NOT EXISTS public.sales_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id),
  receipt_number TEXT NOT NULL,
  return_reason TEXT NOT NULL,
  returned_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RETURN ITEMS: Individual items returned
CREATE TABLE IF NOT EXISTS public.return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES public.sales_returns(id) ON DELETE CASCADE,
  sale_item_id UUID NOT NULL REFERENCES public.sale_items(id),
  product_id UUID NOT NULL REFERENCES public.products(id),
  batch_id UUID REFERENCES public.stock_batches(id),
  quantity INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- AUDIT LOGS: Tracks changes to sensitive data
CREATE TABLE IF NOT EXISTS public.audit_logs (
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

-- BARCODE COUNTER: Used for generating sequential EAN-13 barcodes
CREATE TABLE IF NOT EXISTS public.barcode_counter (
  id INTEGER PRIMARY KEY DEFAULT 1,
  last_number BIGINT NOT NULL DEFAULT 0,
  CHECK (id = 1)
);

-- Initialize counter if not exists
INSERT INTO public.barcode_counter (id, last_number) 
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 3. INDEXES (For Performance)
-- ============================================================================

-- Products Indexes
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products(name);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_rack_id ON public.products(rack_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);

-- Stock Batches Indexes
CREATE INDEX IF NOT EXISTS idx_stock_batches_product_id ON public.stock_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_batches_expiry_date ON public.stock_batches(expiry_date);
-- FEFO index: helps find the earliest expiring batch with stock
CREATE INDEX IF NOT EXISTS idx_stock_batches_fefo ON public.stock_batches(product_id, expiry_date, quantity) 
  WHERE quantity > 0;

-- Sales Indexes
CREATE INDEX IF NOT EXISTS idx_sales_receipt_number ON public.sales(receipt_number);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_cashier ON public.sales(cashier_id);

-- Sale Items Indexes
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON public.sale_items(product_id);

-- Audit Logs Indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON public.audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- ============================================================================
-- 4. FUNCTIONS AND TRIGGERS (Automation)
-- ============================================================================

-- Function: Automatically update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to products
DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Apply updated_at trigger to profiles
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function: Check if a user has a specific role
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

-- Function: Check if a user is an admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
$$;

-- Function: Check if any admin exists (used for first-time setup)
CREATE OR REPLACE FUNCTION public.admin_exists()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin')
$$;

-- Function: Check if user has permission to add products
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
      AND (role = 'admin' OR (role = 'cashier' AND can_add_products = true) OR role = 'owner')
  )
$$;

-- Function: Generate EAN-13 Barcode
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
  -- Increment counter safely
  UPDATE public.barcode_counter SET last_number = last_number + 1 WHERE id = 1 RETURNING last_number INTO _next_num;
  
  -- '890' is used as a prefix here (can be changed)
  _base_code := '890' || LPAD(_next_num::TEXT, 9, '0');
  
  -- Calculate checksum (EAN-13 standard)
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

-- Function: Handle New User Registration
-- Automatically assigns 'admin' role to the first user, and 'cashier' to others.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin_exists BOOLEAN;
BEGIN
  SELECT public.admin_exists() INTO _admin_exists;
  
  -- Create profile
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'));
  
  -- Assign role
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

-- Trigger: Run handle_new_user when a new user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function: Audit Logging
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

-- Apply Audit Triggers to key tables
DROP TRIGGER IF EXISTS audit_products ON public.products;
CREATE TRIGGER audit_products AFTER INSERT OR UPDATE OR DELETE ON public.products FOR EACH ROW EXECUTE FUNCTION public.log_audit();

DROP TRIGGER IF EXISTS audit_stock_batches ON public.stock_batches;
CREATE TRIGGER audit_stock_batches AFTER INSERT OR UPDATE OR DELETE ON public.stock_batches FOR EACH ROW EXECUTE FUNCTION public.log_audit();

DROP TRIGGER IF EXISTS audit_sales ON public.sales;
CREATE TRIGGER audit_sales AFTER INSERT OR UPDATE OR DELETE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

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

-- User Roles Policies
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.is_admin(auth.uid()));

-- Profiles Policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can manage profiles" ON public.profiles;
CREATE POLICY "Admins can manage profiles" ON public.profiles FOR ALL USING (public.is_admin(auth.uid()));

-- Racks Policies
DROP POLICY IF EXISTS "Everyone can read racks" ON public.racks;
CREATE POLICY "Everyone can read racks" ON public.racks FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage racks" ON public.racks;
CREATE POLICY "Admins can manage racks" ON public.racks FOR ALL USING (public.is_admin(auth.uid()));

-- Products Policies
DROP POLICY IF EXISTS "Everyone can read products" ON public.products;
CREATE POLICY "Everyone can read products" ON public.products FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authorized can create products" ON public.products;
CREATE POLICY "Authorized can create products" ON public.products FOR INSERT WITH CHECK (public.can_add_products(auth.uid()));

DROP POLICY IF EXISTS "Authorized can update products" ON public.products;
CREATE POLICY "Authorized can update products" ON public.products FOR UPDATE USING (public.can_add_products(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete products" ON public.products;
CREATE POLICY "Admins can delete products" ON public.products FOR DELETE USING (public.is_admin(auth.uid()));

-- Stock Batches Policies
DROP POLICY IF EXISTS "Everyone can read batches" ON public.stock_batches;
CREATE POLICY "Everyone can read batches" ON public.stock_batches FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins/Authorized can manage batches" ON public.stock_batches;
CREATE POLICY "Admins/Authorized can manage batches" ON public.stock_batches FOR ALL USING (public.can_add_products(auth.uid()));

-- Sales Policies
DROP POLICY IF EXISTS "Everyone can read sales" ON public.sales;
CREATE POLICY "Everyone can read sales" ON public.sales FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated can create sales" ON public.sales;
CREATE POLICY "Authenticated can create sales" ON public.sales FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can update sales" ON public.sales;
CREATE POLICY "Admins can update sales" ON public.sales FOR UPDATE USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete sales" ON public.sales;
CREATE POLICY "Admins can delete sales" ON public.sales FOR DELETE USING (public.is_admin(auth.uid()));

-- Sale Items Policies
DROP POLICY IF EXISTS "Everyone can read sale items" ON public.sale_items;
CREATE POLICY "Everyone can read sale items" ON public.sale_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated can create sale items" ON public.sale_items;
CREATE POLICY "Authenticated can create sale items" ON public.sale_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Sales Returns Policies
DROP POLICY IF EXISTS "Everyone can read returns" ON public.sales_returns;
CREATE POLICY "Everyone can read returns" ON public.sales_returns FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated can create returns" ON public.sales_returns;
CREATE POLICY "Authenticated can create returns" ON public.sales_returns FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Everyone can read return items" ON public.return_items;
CREATE POLICY "Everyone can read return items" ON public.return_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated can create return items" ON public.return_items;
CREATE POLICY "Authenticated can create return items" ON public.return_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Audit Logs Policies
DROP POLICY IF EXISTS "Admins can read audit logs" ON public.audit_logs;
CREATE POLICY "Admins can read audit logs" ON public.audit_logs FOR SELECT USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "System can insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (true);

-- Barcode Counter Policies
DROP POLICY IF EXISTS "Authenticated can use barcode counter" ON public.barcode_counter;
CREATE POLICY "Authenticated can use barcode counter" ON public.barcode_counter FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================================
-- 6. INITIAL SEED DATA
-- ============================================================================

INSERT INTO public.racks (name, color, description) VALUES
  ('A', '#ef4444', 'Shelf A - Pain Relief'),
  ('B', '#f97316', 'Shelf B - Antibiotics'),
  ('C', '#eab308', 'Shelf C - Vitamins'),
  ('D', '#22c55e', 'Shelf D - Cold & Flu'),
  ('E', '#3b82f6', 'Shelf E - General')
ON CONFLICT (name) DO NOTHING;
