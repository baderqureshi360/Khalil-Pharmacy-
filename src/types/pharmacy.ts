export interface StockBatch {
  id: string;
  productId: string;
  batchNumber: string;
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  expiryDate: string;
  purchaseDate: string;
  supplier: string;
}

export interface Product {
  id: string;
  name: string;
  barcode: string;
  category: string;
  price: number;
  costPrice: number;
  minStock: number;
  supplier: string;
  strength?: string; // e.g., "500mg"
  dosageForm?: string; // Tablet, Capsule, Syrup, etc.
  createdAt: string;
}

export interface Sale {
  id: string;
  items: SaleItem[];
  total: number;
  paymentMethod: 'cash' | 'card' | 'mobile';
  createdAt: string;
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  batchDeductions?: BatchDeduction[]; // Track which batches were used
}

export interface BatchDeduction {
  batchId: string;
  batchNumber: string;
  quantity: number;
  expiryDate: string;
}

export interface StockPurchase {
  id: string;
  productId: string;
  productName: string;
  batchNumber: string;
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  total: number;
  supplier: string;
  expiryDate: string;
  purchaseDate: string;
}

export interface DashboardStats {
  todaySales: number;
  totalProducts: number;
  lowStockCount: number;
  expiringCount: number;
  expiredCount: number;
}
