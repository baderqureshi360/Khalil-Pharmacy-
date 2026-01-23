import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useRacks, Rack } from '@/hooks/useRacks';
import { useProducts } from '@/hooks/useProducts';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Edit2, Trash2, LayoutGrid, Loader2, Package } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
];

export default function Racks() {
  const { racks, loading, addRack, updateRack, deleteRack } = useRacks();
  const { products } = useProducts();
  const { isOwner } = useAuth();
  const navigate = useNavigate();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingRack, setEditingRack] = useState<Rack | null>(null);
  const [selectedRackId, setSelectedRackId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [description, setDescription] = useState('');

  const selectedRack = racks.find(r => r.id === selectedRackId);
  // Filter products by selected rack - ensures immediate UI update
  const rackProducts = selectedRackId 
    ? products.filter(p => p && p.rack_id === selectedRackId)
    : [];

  const handleAdd = async () => {
    if (!name.trim()) {
      toast.error('Rack name is required');
      return;
    }
    const result = await addRack(name.trim(), color, description.trim() || undefined);
    if (result) {
      setIsAddOpen(false);
      resetForm();
    }
  };

  const handleUpdate = async () => {
    if (!editingRack || !name.trim()) {
      toast.error('Rack name is required');
      return;
    }
    const result = await updateRack(editingRack.id, {
      name: name.trim(),
      color,
      description: description.trim() || null,
    });
    if (result) {
      setEditingRack(null);
      resetForm();
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this rack?')) {
      await deleteRack(id);
    }
  };

  const resetForm = () => {
    setName('');
    setColor(COLORS[0]);
    setDescription('');
  };

  const openEdit = (rack: Rack) => {
    if (!rack || !rack.id) {
      toast.error('Invalid rack data');
      return;
    }
    setEditingRack(rack);
    setName(rack.name || '');
    setColor(rack.color || COLORS[0]);
    setDescription(rack.description || '');
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="page-title text-2xl sm:text-3xl flex items-center gap-2 sm:gap-3">
              <LayoutGrid className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
              Rack Management
            </h1>
            <p className="page-subtitle text-sm sm:text-base">Organize products by physical location</p>
          </div>
          {isOwner && (
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm} className="w-full sm:w-auto">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Rack
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] sm:w-auto max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Rack</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Rack Name</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., A, B, C or Shelf 1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Color</Label>
                  <div className="flex flex-wrap gap-2">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          color === c ? 'border-foreground scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c }}
                        onClick={() => setColor(c)}
                      />
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description (Optional)</Label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g., Pain Relief Section"
                  />
                </div>
                <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)} className="w-full sm:w-auto">
                    Cancel
                  </Button>
                  <Button onClick={handleAdd} className="w-full sm:w-auto">
                    Add Rack
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
        </div>

        {/* Grid View */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {racks.map((rack) => {
          const rackProductCount = products.filter(p => p.rack_id === rack.id).length;
          return (
            <Card 
              key={rack.id} 
              className="relative overflow-hidden group cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setSelectedRackId(rack.id)}
            >
              <div
                className="absolute inset-0 opacity-10"
                style={{ backgroundColor: rack.color }}
              />
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                    style={{ backgroundColor: rack.color }}
                  >
                    {rack.name}
                  </div>
                  {isOwner && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => openEdit(rack)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleDelete(rack.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground truncate mb-2">
                  {rack.description || 'No description'}
                </p>
                <Badge variant="secondary" className="text-xs">
                  {rackProductCount} product{rackProductCount !== 1 ? 's' : ''}
                </Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>

        {/* Table View */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">All Racks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="table-header">Color</TableHead>
                  <TableHead className="table-header">Name</TableHead>
                  <TableHead className="table-header">Description</TableHead>
                  <TableHead className="table-header">Created</TableHead>
                  {isOwner && <TableHead className="table-header">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {racks.map((rack) => (
                  <TableRow key={rack.id}>
                    <TableCell>
                      <div
                        className="w-8 h-8 rounded-lg"
                        style={{ backgroundColor: rack.color }}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{rack.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {rack.description || '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(rack.created_at).toLocaleDateString()}
                    </TableCell>
                    {isOwner && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEdit(rack)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => handleDelete(rack.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

        {/* Products in Rack Dialog */}
        <Dialog open={!!selectedRackId} onOpenChange={(open) => !open && setSelectedRackId(null)}>
          <DialogContent className="max-w-4xl w-[95vw] sm:w-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div 
                className="w-6 h-6 rounded-lg flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: selectedRack?.color }}
              >
                {selectedRack?.name}
              </div>
              Products in {selectedRack?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-auto max-h-[60vh]">
            {rackProducts.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">No products assigned to this rack</p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => {
                    setSelectedRackId(null);
                    navigate('/products');
                  }}
                >
                  Add Products
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Barcode</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rackProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Package className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{product.name}</p>
                            {product.strength && (
                              <p className="text-xs text-muted-foreground">{product.strength}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{product.barcode || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{product.category || 'Uncategorized'}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedRackId(null);
                            navigate('/products');
                          }}
                        >
                          <Edit2 className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

        {/* Edit Dialog */}
        <Dialog open={!!editingRack} onOpenChange={() => setEditingRack(null)}>
          <DialogContent className="w-[95vw] sm:w-auto max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Rack</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Rack Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., A, B, C"
                  className="h-10 sm:h-9"
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        color === c ? 'border-foreground scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                      onClick={() => setColor(c)}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., Pain Relief Section"
                  className="h-10 sm:h-9"
                />
              </div>
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setEditingRack(null)} className="w-full sm:w-auto">
                  Cancel
                </Button>
                <Button onClick={handleUpdate} className="w-full sm:w-auto">
                  Save Changes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
