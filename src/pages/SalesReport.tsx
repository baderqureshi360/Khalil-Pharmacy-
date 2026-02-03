import { useMemo, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useSales } from '@/hooks/useSales';
import { useProducts } from '@/hooks/useProducts';
import { formatPKR } from '@/lib/currency';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, differenceInDays } from 'date-fns';
import { Banknote, Receipt, TrendingUp, Calendar, Package, Download, Search, RotateCcw } from 'lucide-react';
import { StatCard } from '@/components/dashboard/StatCard';
import { toast } from 'sonner';

export default function SalesReport() {
  const { sales, loading, getSaleByReceipt, processReturn } = useSales();
  const { batches } = useProducts();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  // Return functionality state
  const [returnReceipt, setReturnReceipt] = useState('');
  const [foundSale, setFoundSale] = useState<any>(null);
  const [selectedReturnItems, setSelectedReturnItems] = useState<Record<string, number>>({}); // sale_item_id -> quantity
  const [returnReason, setReturnReason] = useState('');
  const [isProcessingReturn, setIsProcessingReturn] = useState(false);
  const [returnExpired, setReturnExpired] = useState(false);

  const filteredSales = useMemo(() => {
    if (!sales || !Array.isArray(sales)) return [];

    return sales.filter((sale) => {
      if (!sale?.created_at) return false;
      const saleDate = new Date(sale.created_at);

      if (dateFrom && dateTo) {
        return isWithinInterval(saleDate, {
          start: startOfDay(parseISO(dateFrom)),
          end: endOfDay(parseISO(dateTo)),
        });
      }
      if (dateFrom) {
        return saleDate >= startOfDay(parseISO(dateFrom));
      }
      if (dateTo) {
        return saleDate <= endOfDay(parseISO(dateTo));
      }
      return true;
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [sales, dateFrom, dateTo]);

  // Helper function to get cost price from batch
  const getCostPrice = (productId: string, batchDeductions: any) => {
    if (!batchDeductions || !Array.isArray(batchDeductions) || batchDeductions.length === 0) {
      return 0;
    }

    // Get the first batch's cost price (FEFO ensures we use the oldest batch)
    const firstBatchId = batchDeductions[0]?.batch_id;
    if (!firstBatchId) return 0;

    const batch = batches.find(b => b.id === firstBatchId);
    return batch?.cost_price || 0;
  };

  // Helper function to calculate profit for a single item
  const calculateItemProfit = (item: any) => {
    if (!item) return 0;
    const costPrice = getCostPrice(item.product_id, item.batch_deductions);
    return (item.unit_price - costPrice) * item.quantity;
  };

  // Helper function to calculate total profit for a sale
  const calculateSaleProfit = (sale: any) => {
    if (!sale?.items || !Array.isArray(sale.items)) return 0;
    return sale.items.reduce((sum: number, item: any) => sum + calculateItemProfit(item), 0);
  };

  const stats = useMemo(() => {
    let totalRevenue = filteredSales.reduce((sum, sale) => sum + (sale?.total || 0), 0);
    const totalTransactions = filteredSales.length;
    let totalItems = filteredSales.reduce((sum, sale) =>
      sum + (sale?.items?.reduce((itemSum: number, item: any) => itemSum + (item?.quantity || 0), 0) || 0), 0
    );
    let totalProfit = filteredSales.reduce((sum, sale) => sum + calculateSaleProfit(sale), 0);
    
    // Deduct returns
    filteredSales.forEach(sale => {
      if (sale.returns && Array.isArray(sale.returns)) {
        sale.returns.forEach((ret: any) => {
          if (ret.return_items && Array.isArray(ret.return_items)) {
            ret.return_items.forEach((retItem: any) => {
              const originalItem = sale.items?.find((i: any) => i.id === retItem.sale_item_id);
              if (originalItem) {
                const refundAmount = originalItem.unit_price * retItem.quantity;
                const costPrice = getCostPrice(originalItem.product_id, originalItem.batch_deductions);
                const profitDeduction = (originalItem.unit_price - costPrice) * retItem.quantity;
                
                totalRevenue -= refundAmount;
                totalProfit -= profitDeduction;
                totalItems -= retItem.quantity;
              }
            });
          }
        });
      }
    });

    const avgTransaction = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

    return { totalRevenue, totalTransactions, avgTransaction, totalItems, totalProfit };
  }, [filteredSales, batches]);

  const totalRefundAmount = useMemo(() => {
    if (!foundSale || !selectedReturnItems) return 0;
    return Object.entries(selectedReturnItems).reduce((sum, [itemId, qty]) => {
      const item = foundSale.items.find((i: any) => i.id === itemId);
      if (!item) return sum;
      return sum + (item.unit_price * qty);
    }, 0);
  }, [foundSale, selectedReturnItems]);

  const handleSearchReceipt = async () => {
    if (!returnReceipt.trim()) {
      toast.error('Please enter a receipt number');
      return;
    }
    
    setFoundSale(null);
    setSelectedReturnItems({});
    setReturnExpired(false);
    
    const sale = await getSaleByReceipt(returnReceipt);
    if (sale) {
      setFoundSale(sale);
      
      // Check for expiry (2 days)
      const saleDate = new Date(sale.created_at);
      const today = new Date();
      const diff = differenceInDays(today, saleDate);
      
      // If receipt age > 2 days -> Return not allowed
      if (diff > 2) {
        setReturnExpired(true);
        toast.error('Return period expired (limit: 2 days)');
      } else {
        setReturnExpired(false);
        toast.success('Sale record found');
      }
    } else {
      toast.error('Receipt not found');
    }
  };

  const handleReturnItemChange = (saleItemId: string, checked: boolean) => {
    if (checked) {
      // Default to 1 or max quantity if 1
      const item = foundSale.items.find((i: any) => i.id === saleItemId);
      if (item) {
        // Calculate max returnable (sold - already returned)
        let alreadyReturned = 0;
        if (foundSale.returns) {
           foundSale.returns.forEach((ret: any) => {
             ret.return_items.forEach((ri: any) => {
               if (ri.sale_item_id === saleItemId) {
                 alreadyReturned += ri.quantity;
               }
             });
           });
        }
        const maxReturnable = item.quantity - alreadyReturned;
        
        if (maxReturnable <= 0) {
          toast.error('This item has already been fully returned');
          return;
        }
        
        setSelectedReturnItems(prev => ({
          ...prev,
          [saleItemId]: 1
        }));
      }
    } else {
      const newItems = { ...selectedReturnItems };
      delete newItems[saleItemId];
      setSelectedReturnItems(newItems);
    }
  };

  const handleQuantityChange = (saleItemId: string, qty: number) => {
    const item = foundSale.items.find((i: any) => i.id === saleItemId);
    if (!item) return;

    let alreadyReturned = 0;
    if (foundSale.returns) {
       foundSale.returns.forEach((ret: any) => {
         ret.return_items.forEach((ri: any) => {
           if (ri.sale_item_id === saleItemId) {
             alreadyReturned += ri.quantity;
           }
         });
       });
    }
    const maxReturnable = item.quantity - alreadyReturned;

    if (qty > maxReturnable) {
      toast.error(`Cannot return more than sold/remaining quantity (${maxReturnable})`);
      return;
    }
    if (qty < 1) return;

    setSelectedReturnItems(prev => ({
      ...prev,
      [saleItemId]: qty
    }));
  };

  const handleSubmitReturn = async () => {
    if (!foundSale) return;
    if (Object.keys(selectedReturnItems).length === 0) {
      toast.error('Please select items to return');
      return;
    }
    if (!returnReason.trim()) {
      toast.error('Please enter a reason for return');
      return;
    }

    setIsProcessingReturn(true);
    
    const returnItemsList = Object.entries(selectedReturnItems).map(([saleItemId, quantity]) => {
      const item = foundSale.items.find((i: any) => i.id === saleItemId);
      return {
        sale_item_id: saleItemId,
        product_id: item.product_id,
        quantity: quantity,
        batch_deductions: item.batch_deductions
      };
    });

    const result = await processReturn(foundSale.id, returnItemsList, returnReason);
    
    setIsProcessingReturn(false);
    
    if (result.success) {
      toast.success('Return processed successfully');
      setFoundSale(null);
      setReturnReceipt('');
      setSelectedReturnItems({});
      setReturnReason('');
    } else {
      toast.error(result.error || 'Failed to process return');
    }
  };

  const handleDownloadCSV = () => {
    if (filteredSales.length === 0) {
      toast.error('No sales data to download');
      return;
    }

    // Prepare CSV data
    const headers = ['Sale ID', 'Date & Time', 'Product Name', 'Quantity', 'Unit Price', 'Subtotal', 'Discount', 'Total', 'Payment Method'];
    const rows: string[][] = [];

    filteredSales.forEach((sale) => {
      if (!sale?.items || !Array.isArray(sale.items)) return;

      sale.items.forEach((item: any, idx: number) => {
        const saleDate = format(new Date(sale.created_at), 'yyyy-MM-dd HH:mm:ss');
        const discount = (sale as any).discount || 0;
        const itemDiscount = idx === 0 ? discount : 0; // Apply discount only to first item row
        const itemTotal = idx === 0 && sale.items!.length === 1
          ? sale.total
          : item.total - (idx === 0 ? discount / sale.items!.length : 0);

        rows.push([
          sale.id,
          saleDate,
          item.product_name || '',
          item.quantity?.toString() || '0',
          formatPKR(item.unit_price || 0).replace('PKR ', ''),
          formatPKR(item.total || 0).replace('PKR ', ''),
          idx === 0 ? formatPKR(discount).replace('PKR ', '') : '0',
          formatPKR(itemTotal).replace('PKR ', ''),
          sale.payment_method || '',
        ]);
      });
    });

    // Convert to CSV string
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `sales-report-${dateFrom || 'all'}-${dateTo || 'all'}-${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Sales report downloaded successfully');
  };

  const handleDownloadExcel = () => {
    // For Excel, we'll create a CSV with .xlsx extension or use a library
    // Since we don't want to add new libraries, we'll create a more Excel-friendly CSV
    handleDownloadCSV();
    toast.info('Downloaded as CSV (Excel-compatible)');
  };

  return (
    <MainLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="page-header mb-6 sm:mb-8">
          <h1 className="page-title text-2xl sm:text-3xl">Sales Report</h1>
          <p className="page-subtitle text-sm sm:text-base">View and analyze your sales data</p>
        </div>

        <Tabs defaultValue="report" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-8">
            <TabsTrigger value="report">Sales Report</TabsTrigger>
            <TabsTrigger value="return">Sales Return</TabsTrigger>
          </TabsList>

          <TabsContent value="report" className="space-y-6">
            {/* Date Filter */}
            <div className="bg-card rounded-2xl border border-border/60 p-4 sm:p-5 mb-4 sm:mb-6 shadow-sm">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 flex-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="dateFrom" className="text-sm text-muted-foreground whitespace-nowrap">From</Label>
                    <Input
                      id="dateFrom"
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full sm:w-44 h-10 sm:h-9"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="dateTo" className="text-sm text-muted-foreground whitespace-nowrap">To</Label>
                    <Input
                      id="dateTo"
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full sm:w-44 h-10 sm:h-9"
                    />
                  </div>
                </div>
                {(dateFrom || dateTo) && (
                  <button
                    onClick={() => { setDateFrom(''); setDateTo(''); }}
                    className="text-sm text-primary hover:underline font-medium whitespace-nowrap"
                  >
                    Clear filter
                  </button>
                )}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={handleDownloadCSV} variant="outline" size="sm" className="flex-1 sm:flex-initial">
                <Download className="w-4 h-4 mr-2" />
                Download CSV
              </Button>
              <Button onClick={handleDownloadExcel} variant="outline" size="sm" className="flex-1 sm:flex-initial">
                <Download className="w-4 h-4 mr-2" />
                Download Excel
              </Button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <StatCard
            title="Total Revenue"
            value={formatPKR(stats.totalRevenue)}
            icon={<Banknote className="w-6 h-6" />}
            variant="success"
          />
          <StatCard
            title="Transactions"
            value={stats.totalTransactions}
            icon={<Receipt className="w-6 h-6" />}
          />
          <StatCard
            title="Avg. Transaction"
            value={formatPKR(stats.avgTransaction)}
            icon={<TrendingUp className="w-6 h-6" />}
          />
          <StatCard
            title="Items Sold"
            value={stats.totalItems}
            icon={<Package className="w-6 h-6" />}
          />
        </div>

        {/* Sales Table */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="table-header">
                  <TableHead>Sale ID</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                        <Receipt className="w-8 h-8 text-muted-foreground/50 animate-pulse" />
                      </div>
                      <p className="text-muted-foreground font-medium">Loading sales...</p>
                    </TableCell>
                  </TableRow>
                ) : filteredSales.map((sale) => (
                  <TableRow key={sale.id} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-sm">#{sale.id}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {sale.items?.map((item: any, idx: number) => (
                          <div key={idx} className="text-sm">
                            <span className="font-medium">{item.product_name || 'Unknown'}</span>
                            <span className="text-muted-foreground"> × {item.quantity || 0}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              (Profit: {formatPKR(calculateItemProfit(item))})
                            </span>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {sale.payment_method || 'N/A'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(sale.created_at), 'MMM d, yyyy h:mm a')}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-lg text-primary">
                      {formatPKR(sale.total || 0)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-primary">
                      {formatPKR(calculateSaleProfit(sale))}
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && filteredSales.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                        <Receipt className="w-8 h-8 text-muted-foreground/50" />
                      </div>
                      <p className="text-muted-foreground font-medium">No sales found</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {dateFrom || dateTo
                          ? 'Try adjusting your date filter'
                          : 'Sales will appear here once you make your first sale'}
                      </p>
                    </TableCell>
                  </TableRow>
                )}
                {!loading && filteredSales.length > 0 && (
                  <TableRow className="bg-muted/50 font-semibold border-t-2">
                    <TableCell colSpan={4} className="text-right">Total:</TableCell>
                    <TableCell className="text-right font-semibold text-lg text-primary">
                      {formatPKR(stats.totalRevenue)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-lg text-primary">
                      {formatPKR(stats.totalProfit)}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="return" className="space-y-6">
        <div className="bg-card rounded-2xl border border-border/60 p-6 shadow-sm">
          <div className="max-w-xl mx-auto space-y-6">
            <div className="space-y-2">
              <Label>Receipt Number</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter receipt number (e.g. RCP-2024...)"
                  value={returnReceipt}
                  onChange={(e) => setReturnReceipt(e.target.value)}
                />
                <Button onClick={handleSearchReceipt}>
                  <Search className="w-4 h-4 mr-2" />
                  Search
                </Button>
              </div>
            </div>

            {foundSale && (
              <div className="space-y-6 animate-in fade-in-50">
                <div className="bg-muted/30 p-4 rounded-lg space-y-2">
                   <div className="flex justify-between items-center">
                     <span className="font-semibold">Sale #{foundSale.receipt_number}</span>
                     <span className="text-muted-foreground text-sm">{format(new Date(foundSale.created_at), 'PPP p')}</span>
                   </div>
                   <div className="flex justify-between items-center text-sm">
                     <span>Payment: {foundSale.payment_method}</span>
                     <span>Total: {formatPKR(foundSale.total)}</span>
                   </div>
                </div>

                {/* Return Status Banner */}
                {returnExpired ? (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-center gap-3">
                    <div className="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-xl">❌</span>
                    </div>
                    <div>
                      <p className="font-bold">Expired – Return Not Allowed</p>
                      <p className="text-sm">This receipt is older than 2 days.</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg flex items-center gap-3">
                    <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-xl">✅</span>
                    </div>
                    <div>
                      <p className="font-bold">Return Available</p>
                      <p className="text-sm">This receipt is within the 2-day return policy.</p>
                    </div>
                  </div>
                )}

                {/* Returned Items History */}
                {foundSale.returns && foundSale.returns.some((r: any) => r.return_items && r.return_items.length > 0) && (
                  <div className="space-y-4">
                    <Label>Returned Items History</Label>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                             <TableHead>Product</TableHead>
                             <TableHead>Qty Returned</TableHead>
                             <TableHead>Return Receipt</TableHead>
                             <TableHead>Return Date</TableHead>
                             <TableHead className="text-right">Amount Deducted</TableHead>
                             <TableHead className="text-right">Profit Deducted</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {foundSale.returns.map((ret: any) => 
                            ret.return_items.map((ri: any) => {
                               const originalItem = foundSale.items.find((i: any) => i.id === ri.sale_item_id);
                               const amountDeducted = originalItem ? originalItem.unit_price * ri.quantity : 0;
                               const costPrice = originalItem ? getCostPrice(originalItem.product_id, originalItem.batch_deductions) : 0;
                               const profitDeducted = originalItem ? (originalItem.unit_price - costPrice) * ri.quantity : 0;
                               
                               return (
                                 <TableRow key={ri.id}>
                                   <TableCell className="font-medium">{originalItem?.product_name || 'Unknown'}</TableCell>
                                   <TableCell>{ri.quantity}</TableCell>
                                   <TableCell>{ret.receipt_number}</TableCell>
                                   <TableCell>{format(new Date(ret.created_at), 'yyyy-MM-dd')}</TableCell>
                                   <TableCell className="text-right">{formatPKR(amountDeducted)}</TableCell>
                                   <TableCell className="text-right">{formatPKR(profitDeducted)}</TableCell>
                                 </TableRow>
                               );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <Label>Select Items to Return</Label>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]">Select</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Sold Qty</TableHead>
                          <TableHead className="text-right">Return Qty</TableHead>
                          <TableHead className="text-right">Refund</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {foundSale.items.map((item: any) => {
                          const isSelected = !!selectedReturnItems[item.id];
                          const returnQty = selectedReturnItems[item.id] || 0;
                          
                          // Calculate already returned
                           let alreadyReturned = 0;
                           if (foundSale.returns) {
                              foundSale.returns.forEach((ret: any) => {
                                ret.return_items.forEach((ri: any) => {
                                  if (ri.sale_item_id === item.id) {
                                    alreadyReturned += ri.quantity;
                                  }
                                });
                              });
                           }
                           const maxReturnable = item.quantity - alreadyReturned;
                           const isFullyReturned = maxReturnable <= 0;

                          return (
                            <TableRow key={item.id} className={isFullyReturned ? 'opacity-50 bg-muted/20' : ''}>
                              <TableCell>
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={(checked) => handleReturnItemChange(item.id, checked as boolean)}
                                  disabled={isFullyReturned || returnExpired}
                                />
                              </TableCell>
                              <TableCell>
                                <div>{item.product_name}</div>
                                <div className="text-xs text-muted-foreground">{formatPKR(item.unit_price)} / unit</div>
                              </TableCell>
                              <TableCell className="text-right">
                                {item.quantity}
                                {alreadyReturned > 0 && <span className="text-xs text-red-500 block">(-{alreadyReturned} returned)</span>}
                              </TableCell>
                              <TableCell className="text-right">
                                {isSelected ? (
                                  <Input
                                    type="number"
                                    min="1"
                                    max={maxReturnable}
                                    value={returnQty}
                                    onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 0)}
                                    className="w-20 h-8 ml-auto text-right"
                                  />
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {isSelected ? formatPKR(item.unit_price * returnQty) : '-'}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Total Refund Display */}
                <div className="flex justify-end items-center py-4 border-t">
                  <span className="text-lg font-semibold mr-4">Total Refund Amount:</span>
                  <span className="text-2xl font-bold text-primary">{formatPKR(totalRefundAmount)}</span>
                </div>

                <div className="space-y-2">
                  <Label>Reason for Return</Label>
                  <Textarea
                    placeholder="Why is this being returned?"
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                  />
                </div>

                <div className="flex justify-end pt-4">
                  <Button onClick={handleSubmitReturn} disabled={isProcessingReturn || returnExpired} variant="destructive">
                    {isProcessingReturn ? (
                       <>Processing...</>
                    ) : (
                       <>
                         <RotateCcw className="w-4 h-4 mr-2" />
                         Confirm Return
                       </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </TabsContent>
      </Tabs>
      </div>
    </MainLayout>
  );
}
