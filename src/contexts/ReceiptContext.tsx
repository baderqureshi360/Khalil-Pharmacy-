import { createContext, useContext, useState, ReactNode } from 'react';
import { SaleItem } from '@/types/pharmacy';

interface ReceiptData {
  items: SaleItem[];
  total: number;
  discount: number;
  finalTotal: number;
  paymentMethod: string;
  saleId: string;
}

interface ReceiptContextType {
  receiptData: ReceiptData | null;
  showReceipt: boolean;
  setReceiptData: (data: ReceiptData | null) => void;
  setShowReceipt: (show: boolean) => void;
}

const ReceiptContext = createContext<ReceiptContextType | undefined>(undefined);

export function ReceiptProvider({ children }: { children: ReactNode }) {
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  return (
    <ReceiptContext.Provider
      value={{
        receiptData,
        showReceipt,
        setReceiptData,
        setShowReceipt,
      }}
    >
      {children}
    </ReceiptContext.Provider>
  );
}

export function useReceipt() {
  const context = useContext(ReceiptContext);
  if (context === undefined) {
    throw new Error('useReceipt must be used within a ReceiptProvider');
  }
  return context;
}
