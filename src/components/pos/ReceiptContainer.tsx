import { useReceipt } from '@/contexts/ReceiptContext';
import { ReceiptPrint } from './ReceiptPrint';
import { useRef } from 'react';

/**
 * ReceiptContainer - Renders receipt outside all layouts for printing
 * This component is always in the DOM but hidden when not printing
 * It ensures the receipt is rendered only once and outside all layout structures
 */
export function ReceiptContainer() {
  const { receiptData, showReceipt } = useReceipt();
  const receiptRef = useRef<HTMLDivElement>(null);

  // Only render if we have receipt data
  if (!receiptData) {
    return null;
  }

  return (
    <div
      id="receipt-print-container"
      className="receipt-print-container"
      style={{
        position: 'absolute',
        left: '-9999px',
        top: '-9999px',
        visibility: 'hidden',
        opacity: 0,
        pointerEvents: 'none',
        zIndex: -1,
      }}
      aria-hidden="true"
    >
      <div className="print-receipt">
        <ReceiptPrint
          ref={receiptRef}
          items={receiptData.items}
          total={receiptData.total}
          discount={receiptData.discount}
          finalTotal={receiptData.finalTotal}
          paymentMethod={receiptData.paymentMethod}
          saleId={receiptData.saleId}
        />
      </div>
    </div>
  );
}
