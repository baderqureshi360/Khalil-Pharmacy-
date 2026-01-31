# Database Setup Guide for ZamZam Pharmacy

This guide explains how to set up the database for the ZamZam Pharmacy application. We have consolidated all previous migrations into a single, easy-to-use script.

## 1. The Migration File

We have created a single SQL file that contains everything needed to set up the database (tables, permissions, automation, etc.):

- **File Path:** `supabase/migrations/20260131000000_init_full_schema.sql`

## 2. How to Apply the Schema

You can apply this schema in two ways. Choose the one that fits your workflow.

### Method A: Using Supabase Dashboard (Easiest)

If you are not using the command line or Docker, this is the best method.

1.  **Open your Supabase Project Dashboard** in your web browser.
2.  Navigate to the **SQL Editor** (look for the `SQL` icon on the left sidebar).
3.  Click **New Query**.
4.  **Copy the entire content** of the file `supabase/migrations/20260131000000_init_full_schema.sql`.
5.  **Paste** it into the SQL Editor.
6.  Click **Run** (bottom right).
7.  Wait for the "Success" message.

### Method B: Using Supabase CLI (For Developers)

If you have the Supabase CLI installed and linked to your project:

1.  Open your terminal in the project root folder.
2.  Run the following command to reset the database and apply the new schema:

    ```bash
    npx supabase db reset
    ```

    > **Warning:** This will delete all existing data in your local database and re-apply the schema from scratch.

## 3. What This Script Does

This script sets up the following:

-   **User Roles:** `admin`, `cashier`, `owner`.
-   **Tables:**
    -   `products`: Inventory management.
    -   `stock_batches`: Tracks expiry dates and batches.
    -   `sales` & `sale_items`: Transaction history.
    -   `racks`: Physical storage locations.
    -   `audit_logs`: Tracks who changed what.
-   **Security:** Enables Row Level Security (RLS) so users can only access what they are allowed to.
-   **Automation:**
    -   Automatically assigns the **Admin** role to the first user who signs up.
    -   Automatically generates EAN-13 barcodes for products.
    -   Updates `updated_at` timestamps automatically.

## 4. Troubleshooting

-   **"Relation already exists" error:** This means some tables already exist.
    -   If using the **SQL Editor**, you can ignore this if the script uses `IF NOT EXISTS` (which it does).
    -   To be safe, you can go to **Table Editor**, select all tables, and delete them before running the script (only if you don't care about losing data).
-   **"Extension pgcrypto not found":** The script tries to enable it, but if you lack permissions, go to **Database -> Extensions** in the dashboard and enable `pgcrypto` manually.
