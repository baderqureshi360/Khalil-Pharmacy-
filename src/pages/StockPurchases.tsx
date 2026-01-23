import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatPKR } from '@/lib/currency';
import { Badge } from '@/components/ui/badge';
import { Search } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useProducts } from '@/hooks/useProducts';
import { useSales } from '@/hooks/useSales';
import { Plus, PackagePlus, Package, Layers } from 'lucide-react';
import { format, parseISO, isBefore, addDays, startOfToday } from 'date-fns';
import { toast } from 'sonner';

export default function StockPurchases() {
  const { products, batches, getProductStock, addBatch } = useProducts();
  const { sales } = useSales();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState({
    productId: '',
    batchNumber: '',
    quantity: '',
    costPrice: '',
    sellingPrice: '',
    expiryDate: '',
    supplier: '',
  });

  const today = startOfToday();
  const selectedProduct = products.find((p) => p.id === formData.productId);

  // Filter products by search term (name, barcode, and salt_formula)
  // Note: Stock Purchases shows all products (including disabled) for inventory management
  // but we filter them from search results for consistency
  const filteredProducts = products.filter((product) => {
    if (!product || !product.id) return false;
    
    if (search && search.trim() !== '') {
      const searchLower = search.toLowerCase().trim();
      const matchesName = product.name?.toLowerCase().includes(searchLower) || false;
      const matchesBarcode = product.barcode?.toLowerCase().includes(searchLower) || false;
      const matchesSaltFormula = product.salt_formula?.toLowerCase().includes(searchLower) || false;
      
      if (!matchesName && !matchesBarcode && !matchesSaltFormula) {
        return false;
      }
    }
    
    return true;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedProduct) {
      toast.error('Please select a product');
      return;
    }

    if (!formData.batchNumber.trim()) {
      toast.error('Batch number is required');
      return;
    }

    if (!formData.expiryDate) {
      toast.error('Expiry date is required');
      return;
    }

    const expiryDate = parseISO(formData.expiryDate);
    if (isBefore(expiryDate, today)) {
      toast.error('Cannot add expired stock');
      return;
    }

    const quantity = parseInt(formData.quantity);
    const costPrice = parseFloat(formData.costPrice);
    const sellingPrice = parseFloat(formData.sellingPrice);

    if (isNaN(quantity) || quantity <= 0) {
      toast.error('Quantity must be a positive number');
      return;
    }

    if (isNaN(costPrice) || costPrice <= 0) {
      toast.error('Cost price must be a positive number');
      return;
    }

    if (isNaN(sellingPrice) || sellingPrice <= 0) {
      toast.error('Selling price must be a positive number');
      return;
    }

    const result = await addBatch({
      product_id: formData.productId,
      batch_number: formData.batchNumber.trim(),
      quantity,
      cost_price: costPrice,
      selling_price: sellingPrice,
      expiry_date: formData.expiryDate,
      purchase_date: new Date().toISOString().split('T')[0],
      supplier: formData.supplier || null,
    });

    if (result) {
      toast.success('Stock purchase recorded', {
        description: `Added ${quantity} units of ${selectedProduct.name} (Batch: ${formData.batchNumber})`,
      });

      setFormData({ productId: '', batchNumber: '', quantity: '', costPrice: '', sellingPrice: '', expiryDate: '', supplier: '' });
      setIsFormOpen(false);
    }
  };

  // Sort batches by purchase date (most recent first)
  const sortedBatches = [...batches].sort(
    (a, b) => new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime()
  );

  const getExpiryBadge = (expiryDate: string) => {
    const expiry = parseISO(expiryDate);
    const isExpired = isBefore(expiry, today);
    const isExpiringSoon = isBefore(expiry, addDays(today, 30));

    if (isExpired) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    if (isExpiringSoon) {
      return <Badge className="bg-warning text-warning-foreground">{format(expiry, 'MMM d, yyyy')}</Badge>;
    }
    return <span className="text-muted-foreground">{format(expiry, 'MMM d, yyyy')}</span>;
  };

  return (
    <MainLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
          <div className="page-header mb-0">
            <h1 className="page-title text-2xl sm:text-3xl">Stock Purchases</h1>
            <p className="page-subtitle text-sm sm:text-base">Record batch-wise inventory purchases with expiry tracking</p>
          </div>
          <Button onClick={() => setIsFormOpen(true)} className="shadow-sm w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-2" />
            Add Purchase
          </Button>
        </div>

        {/* Batch Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 sm:mb-6">
          <div className="bg-card rounded-2xl border border-border/60 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Layers className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{batches.length}</p>
                <p className="text-sm text-muted-foreground">Total Batches</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-2xl border border-border/60 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-warning/15 flex items-center justify-center">
                <Package className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {batches.filter(b => {
                    const expiry = parseISO(b.expiry_date);
                    return b.quantity > 0 && !isBefore(expiry, today) && isBefore(expiry, addDays(today, 30));
                  }).length}
                </p>
                <p className="text-sm text-muted-foreground">Expiring in 30 days</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-2xl border border-border/60 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/15 flex items-center justify-center">
                <Package className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {batches.filter(b => b.quantity > 0 && isBefore(parseISO(b.expiry_date), today)).length}
                </p>
                <p className="text-sm text-muted-foreground">Expired Batches</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
            <TableHeader>
              <TableRow className="table-header">
                <TableHead>Product</TableHead>
                <TableHead>Batch No.</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedBatches.map((batch) => {
                const product = products.find(p => p.id === batch.product_id);
                return (
                  <TableRow key={batch.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Package className="w-5 h-5 text-primary" />
                        </div>
                        <span className="font-medium">{product?.name || 'Unknown Product'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">{batch.batch_number}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{batch.supplier || 'N/A'}</TableCell>
                    <TableCell className="text-right font-medium">{batch.quantity}</TableCell>
                    <TableCell className="text-right">{formatPKR(batch.cost_price)}</TableCell>
                    <TableCell className="text-right font-semibold text-primary">{formatPKR(batch.quantity * batch.cost_price)}</TableCell>
                    <TableCell>{getExpiryBadge(batch.expiry_date)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(batch.purchase_date), 'MMM d, yyyy')}
                    </TableCell>
                  </TableRow>
                );
              })}
              {sortedBatches.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                      <PackagePlus className="w-8 h-8 text-muted-foreground/50" />
                    </div>
                    <p className="text-muted-foreground font-medium">No stock purchases recorded yet</p>
                    <p className="text-sm text-muted-foreground mt-1">Click "Add Purchase" to record your first purchase</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>
        </div>

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="max-w-lg w-[95vw] sm:w-auto max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Record Stock Purchase</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="product">Product</Label>
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, barcode, or salt/formula..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-10 h-10 sm:h-9"
                    />
                  </div>
                  <Select
                    value={formData.productId}
                    onValueChange={(value) => {
                      const product = products.find((p) => p.id === value);
                      // Get latest batch price if available, otherwise leave empty
                      const latestBatch = batches
                        .filter(b => b.product_id === value)
                        .sort((a, b) => new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime())[0];
                      setFormData({
                        ...formData,
                        productId: value,
                        costPrice: latestBatch?.cost_price.toString() || '',
                        sellingPrice: latestBatch?.selling_price.toString() || '',
                        supplier: latestBatch?.supplier || '',
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a product" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredProducts.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} {product.strength && `(${product.strength})`} — Stock: {getProductStock(product.id)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="batchNumber">Batch Number *</Label>
                  <Input
                    id="batchNumber"
                    value={formData.batchNumber}
                    onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
                    placeholder="e.g., PCM-2024-001"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiryDate">Expiry Date *</Label>
                  <Input
                    id="expiryDate"
                    type="date"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="costPrice">Cost (Rs.)</Label>
                  <Input
                    id="costPrice"
                    type="number"
                    step="0.01"
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sellingPrice">Sell (Rs.)</Label>
                  <Input
                    id="sellingPrice"
                    type="number"
                    step="0.01"
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="supplier">Supplier</Label>
                <Input
                  id="supplier"
                  value={formData.supplier}
                  onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                  placeholder="Leave empty to use default supplier"
                />
              </div>

              {formData.quantity && formData.costPrice && (
                <div className="p-4 bg-primary/5 rounded-xl border border-primary/20">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-medium">Total Cost</span>
                    <span className="text-xl font-bold text-primary">
                      {formatPKR(parseInt(formData.quantity) * parseFloat(formData.costPrice))}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)} className="w-full sm:w-auto">
                  Cancel
                </Button>
                <Button type="submit" className="w-full sm:w-auto">Record Purchase</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
