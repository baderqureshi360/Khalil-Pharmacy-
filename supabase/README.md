# Supabase Migrations

This directory contains database migrations for the Khalil Pharmacy project.

## Migration Order

It is **CRITICAL** to apply migrations in the following order:

1. `20260106000000_fix_products_rls_policy.sql` - Fixes permission issues (Apply this FIRST)
2. `20260105000000_add_salt_formula_to_products.sql` - Adds the missing column

## How to Apply

### Option 1: Via Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard.
2. Navigate to the **SQL Editor**.
3. Create a new query.
4. Copy the content of the migration file and paste it into the editor.
5. Click **Run**.
6. Repeat for each migration file in the specified order.

### Option 2: Via Supabase CLI

If you have the Supabase CLI installed and linked to your project:

```bash
supabase db push
```

## Migration Details

### Fix RLS Policy
File: `20260106000000_fix_products_rls_policy.sql`
- Fixes `permission denied` errors when creating products.
- Adds `WITH CHECK` clause to RLS policies.
- Updates policies for `products` and `user_roles` tables.

### Add Salt Formula
File: `20260105000000_add_salt_formula_to_products.sql`
- Adds `salt_formula` column to the `products` table.
- This field is used for searching and storing active ingredients.
