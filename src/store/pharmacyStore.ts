import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Product, Sale, StockPurchase, SaleItem, StockBatch, BatchDeduction } from '@/types/pharmacy';
import { isBefore, parseISO, startOfToday, addDays } from 'date-fns';

interface PharmacyStore {
  // State data
  products: Product[];
  sales: Sale[];
  stockPurchases: StockPurchase[];
  stockBatches: StockBatch[];
  
  // Safety states for async operations and error handling
  isLoading: boolean;
  error: string | null;
  
  // Actions to manage safety states
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  
  // Product actions
  addProduct: (product: Omit<Product, 'id' | 'createdAt'>) => void;
  updateProduct: (id: string, product: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  getProductByBarcode: (barcode: string) => Product | undefined;
  
  // Stock calculations
  getProductStock: (productId: string) => number;
  getProductBatches: (productId: string) => StockBatch[];
  getAvailableBatches: (productId: string) => StockBatch[]; // Non-expired batches sorted by FEFO
  getExpiringBatches: (days?: number) => StockBatch[];
  getExpiredBatches: () => StockBatch[];
  
  // Sales actions
  addSale: (items: SaleItem[], paymentMethod: 'cash' | 'card' | 'mobile', discount?: number) => { success: boolean; error?: string; saleId?: string };
  
  // Stock purchase actions (adds batch)
  addStockPurchase: (purchase: Omit<StockPurchase, 'id'>) => void;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

// Sample products (without stock - stock comes from batches now)
const sampleProducts: Product[] = [
];

// Sample batches with varying expiry dates
const sampleBatches: StockBatch[] = [];

export const usePharmacyStore = create<PharmacyStore>()(
  persist(
    (set, get) => ({
      // Initial state
      products: sampleProducts,
      sales: [],
      stockPurchases: [],
      stockBatches: sampleBatches,
      
      // Safety states with safe defaults
      isLoading: false,
      error: null,
      
      // Safety state management
      setLoading: (loading: boolean) => set({ isLoading: loading }),
      setError: (error: string | null) => set({ error }),
      clearError: () => set({ error: null }),

      addProduct: (product) =>
        set((state) => ({
          products: [
            ...state.products,
            {
              ...product,
              id: generateId(),
              createdAt: new Date().toISOString().split('T')[0],
            },
          ],
        })),

      updateProduct: (id, updates) =>
        set((state) => ({
          products: state.products.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        })),

      deleteProduct: (id) =>
        set((state) => ({
          products: state.products.filter((p) => p.id !== id),
          stockBatches: state.stockBatches.filter((b) => b.productId !== id),
        })),

      getProductByBarcode: (barcode) => {
        if (!barcode || typeof barcode !== 'string') {
          return undefined;
        }
        const products = get().products;
        if (!Array.isArray(products)) {
          return undefined;
        }
        return products.find((p) => p && p.barcode === barcode);
      },

      // Calculate total stock from all non-expired batches
      getProductStock: (productId) => {
        if (!productId || typeof productId !== 'string') {
          return 0;
        }
        const today = startOfToday();
        const batches = get().stockBatches;
        if (!Array.isArray(batches)) {
          return 0;
        }
        return batches
          .filter((b) => b && b.productId === productId && b.expiryDate && !isBefore(parseISO(b.expiryDate), today))
          .reduce((sum, b) => sum + (b.quantity || 0), 0);
      },

      // Get all batches for a product
      getProductBatches: (productId) => {
        if (!productId || typeof productId !== 'string') {
          return [];
        }
        const batches = get().stockBatches;
        if (!Array.isArray(batches)) {
          return [];
        }
        return batches.filter((b) => b && b.productId === productId);
      },

      // Get non-expired batches sorted by expiry date (FEFO - First Expiry First Out)
      getAvailableBatches: (productId) => {
        if (!productId || typeof productId !== 'string') {
          return [];
        }
        const today = startOfToday();
        const batches = get().stockBatches;
        if (!Array.isArray(batches)) {
          return [];
        }
        return batches
          .filter((b) => b && b.productId === productId && (b.quantity || 0) > 0 && b.expiryDate && !isBefore(parseISO(b.expiryDate), today))
          .sort((a, b) => {
            if (!a.expiryDate || !b.expiryDate) return 0;
            return parseISO(a.expiryDate).getTime() - parseISO(b.expiryDate).getTime();
          });
      },

      // Get batches expiring within specified days (default 30)
      getExpiringBatches: (days = 30) => {
        const today = startOfToday();
        const thresholdDate = addDays(today, days);
        return get().stockBatches
          .filter((b) => {
            const expiryDate = parseISO(b.expiryDate);
            return b.quantity > 0 && 
                   !isBefore(expiryDate, today) && 
                   isBefore(expiryDate, thresholdDate);
          })
          .sort((a, b) => parseISO(a.expiryDate).getTime() - parseISO(b.expiryDate).getTime());
      },

      // Get expired batches with remaining stock
      getExpiredBatches: () => {
        const today = startOfToday();
        return get().stockBatches
          .filter((b) => b.quantity > 0 && isBefore(parseISO(b.expiryDate), today))
          .sort((a, b) => parseISO(a.expiryDate).getTime() - parseISO(b.expiryDate).getTime());
      },

      // Add sale with FEFO deduction
      addSale: (items, paymentMethod, discount = 0) => {
        const state = get();
        const today = startOfToday();
        const updatedBatches = [...state.stockBatches];
        const itemsWithDeductions: SaleItem[] = [];

        // Validate and prepare deductions
        for (const item of items) {
          const availableBatches = updatedBatches
            .filter((b) => b.productId === item.productId && b.quantity > 0 && !isBefore(parseISO(b.expiryDate), today))
            .sort((a, b) => parseISO(a.expiryDate).getTime() - parseISO(b.expiryDate).getTime());

          const totalAvailable = availableBatches.reduce((sum, b) => sum + b.quantity, 0);
          
          if (totalAvailable < item.quantity) {
            return { 
              success: false, 
              error: `Insufficient stock for ${item.productName}. Available: ${totalAvailable}, Required: ${item.quantity}` 
            };
          }

          // Deduct from batches using FEFO
          let remainingQty = item.quantity;
          const deductions: BatchDeduction[] = [];

          for (const batch of availableBatches) {
            if (remainingQty <= 0) break;
            
            const batchIndex = updatedBatches.findIndex((b) => b.id === batch.id);
            const deductQty = Math.min(batch.quantity, remainingQty);
            
            updatedBatches[batchIndex] = {
              ...updatedBatches[batchIndex],
              quantity: updatedBatches[batchIndex].quantity - deductQty,
            };

            deductions.push({
              batchId: batch.id,
              batchNumber: batch.batchNumber,
              quantity: deductQty,
              expiryDate: batch.expiryDate,
            });

            remainingQty -= deductQty;
          }

          itemsWithDeductions.push({
            ...item,
            batchDeductions: deductions,
          });
        }

        const subtotal = items.reduce((sum, item) => sum + item.total, 0);
        const discountValue = discount > 0 ? (subtotal * discount / 100) : 0;
        const finalTotal = subtotal - discountValue;

        const saleId = generateId();
        const newSale: Sale = {
          id: saleId,
          items: itemsWithDeductions,
          total: finalTotal,
          paymentMethod,
          createdAt: new Date().toISOString(),
        };

        set({
          sales: [...state.sales, newSale],
          stockBatches: updatedBatches,
        });

        return { success: true, saleId };
      },

      // Add stock purchase (creates a new batch)
      addStockPurchase: (purchase) =>
        set((state) => {
          const newBatch: StockBatch = {
            id: generateId(),
            productId: purchase.productId,
            batchNumber: purchase.batchNumber,
            quantity: purchase.quantity,
            costPrice: purchase.costPrice,
            sellingPrice: purchase.sellingPrice,
            expiryDate: purchase.expiryDate,
            purchaseDate: purchase.purchaseDate,
            supplier: purchase.supplier,
          };

          const newPurchase: StockPurchase = {
            ...purchase,
            id: generateId(),
          };

          return {
            stockPurchases: [...state.stockPurchases, newPurchase],
            stockBatches: [...state.stockBatches, newBatch],
          };
        }),
    }),
    {
      name: 'pharmacy-storage',
    }
  )
);
