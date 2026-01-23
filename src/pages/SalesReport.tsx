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
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { Banknote, Receipt, TrendingUp, Calendar, Package, Download } from 'lucide-react';
import { StatCard } from '@/components/dashboard/StatCard';
import { toast } from 'sonner';

export default function SalesReport() {
  const { sales, loading } = useSales();
  const { batches } = useProducts();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

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
    const totalRevenue = filteredSales.reduce((sum, sale) => sum + (sale?.total || 0), 0);
    const totalTransactions = filteredSales.length;
    const avgTransaction = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
    const totalItems = filteredSales.reduce((sum, sale) =>
      sum + (sale?.items?.reduce((itemSum: number, item: any) => itemSum + (item?.quantity || 0), 0) || 0), 0
    );
    const totalProfit = filteredSales.reduce((sum, sale) => sum + calculateSaleProfit(sale), 0);

    return { totalRevenue, totalTransactions, avgTransaction, totalItems, totalProfit };
  }, [filteredSales, batches]);

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
      </div>
    </MainLayout>
  );
}
