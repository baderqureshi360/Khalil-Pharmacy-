import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from './useAuth';

export interface BatchDeduction {
  batch_id: string;
  batch_number: string;
  quantity: number;
  expiry_date: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  batch_deductions: BatchDeduction[] | null;
}

export interface ReturnItem {
  id: string;
  sale_item_id: string;
  quantity: number;
  product_id: string;
}

export interface SalesReturn {
  id: string;
  receipt_number: string;
  created_at: string;
  return_items: ReturnItem[];
}

export interface Sale {
  id: string;
  receipt_number: string;
  total: number;
  payment_method: string;
  cashier_id: string | null;
  created_at: string;
  discount?: number;
  items?: SaleItem[];
  returns?: SalesReturn[];
}

export interface CartItem {
  product_id: string;
  product_name: string;
  strength: string | null;
  quantity: number;
  unit_price: number;
  total: number;
  available_stock: number;
}

export function useSales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  // Maximum number of records to fetch per query (pagination limit)
  const MAX_RECORDS_PER_QUERY = 1000;

  const fetchSales = useCallback(async () => {
    try {
      setError(null);
      // Optimize query - select only required fields
      // Include discount if column exists (graceful fallback)
      const { data, error: queryError } = await supabase
        .from('sales')
        .select(`
          id, receipt_number, total, payment_method, cashier_id, created_at, discount,
          items:sale_items(id, sale_id, product_id, product_name, quantity, unit_price, total, batch_deductions),
          returns:sales_returns(id, receipt_number, created_at, return_items(id, sale_item_id, quantity, product_id))
        `)
        .order('created_at', { ascending: false })
        .limit(MAX_RECORDS_PER_QUERY);
      
      if (queryError) {
        // If error is about discount column not existing, retry without it
        if (queryError.message?.includes('discount') || queryError.code === '42703' || queryError.code === 'PGRST116') {
          console.warn('Discount column not found, retrying without it');
          const { data: retryData, error: retryError } = await supabase
            .from('sales')
            .select(`
              id, receipt_number, total, payment_method, cashier_id, created_at,
              items:sale_items(id, sale_id, product_id, product_name, quantity, unit_price, total, batch_deductions),
              returns:sales_returns(id, receipt_number, created_at, return_items(id, sale_item_id, quantity, product_id))
            `)
            .order('created_at', { ascending: false })
            .limit(MAX_RECORDS_PER_QUERY);
          
          if (retryError) {
            throw retryError;
          }
          
          setSales(Array.isArray(retryData) ? retryData : []);
          return;
        }
        throw queryError;
      }
      
      // Defensive null handling
      setSales(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load sales';
      const errorDetails = err && typeof err === 'object' && 'code' in err ? err : null;
      console.error('Error fetching sales:', {
        message: errorMessage,
        error: err,
        details: errorDetails,
        code: errorDetails && 'code' in errorDetails ? errorDetails.code : undefined,
      });
      setError(errorMessage);
      toast.error('Failed to load sales');
      setSales([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  const generateReceiptNumber = async () => {
    try {
      const { data } = await supabase
        .from('sales')
        .select('receipt_number')
        .ilike('receipt_number', 'ZZ-%')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let nextNum = 1;
      if (data && data.receipt_number) {
        const parts = data.receipt_number.split('-');
        if (parts.length === 2) {
          const num = parseInt(parts[1], 10);
          if (!isNaN(num)) {
            nextNum = num + 1;
          }
        }
      }
      return `ZZ-${nextNum.toString().padStart(5, '0')}`;
    } catch (error) {
      console.error('Error generating receipt number:', error);
      // Fallback to timestamp if generation fails
      const date = new Date();
      const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
      const timeStr = date.getTime().toString().slice(-6);
      return `ZZ-${timeStr.slice(-5)}`;
    }
  };

  interface AvailableBatch {
    id: string;
    batch_number: string;
    quantity: number;
    expiry_date: string;
  }

  const processSale = async (
    items: CartItem[],
    paymentMethod: string,
    getAvailableBatches: (productId: string) => AvailableBatch[]
  ): Promise<{ success: boolean; error?: string; sale?: Sale }> => {
    try {
      // Validate stock and prepare batch deductions
      const itemsWithDeductions: Array<{
        product_id: string;
        product_name: string;
        quantity: number;
        unit_price: number;
        total: number;
        batch_deductions: BatchDeduction[];
      }> = [];

      for (const item of items) {
        if (!item || !item.product_id || !item.product_name) {
          return {
            success: false,
            error: 'Invalid cart item',
          };
        }

        const availableBatches = getAvailableBatches(item.product_id);
        const totalAvailable = availableBatches.reduce((sum: number, b: AvailableBatch) => {
          return sum + (b?.quantity || 0);
        }, 0);

        if (totalAvailable < item.quantity) {
          return {
            success: false,
            error: `Insufficient stock for ${item.product_name}. Available: ${totalAvailable}`,
          };
        }

        // Calculate FEFO deductions
        let remainingQty = item.quantity;
        const deductions: BatchDeduction[] = [];

        for (const batch of availableBatches) {
          if (remainingQty <= 0 || !batch) break;

          const deductQty = Math.min(batch.quantity || 0, remainingQty);
          if (deductQty <= 0) continue;

          deductions.push({
            batch_id: batch.id,
            batch_number: batch.batch_number || '',
            quantity: deductQty,
            expiry_date: batch.expiry_date || '',
          });
          remainingQty -= deductQty;
        }

        itemsWithDeductions.push({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.total,
          batch_deductions: deductions,
        });
      }

      // Create sale record
      const receiptNumber = await generateReceiptNumber();
      const total = items.reduce((sum, item) => sum + item.total, 0);

      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert({
          receipt_number: receiptNumber,
          total,
          payment_method: paymentMethod,
          cashier_id: user?.id,
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // Create sale items
      const saleItems = itemsWithDeductions.map((item) => ({
        sale_id: saleData.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.total,
        batch_deductions: item.batch_deductions,
      }));

      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItems);

      if (itemsError) throw itemsError;

      // Optimize batch quantity updates - batch multiple updates together
      // Collect all batch updates first
      const batchUpdates: Array<{ id: string; quantity: number }> = [];
      const batchIdsToFetch = new Set<string>();
      
      for (const item of itemsWithDeductions) {
        for (const deduction of item.batch_deductions) {
          batchIdsToFetch.add(deduction.batch_id);
        }
      }

      // Fetch all current batch quantities in a single query
      if (batchIdsToFetch.size > 0) {
        const { data: currentBatches } = await supabase
          .from('stock_batches')
          .select('id, quantity')
          .in('id', Array.from(batchIdsToFetch));

        if (currentBatches) {
          const batchMap = new Map(currentBatches.map(b => [b.id, b.quantity]));
          
          // Calculate new quantities
          for (const item of itemsWithDeductions) {
            for (const deduction of item.batch_deductions) {
              const currentQty = batchMap.get(deduction.batch_id) || 0;
              const newQty = currentQty - deduction.quantity;
              batchUpdates.push({ id: deduction.batch_id, quantity: newQty });
            }
          }

          // Execute all updates in parallel using Promise.all
          await Promise.all(
            batchUpdates.map(update =>
              supabase
                .from('stock_batches')
                .update({ quantity: update.quantity })
                .eq('id', update.id)
            )
          );
        }
      }

      await fetchSales();
      
      if (!saleData) {
        return { success: false, error: 'Sale was not created' };
      }

      return { success: true, sale: saleData as Sale };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process sale';
      console.error('Error processing sale:', err);
      return { success: false, error: errorMessage };
    }
  };

  const processReturn = async (
    saleId: string,
    returnItems: Array<{
      sale_item_id: string;
      product_id: string;
      quantity: number;
      batch_deductions?: BatchDeduction[] | null;
    }>,
    returnReason: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!saleId || !returnItems.length) {
        return { success: false, error: 'Invalid return request' };
      }

      // Generate Return Receipt Number
      const date = new Date();
      const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
      const timeStr = date.getTime().toString().slice(-6);
      const receiptNumber = `RET-${dateStr}-${timeStr}`;

      // 1. Create Sales Return Record
      const { data: returnData, error: returnError } = await supabase
        .from('sales_returns')
        .insert({
          sale_id: saleId,
          receipt_number: receiptNumber,
          return_reason: returnReason,
          returned_by: user?.id,
        })
        .select()
        .single();

      if (returnError) throw returnError;

      // 2. Process Return Items and Restore Stock
      const returnItemsData = [];
      const batchUpdates: Array<{ id: string; quantity: number }> = [];
      const batchIdsToFetch = new Set<string>();

      for (const item of returnItems) {
        let remainingReturnQty = item.quantity;
        
        // If we have batch deductions info, use it to restore specific batches
        if (item.batch_deductions && item.batch_deductions.length > 0) {
          // Iterate to restore
          for (const deduction of item.batch_deductions) {
            if (remainingReturnQty <= 0) break;
            
            // We restore up to what was deducted from this batch
            const restoreQty = Math.min(deduction.quantity, remainingReturnQty);
            
            if (restoreQty > 0) {
               returnItemsData.push({
                 return_id: returnData.id,
                 sale_item_id: item.sale_item_id,
                 product_id: item.product_id,
                 batch_id: deduction.batch_id,
                 quantity: restoreQty
               });
               
               batchIdsToFetch.add(deduction.batch_id);
               remainingReturnQty -= restoreQty;
            }
          }
        } else {
           // Fallback if no batch info
           returnItemsData.push({
             return_id: returnData.id,
             sale_item_id: item.sale_item_id,
             product_id: item.product_id,
             batch_id: null,
             quantity: remainingReturnQty
           });
        }
      }

      // Insert return items
      if (returnItemsData.length > 0) {
        const { error: itemsError } = await supabase
          .from('return_items')
          .insert(returnItemsData);

        if (itemsError) throw itemsError;
      }

      // 3. Restore Stock Quantities
      if (batchIdsToFetch.size > 0) {
        const { data: currentBatches } = await supabase
          .from('stock_batches')
          .select('id, quantity')
          .in('id', Array.from(batchIdsToFetch));

        if (currentBatches) {
          const batchMap = new Map(currentBatches.map(b => [b.id, b.quantity]));
          
          // Calculate new quantities
          for (const item of returnItemsData) {
            if (item.batch_id) {
               const currentQty = batchMap.get(item.batch_id) || 0;
               const newQty = currentQty + item.quantity; // ADD back to stock
               batchUpdates.push({ id: item.batch_id, quantity: newQty });
               batchMap.set(item.batch_id, newQty);
            }
          }

          // Execute updates
          await Promise.all(
            batchUpdates.map(update =>
              supabase
                .from('stock_batches')
                .update({ quantity: update.quantity })
                .eq('id', update.id)
            )
          );
        }
      }

      await fetchSales();
      return { success: true };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process return';
      console.error('Error processing return:', err);
      return { success: false, error: errorMessage };
    }
  };

  const getSaleByReceipt = async (receiptNumber: string | null | undefined): Promise<Sale | null> => {
    try {
      if (!receiptNumber || typeof receiptNumber !== 'string') {
        return null;
      }

      const { data, error: queryError } = await supabase
        .from('sales')
        .select(`
          *,
          items:sale_items(*),
          returns:sales_returns(id, receipt_number, created_at, return_items(id, sale_item_id, quantity, product_id))
        `)
        .eq('receipt_number', receiptNumber)
        .maybeSingle();

      if (queryError) {
        throw queryError;
      }
      return (data as unknown as Sale) || null;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch sale';
      console.error('Error fetching sale:', err);
      toast.error(errorMessage);
      return null;
    }
  };

  // Memoize refetch function to prevent unnecessary re-renders
  const stableRefetch = useCallback(() => {
    return fetchSales();
  }, [fetchSales]);

  return {
    sales,
    loading,
    error,
    processSale,
    processReturn,
    getSaleByReceipt,
    refetch: stableRefetch,
  };
}
