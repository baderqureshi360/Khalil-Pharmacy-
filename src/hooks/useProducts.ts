import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from './useAuth';

export interface Product {
  id: string;
  name: string;
  barcode: string | null;
  strength: string | null;
  dosage_form: string | null;
  category: string | null;
  manufacturer: string | null;
  salt_formula: string | null;
  rack_id: string | null;
  min_stock: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  rack?: {
    id: string;
    name: string;
    color: string;
  } | null;
}

export interface StockBatch {
  id: string;
  product_id: string;
  batch_number: string;
  quantity: number;
  cost_price: number;
  selling_price: number;
  expiry_date: string;
  purchase_date: string;
  supplier: string | null;
  created_by: string | null;
  created_at: string;
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  // Maximum number of records to fetch per query (pagination limit)
  const MAX_RECORDS_PER_QUERY = 1000;

  const fetchProducts = useCallback(async (searchTerm?: string, rackId?: string) => {
    try {
      setError(null);
      // Select all columns including salt_formula
      let query = supabase
        .from('products')
        .select(`
          *,
          rack:racks(id, name, color)
        `);

      // Apply search filter if provided
      if (searchTerm && searchTerm.trim() !== '') {
        const trimmedSearch = searchTerm.trim();
        // Search by name, salt_formula (case-insensitive partial match) and barcode (exact match)
        // Format: "field1.operator.value1,field2.operator.value2"
        query = query.or(`name.ilike.%${trimmedSearch}%,salt_formula.ilike.%${trimmedSearch}%,barcode.eq.${trimmedSearch}`);
      }

      // Apply rack filter if provided
      if (rackId && rackId.trim() !== '') {
        query = query.eq('rack_id', rackId);
      }

      const { data, error: queryError } = await query
        .order('name')
        .limit(MAX_RECORDS_PER_QUERY);

      if (queryError) {
        throw queryError;
      }

      // Defensive null handling
      setProducts(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load products';
      console.error('Error fetching products:', err);
      setError(errorMessage);
      toast.error('Failed to load products');
      setProducts([]); // Set empty array on error
    }
  }, []);

  const fetchBatches = useCallback(async () => {
    try {
      setError(null);
      // Optimize query - select only required fields for better performance
      const { data, error: queryError } = await supabase
        .from('stock_batches')
        .select('id, product_id, batch_number, quantity, cost_price, selling_price, expiry_date, purchase_date, supplier, created_by, created_at')
        .order('expiry_date')
        .limit(MAX_RECORDS_PER_QUERY);

      if (queryError) {
        throw queryError;
      }

      // Defensive null handling
      setBatches(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load batches';
      console.error('Error fetching batches:', err);
      setError(errorMessage);
      toast.error('Failed to load stock batches');
      setBatches([]); // Set empty array on error
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchProducts(undefined, undefined), fetchBatches()]);
    } catch (err) {
      // Errors are handled in individual fetch functions
      console.error('Error in fetchAll:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchProducts, fetchBatches]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Set up real-time subscriptions for products and batches
  // Optimized to use incremental updates instead of full refetch when possible
  useEffect(() => {
    // Subscribe to products changes with incremental updates
    const productsChannel = supabase
      .channel('products-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products',
        },
        (payload) => {
          // Use incremental updates for better performance
          // Note: Real-time payload may not include joined fields like rack, so we refetch when needed
          if (payload.eventType === 'DELETE' && payload.old) {
            // For deletes, we can safely update without refetch
            setProducts((prev) => prev.filter((p) => p.id !== payload.old.id));
          } else {
            // For INSERT/UPDATE, refetch to ensure we have all joined fields (rack, etc.)
            // This is still more efficient than refetching on every render
            fetchProducts(undefined, undefined);
          }
        }
      )
      .subscribe();

    // Subscribe to stock_batches changes with incremental updates
    const batchesChannel = supabase
      .channel('batches-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stock_batches',
        },
        (payload) => {
          // Use incremental updates for better performance
          if (payload.eventType === 'INSERT' && payload.new) {
            setBatches((prev) => {
              const exists = prev.some(b => b.id === payload.new.id);
              if (exists) return prev;
              const updated = [...prev, payload.new as StockBatch];
              return updated.sort((a, b) => a.expiry_date.localeCompare(b.expiry_date));
            });
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            setBatches((prev) =>
              prev.map((b) => (b.id === payload.new.id ? payload.new as StockBatch : b))
                .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date))
            );
          } else if (payload.eventType === 'DELETE' && payload.old) {
            setBatches((prev) => prev.filter((b) => b.id !== payload.old.id));
          } else {
            // Fallback to full refetch for unknown events
            fetchBatches();
          }
        }
      )
      .subscribe();

    // Cleanup subscriptions on unmount
    return () => {
      supabase.removeChannel(productsChannel);
      supabase.removeChannel(batchesChannel);
    };
  }, [fetchProducts, fetchBatches]);

  const generateBarcode = async (): Promise<string | null> => {
    try {
      const { data, error: rpcError } = await supabase.rpc('generate_ean13');
      if (rpcError) {
        throw rpcError;
      }
      // Defensive null handling
      return data && typeof data === 'string' ? data : null;
    } catch (err: unknown) {
      console.error('Error generating barcode:', err);
      toast.error('Failed to generate barcode');
      return null;
    }
  };

  const addProduct = async (product: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'rack'>) => {
    try {
      if (!user?.id) {
        toast.error('You must be logged in to add products');
        return null;
      }

      // Ensure user has a role - critical for RLS policy to work
      // This prevents RLS policy violations
      const { data: roleCheck, error: roleCheckError } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (roleCheckError || !roleCheck) {
        // User doesn't have a role - create one automatically
        console.warn('User missing role, creating owner role:', user.id);
        const { error: roleCreateError } = await supabase
          .from('user_roles')
          .insert({
            user_id: user.id,
            role: 'owner',
            can_add_products: true,
          })
          .select('id')
          .single();

        if (roleCreateError) {
          console.error('Failed to create user role:', roleCreateError);
          toast.error('Permission setup failed', {
            description: 'Unable to set up your permissions. Please contact support or try logging out and back in.',
          });
          return null;
        }
      }

      // Validate required fields
      if (!product.name || product.name.trim() === '') {
        toast.error('Product name is required');
        return null;
      }

      if (!product.rack_id || (typeof product.rack_id === 'string' && product.rack_id.trim() === '')) {
        toast.error('Rack assignment is required');
        return null;
      }

      // Validate min_stock is a number
      if (typeof product.min_stock !== 'number' || isNaN(product.min_stock) || product.min_stock < 0) {
        toast.error('Minimum stock must be a valid number');
        return null;
      }

      // Auto-generate barcode if not provided
      let finalBarcode = product.barcode?.trim() || null;
      if (!finalBarcode) {
        const generatedBarcode = await generateBarcode();
        if (generatedBarcode) {
          finalBarcode = generatedBarcode;
        } else {
          // Fallback: generate a unique code if RPC fails using timestamp + random
          // This ensures uniqueness even if called simultaneously
          finalBarcode = `HH-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        }
      }

      // Helper to convert empty strings to null for optional fields
      const toOptionalString = (value: string | null | undefined): string | null => {
        if (!value || typeof value !== 'string') return null;
        const trimmed = value.trim();
        return trimmed === '' ? null : trimmed;
      };

      // Prepare payload - include salt_formula if provided (optional field)
      const payload: any = {
        name: product.name.trim(),
        barcode: finalBarcode,
        strength: toOptionalString(product.strength),
        dosage_form: toOptionalString(product.dosage_form),
        category: toOptionalString(product.category),
        manufacturer: toOptionalString(product.manufacturer),
        rack_id: product.rack_id,
        min_stock: product.min_stock,
        is_active: true, // New products are always active
        created_by: user.id,
      };

      // Include salt_formula if it has a value (optional field - won't block if column doesn't exist)
      const saltFormula = toOptionalString(product.salt_formula);
      if (saltFormula !== null) {
        payload.salt_formula = saltFormula;
      }

      // Select all columns including salt_formula (if column exists, it will be included)
      // Using * is safe here as we handle schema errors gracefully
      const { data, error: insertError } = await supabase
        .from('products')
        .insert(payload)
        .select(`
          *,
          rack:racks(id, name, color)
        `)
        .single();

      if (insertError) {
        console.error('Product insert error:', insertError);
        if (insertError.code === '23505') {
          toast.error('Barcode already exists', {
            description: 'Please use a different barcode or leave empty to auto-generate',
          });
          return null;
        }

        // Handle RLS policy violations - try to fix by ensuring user has role
        if (insertError.message?.includes('row-level security policy') || insertError.code === '42501') {
          console.error('RLS Policy Error - User ID:', user?.id, 'Authenticated:', !!user);

          // Try to fix by ensuring user has a role, then retry once
          if (user?.id) {
            const { error: roleFixError } = await supabase
              .from('user_roles')
              .upsert({
                user_id: user.id,
                role: 'owner',
                can_add_products: true,
              }, {
                onConflict: 'user_id,role'
              });

            if (!roleFixError) {
              // Retry the insert after fixing the role
              const retryResult = await supabase
                .from('products')
                .insert(payload)
                .select(`
                  *,
                  rack:racks(id, name, color)
                `)
                .single();

              if (!retryResult.error && retryResult.data) {
                setProducts((prev) => {
                  const updated = [...prev, retryResult.data!];
                  return updated.sort((a, b) => a.name.localeCompare(b.name));
                });
                toast.success('Product added successfully');
                return retryResult.data;
              }
            }
          }

          toast.error('Permission denied', {
            description: 'You do not have permission to add products. Please ensure you are logged in and have the proper role assigned. If the problem persists, try logging out and back in.',
          });
          return null;
        }

        // Handle schema errors gracefully - if salt_formula column doesn't exist, retry without it
        if (insertError.message?.includes("Could not find") && insertError.message?.includes("column") && payload.salt_formula) {
          const { salt_formula: _, ...payloadWithoutSalt } = payload;
          const retryResult = await supabase
            .from('products')
            .insert(payloadWithoutSalt)
            .select(`
              *,
              rack:racks(id, name, color)
            `)
            .single();

          if (!retryResult.error && retryResult.data) {
            setProducts((prev) => {
              const updated = [...prev, retryResult.data!];
              return updated.sort((a, b) => a.name.localeCompare(b.name));
            });
            toast.success('Product added successfully (salt/formula field not available yet)');
            return retryResult.data;
          }
        }

        if (insertError.message?.includes("Could not find") && insertError.message?.includes("column")) {
          toast.error('Database schema needs update', {
            description: 'Please apply the latest migration to add the salt_formula column, or contact your administrator.',
          });
          return null;
        }

        // Show detailed error message with error code for debugging
        const errorMessage = insertError.message || insertError.details || 'Unknown error';
        const errorHint = insertError.hint || '';
        const errorCode = insertError.code || '';
        console.error('Product insert failed:', {
          code: errorCode,
          message: errorMessage,
          hint: errorHint,
          details: insertError.details,
          user: user?.id,
        });
        toast.error('Failed to add product', {
          description: `${errorMessage}${errorCode ? ` (Error: ${errorCode})` : ''}${errorHint ? ` - ${errorHint}` : ''}`,
        });
        return null;
      }

      if (!data) {
        toast.error('Product was not created', {
          description: 'No data returned from server. Please try again',
        });
        return null;
      }

      setProducts((prev) => {
        const updated = [...prev, data];
        return updated.sort((a, b) => a.name.localeCompare(b.name));
      });
      toast.success('Product added successfully');
      return data;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add product';
      console.error('Error adding product:', err);
      toast.error(errorMessage);
      return null;
    }
  };

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    try {
      if (!id || typeof id !== 'string') {
        toast.error('Invalid product ID');
        return null;
      }

      if (!user?.id) {
        toast.error('You must be logged in to update products');
        return null;
      }

      // Ensure user has a role - critical for RLS policy to work
      const { data: roleCheck } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!roleCheck) {
        // User doesn't have a role - create one automatically
        await supabase
          .from('user_roles')
          .insert({
            user_id: user.id,
            role: 'owner',
            can_add_products: true,
          });
      }

      const { rack, salt_formula, ...updateData } = updates;

      // Helper to convert empty strings to null for optional fields
      const toOptionalString = (value: string | null | undefined): string | null => {
        if (!value || typeof value !== 'string') return null;
        const trimmed = value.trim();
        return trimmed === '' ? null : trimmed;
      };

      // Include salt_formula if provided (optional field)
      const finalUpdateData: any = { ...updateData };
      if (salt_formula !== undefined) {
        const saltFormula = toOptionalString(salt_formula);
        // Include even if null to allow clearing the field
        finalUpdateData.salt_formula = saltFormula;
      }

      // Select all columns including salt_formula
      const { data, error: updateError } = await supabase
        .from('products')
        .update(finalUpdateData)
        .eq('id', id)
        .select(`
          *,
          rack:racks(id, name, color)
        `)
        .single();

      if (updateError) {
        // Handle RLS policy violations
        if (updateError.message?.includes('row-level security policy') || updateError.code === '42501') {
          toast.error('Permission denied', {
            description: 'You do not have permission to update products. Please ensure you are logged in and have the proper role assigned.',
          });
          return null;
        }

        // Handle schema errors gracefully
        if (updateError.message?.includes("Could not find") && updateError.message?.includes("column") && finalUpdateData.salt_formula !== undefined) {
          // If salt_formula column doesn't exist, retry without it
          const { salt_formula: _, ...dataWithoutSalt } = finalUpdateData;
          const retryResult = await supabase
            .from('products')
            .update(dataWithoutSalt)
            .eq('id', id)
            .select(`
              *,
              rack:racks(id, name, color)
            `)
            .single();

          if (!retryResult.error && retryResult.data) {
            setProducts((prev) =>
              prev.map((p) => (p.id === id ? retryResult.data! : p))
            );
            toast.success('Product updated (salt/formula field not available yet)');
            return retryResult.data;
          }
        }

        if (updateError.message?.includes("Could not find") && updateError.message?.includes("column")) {
          toast.error('Database schema needs update', {
            description: 'Please apply the latest migration to add the salt_formula column, or contact your administrator.',
          });
          return null;
        }

        // Show detailed error message
        const errorMessage = updateError.message || updateError.details || 'Unknown error';
        const errorCode = updateError.code || '';
        console.error('Product update failed:', {
          code: errorCode,
          message: errorMessage,
          user: user?.id,
        });
        toast.error('Failed to update product', {
          description: `${errorMessage}${errorCode ? ` (Error: ${errorCode})` : ''}`,
        });
        return null;
      }

      if (!data) {
        toast.error('Product was not found');
        return null;
      }

      setProducts((prev) =>
        prev.map((p) => (p.id === id ? data : p))
      );
      toast.success('Product updated');
      return data;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update product';
      console.error('Error updating product:', err);
      toast.error(errorMessage);
      return null;
    }
  };

  const disableProduct = async (id: string) => {
    try {
      if (!id || typeof id !== 'string') {
        toast.error('Invalid product ID');
        return false;
      }

      if (!user?.id) {
        toast.error('You must be logged in to disable products');
        return false;
      }

      const { data, error: updateError } = await supabase
        .from('products')
        .update({ is_active: false })
        .eq('id', id)
        .select(`
          *,
          rack:racks(id, name, color)
        `)
        .single();

      if (updateError) {
        // Handle RLS policy violations
        if (updateError.message?.includes('row-level security policy') || updateError.code === '42501') {
          toast.error('Permission denied', {
            description: 'You do not have permission to disable products. Please ensure you are logged in and have the proper role assigned.',
          });
          return false;
        }
        throw updateError;
      }

      if (!data) {
        toast.error('Product was not found');
        return false;
      }

      setProducts((prev) =>
        prev.map((p) => (p.id === id ? data : p))
      );
      toast.success('Product disabled');
      return true;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to disable product';
      console.error('Error disabling product:', err);
      toast.error(errorMessage);
      return false;
    }
  };

  const enableProduct = async (id: string) => {
    try {
      if (!id || typeof id !== 'string') {
        toast.error('Invalid product ID');
        return false;
      }

      if (!user?.id) {
        toast.error('You must be logged in to enable products');
        return false;
      }

      const { data, error: updateError } = await supabase
        .from('products')
        .update({ is_active: true })
        .eq('id', id)
        .select(`
          *,
          rack:racks(id, name, color)
        `)
        .single();

      if (updateError) {
        // Handle RLS policy violations
        if (updateError.message?.includes('row-level security policy') || updateError.code === '42501') {
          toast.error('Permission denied', {
            description: 'You do not have permission to enable products. Please ensure you are logged in and have the proper role assigned.',
          });
          return false;
        }
        throw updateError;
      }

      if (!data) {
        toast.error('Product was not found');
        return false;
      }

      setProducts((prev) =>
        prev.map((p) => (p.id === id ? data : p))
      );
      toast.success('Product enabled');
      return true;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to enable product';
      console.error('Error enabling product:', err);
      toast.error(errorMessage);
      return false;
    }
  };

  const getProductByBarcode = useCallback((barcode: string | null | undefined) => {
    if (!barcode || typeof barcode !== 'string') {
      return undefined;
    }
    const trimmedBarcode = barcode.trim();
    if (!trimmedBarcode) return undefined;
    // Only return active products
    return products.find((p) => p.barcode && p.barcode.trim() === trimmedBarcode && p.is_active !== false) || undefined;
  }, [products]);

  const getProductStock = useCallback((productId: string | null | undefined) => {
    if (!productId || typeof productId !== 'string') {
      return 0;
    }
    const today = new Date().toISOString().split('T')[0];
    return batches
      .filter((b) => b && b.product_id === productId && b.expiry_date >= today)
      .reduce((sum, b) => sum + (b.quantity || 0), 0);
  }, [batches]);

  const getProductBatches = useCallback((productId: string | null | undefined) => {
    if (!productId || typeof productId !== 'string') {
      return [];
    }
    return batches.filter((b) => b && b.product_id === productId);
  }, [batches]);

  const getAvailableBatches = useCallback((productId: string | null | undefined) => {
    if (!productId || typeof productId !== 'string') {
      return [];
    }
    const today = new Date().toISOString().split('T')[0];
    return batches
      .filter((b) => b && b.product_id === productId && (b.quantity || 0) > 0 && b.expiry_date >= today)
      .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date));
  }, [batches]);

  const getExpiringBatches = useCallback((days = 30) => {
    const today = new Date();
    const threshold = new Date(today);
    threshold.setDate(threshold.getDate() + days);
    const todayStr = today.toISOString().split('T')[0];
    const thresholdStr = threshold.toISOString().split('T')[0];

    return batches
      .filter((b) => b.quantity > 0 && b.expiry_date >= todayStr && b.expiry_date <= thresholdStr)
      .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date));
  }, [batches]);

  const getExpiredBatches = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    return batches
      .filter((b) => b.quantity > 0 && b.expiry_date < today)
      .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date));
  }, [batches]);

  const addBatch = async (batch: Omit<StockBatch, 'id' | 'created_at' | 'created_by'>) => {
    try {
      if (!user?.id) {
        toast.error('You must be logged in to add stock batches');
        return null;
      }

      const { data, error: insertError } = await supabase
        .from('stock_batches')
        .insert({
          ...batch,
          created_by: user.id,
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      if (!data) {
        toast.error('Stock batch was not created');
        return null;
      }

      setBatches((prev) => {
        const updated = [...prev, data];
        return updated.sort((a, b) => a.expiry_date.localeCompare(b.expiry_date));
      });
      toast.success('Stock batch added');
      return data;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add stock batch';
      console.error('Error adding batch:', err);
      toast.error(errorMessage);
      return null;
    }
  };

  const updateBatchQuantity = async (batchId: string, newQuantity: number) => {
    try {
      const { error } = await supabase
        .from('stock_batches')
        .update({ quantity: newQuantity })
        .eq('id', batchId);

      if (error) throw error;

      setBatches((prev) =>
        prev.map((b) => (b.id === batchId ? { ...b, quantity: newQuantity } : b))
      );
      return true;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update batch';
      console.error('Error updating batch:', err);
      toast.error(errorMessage);
      return false;
    }
  };

  // Memoize refetch function to prevent unnecessary re-renders in consuming components
  const stableRefetch = useCallback(() => {
    return fetchAll();
  }, [fetchAll]);

  return {
    products,
    batches,
    loading,
    error,
    addProduct,
    updateProduct,
    disableProduct,
    enableProduct,
    getProductByBarcode,
    getProductStock,
    getProductBatches,
    getAvailableBatches,
    getExpiringBatches,
    getExpiredBatches,
    generateBarcode,
    addBatch,
    updateBatchQuantity,
    refetch: stableRefetch,
    fetchProducts, // Expose fetchProducts for server-side search if needed
  };
}
