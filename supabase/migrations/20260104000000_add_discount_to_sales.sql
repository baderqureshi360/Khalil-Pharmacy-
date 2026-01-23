-- Add discount column to sales table
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS discount DECIMAL(10,2) DEFAULT 0;

-- Update existing sales to have 0 discount
UPDATE public.sales SET discount = 0 WHERE discount IS NULL;

