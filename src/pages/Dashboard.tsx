import { useState, useMemo } from 'react';
import { TrendingUp, Package, AlertTriangle, Clock, Banknote, Layers, X } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { useProducts } from '@/hooks/useProducts';
import { useSales } from '@/hooks/useSales';
import { formatPKR } from '@/lib/currency';
import { format, parseISO, startOfToday } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export default function Dashboard() {
  const { products, getProductStock, getExpiringBatches, getExpiredBatches } = useProducts();
  const { sales } = useSales();
  const today = startOfToday();
  const [dismissedExpiredAlert, setDismissedExpiredAlert] = useState(false);

  const expiringBatches = getExpiringBatches(30);
  const expiredBatches = getExpiredBatches();

  const stats = useMemo(() => {
    const safeSales = Array.isArray(sales) ? sales : [];
    const safeProducts = Array.isArray(products) ? products.filter(p => p.is_active !== false) : [];
    const safeExpiringBatches = Array.isArray(expiringBatches) ? expiringBatches : [];
    const safeExpiredBatches = Array.isArray(expiredBatches) ? expiredBatches : [];

    const todaySales = safeSales
      .filter((sale) => sale && sale.created_at && format(new Date(sale.created_at), 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd'))
      .reduce((sum, sale) => sum + (sale?.total || 0), 0);

    const lowStockProducts = safeProducts.filter((p) => {
      if (!p || !p.id) return false;
      const stock = getProductStock(p.id);
      return stock <= (p.min_stock || 0) && stock > 0;
    });

    const outOfStockProducts = safeProducts.filter((p) => {
      if (!p || !p.id) return false;
      return getProductStock(p.id) <= 0;
    });

    return {
      todaySales,
      totalProducts: safeProducts.length,
      lowStockCount: lowStockProducts.length,
      outOfStockCount: outOfStockProducts.length,
      expiringCount: safeExpiringBatches.length,
      expiredCount: safeExpiredBatches.length,
      lowStockProducts,
      outOfStockProducts,
    };
  }, [products, sales, today, getProductStock, expiringBatches, expiredBatches]);

  const recentSales = useMemo(() => {
    const safeSales = Array.isArray(sales) ? sales : [];
    return [...safeSales]
      .filter((sale) => sale && sale.created_at)
      .sort((a, b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeB - timeA;
      })
      .slice(0, 5);
  }, [sales]);

  return (
    <MainLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="page-header mb-6 sm:mb-8">
          <h1 className="page-title text-2xl sm:text-3xl">Dashboard</h1>
          <p className="page-subtitle text-sm sm:text-base">
            Welcome back! Here's your pharmacy overview for {format(today, 'MMMM d, yyyy')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <StatCard
            title="Today's Sales"
            value={formatPKR(stats.todaySales)}
            icon={<Banknote className="w-6 h-6" />}
            variant="success"
          />
          <StatCard
            title="Total Products"
            value={stats.totalProducts}
            icon={<Package className="w-6 h-6" />}
          />
          <StatCard
            title="Low Stock Items"
            value={stats.lowStockCount}
            icon={<AlertTriangle className="w-6 h-6" />}
            variant={stats.lowStockCount > 0 ? 'warning' : 'default'}
          />
          <StatCard
            title="Expiring Batches (30d)"
            value={stats.expiringCount}
            icon={<Clock className="w-6 h-6" />}
            variant={stats.expiringCount > 0 ? 'danger' : 'default'}
          />
        </div>

        {/* Expired Batches Alert */}
        {stats.expiredCount > 0 && !dismissedExpiredAlert && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-destructive/10 border border-destructive/30 rounded-2xl relative">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/20 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-destructive text-sm sm:text-base">Expired Stock Alert</h3>
                <p className="text-xs sm:text-sm text-destructive/80">
                  {stats.expiredCount} batch(es) have expired and cannot be sold. Consider disposing of expired stock.
                </p>
              </div>
            </div>
            <button
              onClick={() => setDismissedExpiredAlert(true)}
              className="absolute right-2 top-2 rounded-md p-1 text-destructive/70 hover:text-destructive hover:bg-destructive/20 transition-colors focus:outline-none focus:ring-2 focus:ring-destructive/50"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Low Stock Alert */}
          <div className="bg-card rounded-2xl border border-border/60 p-4 sm:p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4 sm:mb-5">
              <div className="w-10 h-10 rounded-xl bg-warning/15 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-warning" />
              </div>
              <h2 className="text-base sm:text-lg font-semibold text-foreground">Low Stock Alert</h2>
            </div>
            {stats.lowStockProducts.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Min Stock</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.lowStockProducts.slice(0, 5).map((product) => {
                    if (!product || !product.id) return null;
                    return (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">
                          {product.name || 'Unknown Product'} {product.strength && <span className="text-primary text-xs">{product.strength}</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="destructive">{getProductStock(product.id)}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {product.min_stock ?? 0}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                  <Package className="w-6 h-6 text-muted-foreground/50" />
                </div>
                <p className="text-muted-foreground text-sm sm:text-base">All products are well stocked!</p>
              </div>
            )}
          </div>

          {/* Expiring Soon */}
          <div className="bg-card rounded-2xl border border-border/60 p-4 sm:p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4 sm:mb-5">
              <div className="w-10 h-10 rounded-xl bg-destructive/15 flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-destructive" />
              </div>
              <h2 className="text-base sm:text-lg font-semibold text-foreground">Expiring Soon (30 days)</h2>
            </div>
            {expiringBatches.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product / Batch</TableHead>
                    <TableHead className="text-right">Expiry</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expiringBatches.slice(0, 5).map((batch) => {
                    if (!batch || !batch.id) return null;
                    const product = products.find(p => p && p.id === batch.product_id);
                    return (
                      <TableRow key={batch.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{product?.name || 'Unknown Product'}</p>
                            <p className="text-xs text-muted-foreground font-mono">{batch.batch_number || 'N/A'}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge className="bg-warning text-warning-foreground">
                            {batch.expiry_date ? format(parseISO(batch.expiry_date), 'MMM d, yyyy') : 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {batch.quantity ?? 0}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                  <Layers className="w-6 h-6 text-muted-foreground/50" />
                </div>
                <p className="text-muted-foreground text-sm sm:text-base">No batches expiring soon!</p>
              </div>
            )}
          </div>

          {/* Recent Sales */}
          <div className="bg-card rounded-2xl border border-border/60 p-4 sm:p-6 shadow-sm lg:col-span-2">
            <div className="flex items-center gap-3 mb-4 sm:mb-5">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-base sm:text-lg font-semibold text-foreground">Recent Sales</h2>
            </div>
            {recentSales.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sale ID</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentSales.map((sale) => {
                    if (!sale || !sale.id) return null;
                    return (
                      <TableRow key={sale.id}>
                        <TableCell className="font-mono text-sm">#{sale.id}</TableCell>
                        <TableCell>{Array.isArray(sale.items) ? sale.items.length : 0} items</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {sale.payment_method || 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {sale.created_at ? format(new Date(sale.created_at), 'MMM d, h:mm a') : 'N/A'}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-primary">
                          {formatPKR(sale.total || 0)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                  <TrendingUp className="w-6 h-6 text-muted-foreground/50" />
                </div>
                <p className="text-muted-foreground text-sm sm:text-base">No sales yet. Start selling to see data here!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
