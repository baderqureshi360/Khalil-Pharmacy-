-- Add is_active column to products table for soft delete functionality
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Create index for better query performance when filtering active products
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);

-- Update existing products to be active by default (safety measure)
UPDATE public.products SET is_active = true WHERE is_active IS NULL;
