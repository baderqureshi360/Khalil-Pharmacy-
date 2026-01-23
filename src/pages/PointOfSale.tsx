import { useState, useEffect, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { BarcodeScanner } from '@/components/pos/BarcodeScanner';
import { CartItem } from '@/components/pos/CartItem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useProducts, type Product as ProductType } from '@/hooks/useProducts';
import { useSales } from '@/hooks/useSales';
import { useReceipt } from '@/contexts/ReceiptContext';
import { useDebounce } from '@/hooks/useDebounce';
import { formatPKR } from '@/lib/currency';
import { toast } from 'sonner';
import { CreditCard, Banknote, Smartphone, ShoppingBag, Trash2, Printer, Package, AlertTriangle, Percent, Search, X } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { format, parseISO, isBefore, addDays, startOfToday } from 'date-fns';

interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export default function PointOfSale() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountType, setDiscountType] = useState<'percent' | 'rupees'>('percent');
  const [discountValue, setDiscountValue] = useState<string>('');
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingPaymentMethod, setPendingPaymentMethod] = useState<'cash' | 'card' | 'mobile' | null>(null);
  const [search, setSearch] = useState('');
  const [dismissedExpiringAlert, setDismissedExpiringAlert] = useState(false);
  const { products, getProductByBarcode, getProductStock, getAvailableBatches, getExpiringBatches, refetch } = useProducts();
  const { processSale } = useSales();
  const { receiptData, setReceiptData } = useReceipt();
  
  // Debounce search input to reduce filtering operations
  const debouncedSearch = useDebounce(search, 300);
  
  const today = startOfToday();
  const expiringBatches = useMemo(() => getExpiringBatches(30), [getExpiringBatches]);

  // Refetch products and batches when component mounts
  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount - real-time subscriptions handle updates

  // Memoize filtered products calculation to avoid recalculation on every render
  const filteredProducts = useMemo(() => {
    if (!Array.isArray(products)) return [];
    
    return products.filter((product) => {
      if (!product || !product.id) return false;
      
      // Filter out disabled products in POS
      if (product.is_active === false) return false;
      
      if (debouncedSearch && debouncedSearch.trim() !== '') {
        const searchLower = debouncedSearch.toLowerCase().trim();
        const matchesName = product.name?.toLowerCase().includes(searchLower) || false;
        const matchesBarcode = product.barcode?.toLowerCase().includes(searchLower) || false;
        // Check for salt_formula if it exists on the product (for database products)
        const matchesSaltFormula = (product as ProductType).salt_formula?.toLowerCase().includes(searchLower) || false;
        
        if (!matchesName && !matchesBarcode && !matchesSaltFormula) {
          return false;
        }
      }
      
      return true;
    });
  }, [products, debouncedSearch]);

  const handleScan = (barcode: string) => {
    const product = getProductByBarcode(barcode);
    
    if (!product) {
      toast.error('Product not found', {
        description: `No product with barcode ${barcode}`,
      });
      return;
    }

    const availableStock = getProductStock(product.id);
    
    if (availableStock <= 0) {
      toast.error('Out of stock', {
        description: `${product.name} is out of stock or expired`,
      });
      return;
    }

    const existingItem = cart.find((item) => item.productId === product.id);
    const currentQtyInCart = existingItem?.quantity || 0;
    
    if (currentQtyInCart >= availableStock) {
      toast.error('Insufficient stock', {
        description: `Only ${availableStock} units available (non-expired)`,
      });
      return;
    }
    
    // Get rack location if available
    const rackLocation = (product as ProductType).rack?.name || 'N/A';
    
    // Get available batches once to avoid duplicate calls
    const availableBatchesForPrice = getAvailableBatches(product.id);
    const unitPrice = availableBatchesForPrice.length > 0 
      ? availableBatchesForPrice[0].selling_price 
      : 0; // Fallback to 0 if no batches (shouldn't happen if stock > 0)

    if (existingItem) {
      setCart((prevCart) => prevCart.map((item) =>
        item.productId === product.id
          ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.unitPrice }
          : item
      ));
    } else {
      // Check if earliest batch is expiring soon (within 30 days)
      if (availableBatchesForPrice.length > 0) {
        const earliestBatch = availableBatchesForPrice[0];
        const expiryDate = parseISO(earliestBatch.expiry_date);
        if (isBefore(expiryDate, addDays(today, 30))) {
          toast.warning(`Expiring soon!`, {
            description: `${product.name} batch expires on ${format(expiryDate, 'MMM d, yyyy')}`,
          });
        }
      }

      setCart((prevCart) => [...prevCart, {
        productId: product.id,
        productName: `${product.name}${product.strength ? ` ${product.strength}` : ''}`,
        quantity: 1,
        unitPrice,
        total: unitPrice,
      }]);
    }

    // Show product details including rack location
    const productDetails = [
      `Product: ${product.name}${product.strength ? ` ${product.strength}` : ''}`,
      `Barcode: ${barcode}`,
      `Price: ${formatPKR(unitPrice)}`,
      `Quantity: ${availableStock}`,
      `Rack: ${rackLocation}`,
    ].join(' • ');

    toast.success('Added to cart', {
      description: productDetails,
      duration: 4000,
    });
  };

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    const availableStock = getProductStock(productId);
    if (quantity > availableStock) {
      toast.error('Insufficient stock', {
        description: `Only ${availableStock} units available (non-expired)`,
      });
      return;
    }

    setCart((prevCart) => prevCart.map((item) =>
      item.productId === productId
        ? { ...item, quantity, total: quantity * item.unitPrice }
        : item
    ));
  };

  const handleRemoveItem = (productId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.productId !== productId));
  };

  const handleClearCart = () => {
    setCart([]);
    setDiscountValue('');
    toast.info('Cart cleared');
  };

  const handleFinalizeOrder = async (paymentMethod: 'cash' | 'card' | 'mobile') => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    // Calculate totals with discount
    const subtotal = Array.isArray(cart) ? cart.reduce((sum, item) => sum + (item?.total || 0), 0) : 0;
    const discountAmount = discountValue 
      ? (discountType === 'percent' 
          ? (subtotal * parseFloat(discountValue) / 100)
          : parseFloat(discountValue))
      : 0;
    const finalTotal = Math.max(0, subtotal - discountAmount);

    // Convert cart items to the format expected by processSale
    const cartItems = cart.map(item => {
      const product = products.find(p => p.id === item.productId);
      return {
        product_id: item.productId,
        product_name: item.productName,
        strength: product?.strength || null,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total: item.total,
        available_stock: getProductStock(item.productId),
      };
    });

    // Helper function to get available batches in the format expected by processSale
    const getAvailableBatchesForSale = (productId: string) => {
      const availableBatches = getAvailableBatches(productId);
      return availableBatches.map(batch => ({
        id: batch.id,
        batch_number: batch.batch_number,
        quantity: batch.quantity,
        expiry_date: batch.expiry_date,
      }));
    };

    const result = await processSale(cartItems, paymentMethod, getAvailableBatchesForSale);
    
    if (!result.success) {
      toast.error('Sale failed', {
        description: result.error,
      });
      setShowConfirmation(false);
      setPendingPaymentMethod(null);
      return;
    }

    // Refetch products and batches to get updated stock quantities
    await refetch();
    
    // Set receipt data in context for printing
    const receiptNumber = result.sale?.receipt_number || '';
    setReceiptData({
      items: [...cart],
      total: subtotal,
      discount: discountAmount,
      finalTotal,
      paymentMethod,
      saleId: receiptNumber,
    });
    // Don't set showReceipt - receipt container stays hidden off-screen
    // It will only be visible during print via CSS
    setShowReceiptDialog(true);
    setShowConfirmation(false);
    setPendingPaymentMethod(null);
    setCart([]);
    setDiscountValue('');
    
    toast.success('Sale completed!', {
      description: `Payment received via ${paymentMethod}. Stock deducted using FEFO.`,
    });
  };

  const handleCheckout = (paymentMethod: 'cash' | 'card' | 'mobile') => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    setPendingPaymentMethod(paymentMethod);
    setShowConfirmation(true);
  };

  const handlePrint = () => {
    // Close the modal first to prevent it from printing
    setShowReceiptDialog(false);
    // Small delay to ensure DOM is updated and modal is closed
    // The receipt container is always in DOM (when receiptData exists) but hidden off-screen
    // Print CSS will make it visible during print
    setTimeout(() => {
      window.print();
    }, 300);
  };

  const subtotal = Array.isArray(cart) ? cart.reduce((sum, item) => sum + (item?.total || 0), 0) : 0;
  const discountAmount = discountValue 
    ? (discountType === 'percent' 
        ? (subtotal * parseFloat(discountValue) / 100)
        : parseFloat(discountValue))
    : 0;
  const finalTotal = Math.max(0, subtotal - discountAmount);
  const itemCount = Array.isArray(cart) ? cart.reduce((sum, item) => sum + (item?.quantity || 0), 0) : 0;

  return (
    <MainLayout>
      <div className="p-4 sm:p-6 lg:p-8 h-[calc(100vh-4rem)] lg:h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 flex-1 min-h-0">
          {/* Products Grid */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="page-header mb-4 sm:mb-8 flex-shrink-0">
              <h1 className="page-title text-2xl sm:text-3xl">Point of Sale</h1>
              <p className="page-subtitle text-sm sm:text-base">Scan barcode or select products • FEFO auto-deduction active</p>
            </div>

            {/* Expiring Soon Alert */}
            {expiringBatches.length > 0 && !dismissedExpiringAlert && (
              <div className="mb-4 p-3 bg-warning/10 border border-warning/30 rounded-xl flex items-start sm:items-center gap-3 relative flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5 sm:mt-0" />
                <p className="text-xs sm:text-sm text-warning flex-1">
                  <strong>{expiringBatches.length} batch(es)</strong> expiring within 30 days. These will be sold first (FEFO).
                </p>
                <button
                  onClick={() => setDismissedExpiringAlert(true)}
                  className="absolute right-2 top-2 rounded-md p-1 text-warning/70 hover:text-warning hover:bg-warning/20 transition-colors focus:outline-none focus:ring-2 focus:ring-warning/50"
                  aria-label="Dismiss notification"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            <div className="mb-4 sm:mb-6 space-y-3 sm:space-y-4 flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, barcode, or salt/formula..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 h-10 sm:h-9"
                />
              </div>
              <BarcodeScanner onScan={handleScan} />
            </div>

            <div className="flex-1 overflow-auto pr-0 sm:pr-2 min-h-0">
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {filteredProducts.map((product) => {
                  if (!product || !product.id) return null;
                  // Memoize expensive computations per product
                  const stock = getProductStock(product.id);
                  const availableBatches = getAvailableBatches(product.id);
                  const isLowStock = stock <= (product.min_stock || 0);
                  const hasExpiringSoon = Array.isArray(availableBatches) && availableBatches.some(b => b && b.expiry_date && isBefore(parseISO(b.expiry_date), addDays(today, 30)));
                  const price = availableBatches.length > 0 
                    ? availableBatches[0].selling_price 
                    : 0;
                  
                  return (
                    <button
                      key={product.id}
                      onClick={() => product.barcode && handleScan(product.barcode)}
                      disabled={stock <= 0}
                      className="product-card text-left disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none relative"
                    >
                      {hasExpiringSoon && stock > 0 && (
                        <div className="absolute -top-1 -right-1">
                          <span className="flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-warning"></span>
                          </span>
                        </div>
                      )}
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Package className="w-5 h-5 text-primary" />
                        </div>
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                          stock <= 0
                            ? 'bg-destructive/10 text-destructive'
                            : isLowStock 
                              ? 'bg-warning/15 text-warning' 
                              : 'bg-muted text-muted-foreground'
                        }`}>
                          {stock} left
                        </span>
                      </div>
                      <p className="font-semibold text-foreground truncate mb-0.5">{product.name}</p>
                      {product.strength && (
                        <p className="text-xs text-primary font-medium mb-1">{product.strength}</p>
                      )}
                      <p className="text-sm text-muted-foreground mb-1">{product.category || 'Uncategorized'}</p>
                      {product.rack?.name && (
                        <p className="text-xs font-medium mb-2" style={{ color: product.rack.color }}>
                          Rack: {product.rack.name}
                        </p>
                      )}
                      <p className="price-tag">{formatPKR(price)}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Cart */}
          <div className="w-full lg:w-96 cart-panel flex flex-col max-h-[50vh] lg:max-h-[calc(100vh-2rem)] lg:sticky lg:top-4 lg:self-start">
            <div className="p-4 sm:p-5 border-b border-border flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <ShoppingBag className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-semibold text-foreground truncate">Cart</h2>
                    <p className="text-sm text-muted-foreground">{itemCount} items</p>
                  </div>
                </div>
                {cart.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearCart}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4 sm:mr-1" />
                    <span className="hidden sm:inline">Clear</span>
                  </Button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-3 min-h-0">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
                  <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                    <ShoppingBag className="w-8 h-8 opacity-50" />
                  </div>
                  <p className="font-medium">Cart is empty</p>
                  <p className="text-sm text-center">Scan a product to get started</p>
                </div>
              ) : (
                Array.isArray(cart) && cart.map((item) => {
                  if (!item || !item.productId) return null;
                  return (
                    <CartItem
                      key={item.productId}
                      item={item}
                      onUpdateQuantity={(qty) => handleUpdateQuantity(item.productId, qty)}
                      onRemove={() => handleRemoveItem(item.productId)}
                    />
                  );
                })
              )}
            </div>

            <div className="p-4 sm:p-5 border-t border-border space-y-4 bg-muted/30 flex-shrink-0">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Subtotal</span>
                  <span className="text-sm font-medium">{formatPKR(subtotal)}</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                    <Label className="text-sm text-muted-foreground whitespace-nowrap flex-shrink-0">Discount Type:</Label>
                    <ToggleGroup
                      type="single"
                      value={discountType}
                      onValueChange={(value) => {
                        if (value === 'percent' || value === 'rupees') {
                          setDiscountType(value);
                          setDiscountValue(''); // Clear discount when switching type
                        }
                      }}
                      className="flex-shrink-0"
                    >
                      <ToggleGroupItem value="percent" aria-label="Discount Percentage" className="text-xs sm:text-sm whitespace-nowrap">
                        Discount %
                      </ToggleGroupItem>
                      <ToggleGroupItem value="rupees" aria-label="Discount Rupees" className="text-xs sm:text-sm whitespace-nowrap">
                        Discount Rs
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                    <Label htmlFor="discount" className="text-sm text-muted-foreground whitespace-nowrap">
                      {discountType === 'percent' ? 'Discount (%)' : 'Discount (Rs)'}
                    </Label>
                    <div className="relative w-full sm:flex-1">
                      {discountType === 'percent' ? (
                        <Percent className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      ) : (
                        <Banknote className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      )}
                      <Input
                        id="discount"
                        type="number"
                        min="0"
                        max={discountType === 'percent' ? '100' : subtotal.toString()}
                        step={discountType === 'percent' ? '0.1' : '1'}
                        value={discountValue}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '') {
                            setDiscountValue('');
                            return;
                          }
                          const numVal = parseFloat(val);
                          if (isNaN(numVal) || numVal < 0) {
                            return;
                          }
                          if (discountType === 'percent' && numVal > 100) {
                            return;
                          }
                          if (discountType === 'rupees' && numVal > subtotal) {
                            return;
                          }
                          setDiscountValue(val);
                        }}
                        placeholder="0"
                        className="pl-8 h-10 sm:h-9"
                      />
                    </div>
                  </div>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="text-destructive font-medium">-{formatPKR(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-border">
                  <span className="text-base sm:text-lg font-semibold text-foreground">Total</span>
                  <span className="text-xl sm:text-2xl font-bold text-primary">{formatPKR(finalTotal)}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <Button
                  onClick={() => handleCheckout('cash')}
                  disabled={cart.length === 0}
                  className="btn-checkout bg-primary hover:bg-primary/90 h-12 sm:h-auto py-3 sm:py-4"
                >
                  <Banknote className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="text-xs">Cash</span>
                </Button>
                <Button
                  onClick={() => handleCheckout('card')}
                  disabled={cart.length === 0}
                  className="btn-checkout bg-primary hover:bg-primary/90 h-12 sm:h-auto py-3 sm:py-4"
                >
                  <CreditCard className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="text-xs">Card</span>
                </Button>
                <Button
                  onClick={() => handleCheckout('mobile')}
                  disabled={cart.length === 0}
                  className="btn-checkout bg-primary hover:bg-primary/90 h-12 sm:h-auto py-3 sm:py-4"
                >
                  <Smartphone className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="text-xs">Mobile</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Order Confirmation Dialog */}
      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Order</AlertDialogTitle>
            <AlertDialogDescription>
              Review your order before finalizing. This action will complete the sale and deduct stock.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-96 overflow-auto space-y-4 py-4">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Items:</h4>
              <div className="space-y-2">
                {cart.map((item) => (
                  <div key={item.productId} className="flex justify-between items-start text-sm p-2 bg-muted/50 rounded">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium break-words">{item.productName}</p>
                      <p className="text-muted-foreground">Qty: {item.quantity} × {formatPKR(item.unitPrice)}</p>
                    </div>
                    <p className="font-semibold ml-4">{formatPKR(item.total)}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t border-border pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span>{formatPKR(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Discount {discountType === 'percent' ? `(${discountValue}%)` : `(Rs ${discountValue})`}:
                  </span>
                  <span className="text-destructive">-{formatPKR(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-border">
                <span className="font-semibold">Final Total:</span>
                <span className="text-lg font-bold text-primary">{formatPKR(finalTotal)}</span>
              </div>
              <div className="pt-2">
                <p className="text-sm text-muted-foreground">
                  Payment Method: <span className="capitalize font-medium">{pendingPaymentMethod}</span>
                </p>
              </div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowConfirmation(false);
              setPendingPaymentMethod(null);
            }}>
              Add More
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingPaymentMethod && handleFinalizeOrder(pendingPaymentMethod)}>
              Confirm Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Receipt Preview Dialog */}
      <Dialog open={showReceiptDialog} onOpenChange={(open) => {
        setShowReceiptDialog(open);
        // Clear receipt data when dialog closes
        if (!open) {
          setReceiptData(null);
        }
      }}>
        <DialogContent className="max-w-md w-[95vw] sm:w-auto max-h-[90vh] overflow-y-auto no-print">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="w-5 h-5" />
              Sale Completed Successfully
            </DialogTitle>
            <DialogDescription>
              Your receipt is ready to print. Click the button below to print it.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center space-y-4 py-4">
            {/* Simple receipt summary - NOT the actual receipt component */}
            {receiptData && (
              <div className="w-full space-y-3 p-4 bg-muted/50 rounded-lg border border-border">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Receipt #:</span>
                  <span className="text-sm font-semibold">{receiptData.saleId}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Items:</span>
                  <span className="text-sm font-semibold">{receiptData.items.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total:</span>
                  <span className="text-lg font-bold text-primary">{formatPKR(receiptData.finalTotal)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Payment:</span>
                  <span className="text-sm font-semibold capitalize">{receiptData.paymentMethod}</span>
                </div>
              </div>
            )}
            
            <Button onClick={handlePrint} className="w-full no-print">
              <Printer className="w-4 h-4 mr-2" />
              Print Receipt
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
