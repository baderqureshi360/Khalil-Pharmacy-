-- Add salt_formula column to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS salt_formula TEXT;

-- Add comment
COMMENT ON COLUMN public.products.salt_formula IS 'Optional - Active ingredient or formula (e.g., Paracetamol, Ibuprofen)';

