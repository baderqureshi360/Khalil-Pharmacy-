import { forwardRef } from 'react';
import { SaleItem } from '@/types/pharmacy';
import { formatPKR } from '@/lib/currency';
import { format } from 'date-fns';

interface ReceiptPrintProps {
  items: SaleItem[];
  total: number;
  discount?: number;
  finalTotal?: number;
  paymentMethod: string;
  saleId?: string;
}

export const ReceiptPrint = forwardRef<HTMLDivElement, ReceiptPrintProps>(
  ({ items, total, discount = 0, finalTotal, paymentMethod, saleId }, ref) => {
    const displayTotal = finalTotal !== undefined ? finalTotal : total;
    return (
      <div
        ref={ref}
        className="receipt-content bg-white text-black p-6 w-[300px] font-mono text-sm"
        style={{ fontFamily: 'monospace' }}
      >
        {/* Header */}
        <div className="receipt-header text-center border-b border-dashed border-gray-400 pb-4 mb-4">
          <h1 className="text-xl font-bold">Health Haven Pharmacy</h1>
          <p className="text-xs mt-1">Azam Chowk Sector#2, Khalabat Township Haripur</p>
          <p className="text-xs text-gray-600 mt-2">
            {format(new Date(), 'MMM dd, yyyy hh:mm a')}
          </p>
          {saleId && (
            <p className="text-xs text-gray-600">Receipt #: {saleId}</p>
          )}
        </div>

        {/* Items */}
        <div className="receipt-items border-b border-dashed border-gray-400 pb-4 mb-4">
          <div className="flex justify-between text-xs font-bold mb-2">
            <span>Item</span>
            <span>Amount</span>
          </div>
          {items.map((item, index) => (
            <div key={index} className="receipt-item mb-2">
              <div className="flex justify-between">
                <span className="truncate max-w-[180px]">{item.productName}</span>
                <span className="font-semibold">{formatPKR(item.total)}</span>
              </div>
              <div className="text-xs text-gray-600">
                {item.quantity} × {formatPKR(item.unitPrice)}
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="receipt-totals space-y-1 mb-4">
          <div className="flex justify-between text-xs">
            <span>Subtotal:</span>
            <span>{formatPKR(total)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-xs">
              <span>Discount:</span>
              <span className="text-red-600">-{formatPKR(discount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base border-t border-gray-400 pt-2 mt-2">
            <span>TOTAL:</span>
            <span>{formatPKR(displayTotal)}</span>
          </div>
        </div>

        {/* Payment Info */}
        <div className="receipt-footer text-center border-t border-dashed border-gray-400 pt-4">
          <p className="text-xs">
            Payment Method: <span className="capitalize font-semibold">{paymentMethod}</span>
          </p>
          <p className="text-xs mt-3 font-semibold text-gray-700">No return after 2 days</p>
          <p className="text-xs mt-3 text-gray-600">Thank you for choosing Health Haven Pharmacy.</p>
          <div className="mt-4 text-xs text-gray-400">
            --------------------------------
          </div>
        </div>
      </div>
    );
  }
);

ReceiptPrint.displayName = 'ReceiptPrint';
