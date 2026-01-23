import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Product, useProducts } from '@/hooks/useProducts';
import { useRacks } from '@/hooks/useRacks';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ProductFormProps {
  product?: Product;
  onSubmit: (data: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'rack'>) => void;
  onCancel: () => void;
}

// Organized categories for pharmacy products
// Grouped logically for easy navigation and filtering
const categories = [
  // Pain & Fever Management
  'Pain Relief',
  'Fever',
  
  // Respiratory & Cold
  'Cold, Flu & Cough',
  'Respiratory / Asthma',
  
  // Infections & Antibiotics
  'Antibiotics',
  'Antifungal',
  'Antibiotic Creams & Ointments',
  
  // Digestive Health
  'Digestive & Stomach',
  'Acidity & Gas',
  'Diarrhea & Constipation',
  
  // Chronic Conditions
  'Diabetes',
  'Blood Pressure & Heart',
  
  // Allergy & Immune
  'Allergy',
  
  // Supplements & Wellness
  'Vitamins & Supplements',
  
  // Topical & External Care
  'Skin Care',
  'Eye & Ear Care',
  
  // Special Populations
  'Children / Pediatric',
  "Women's Health",
  
  // General & Emergency
  'First Aid',
  'OTC (General Medicines)',
  
  // Additional Categories
  'Insecticide',
  'Depression and Anxiety Disorders',
  'Liver Diseases',
  'Mouth Ulcer',
  'Nasal Drops',
  'Anti Scabies',
  'Anxiolytic/Anti Depresent',
  'Anxilytic/ Antidepressant',
  'Other',
];

const dosageForms = [
  'Tablet',
  'Capsule',
  'Syrup',
  'Injection',
  'Cream',
  'Ointment',
  'Drops',
  'Inhaler',
  'Suspension',
  'Solution',
  'Powder',
  'Granules',
  'Gel',
  'Lotion',
  'Spray',
  'Patch',
  'Suppository',
  'Eye Drops',
  'Ear Drops',
  'Nasal Drops',
  'Sachet',
  'Other',
];

export function ProductForm({ product, onSubmit, onCancel }: ProductFormProps) {
  const { generateBarcode } = useProducts();
  const { racks } = useRacks();
  const [isGeneratingBarcode, setIsGeneratingBarcode] = useState(false);
  
  // Initialize rack_id - prefer rack_id, fallback to rack.id if rack object exists
  const initialRackId = product?.rack_id || (product?.rack?.id && product.rack.id.trim() !== '' ? product.rack.id : '');
  
  // Handle scanned barcode from Products page
  const initialBarcode = product?.barcode || '';
  
  const [formData, setFormData] = useState({
    name: product?.name || '',
    strength: product?.strength || '',
    dosage_form: product?.dosage_form || '',
    barcode: initialBarcode,
    category: product?.category || '',
    min_stock: product?.min_stock?.toString() || '10',
    manufacturer: product?.manufacturer || '',
    salt_formula: product?.salt_formula || '',
    rack_id: initialRackId,
  });

  // Update form when product changes (for editing or scanned barcode)
  useEffect(() => {
    if (product) {
      const newRackId = product.rack_id || (product.rack?.id && product.rack.id.trim() !== '' ? product.rack.id : '');
      setFormData({
        name: product.name || '',
        strength: product.strength || '',
        dosage_form: product.dosage_form || '',
        barcode: product.barcode || '',
        category: product.category || '',
        min_stock: product.min_stock?.toString() || '10',
        manufacturer: product.manufacturer || '',
        salt_formula: product.salt_formula || '',
        rack_id: newRackId,
      });
    } else {
      // Reset form for new product
      setFormData({
        name: '',
        strength: '',
        dosage_form: '',
        barcode: '',
        category: '',
        min_stock: '10',
        manufacturer: '',
        salt_formula: '',
        rack_id: '',
      });
    }
  }, [product]);

  const handleGenerateBarcode = async () => {
    setIsGeneratingBarcode(true);
    const barcode = await generateBarcode();
    if (barcode) {
      setFormData({ ...formData, barcode });
    }
    setIsGeneratingBarcode(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate name (required)
    if (!formData.name || formData.name.trim() === '') {
      toast.error('Product name is required');
      return;
    }

    // Validate rack selection (required)
    if (!formData.rack_id || formData.rack_id.trim() === '') {
      toast.error('Please select a rack for this product');
      return;
    }

    // Validate rack exists
    const selectedRack = racks.find(r => r.id === formData.rack_id);
    if (!selectedRack) {
      toast.error('Selected rack is invalid. Please select a valid rack.');
      return;
    }

    // Validate min_stock is a valid number
    const minStock = parseInt(formData.min_stock);
    if (isNaN(minStock) || minStock < 0) {
      toast.error('Minimum stock must be a valid number (0 or greater)');
      return;
    }
    
    // Auto-generate barcode if none provided
    let finalBarcode = formData.barcode.trim();
    if (!finalBarcode && !product) {
      setIsGeneratingBarcode(true);
      const generatedBarcode = await generateBarcode();
      setIsGeneratingBarcode(false);
      if (generatedBarcode) {
        finalBarcode = generatedBarcode;
      } else {
        // Fallback: generate a unique code if RPC fails using timestamp + random
        // This ensures uniqueness even if called simultaneously
        finalBarcode = `HH-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      }
    }
    
    if (!finalBarcode) {
      // If editing and no barcode, keep existing or generate
      if (product?.barcode) {
        finalBarcode = product.barcode;
      } else {
        setIsGeneratingBarcode(true);
        const generatedBarcode = await generateBarcode();
        setIsGeneratingBarcode(false);
        if (generatedBarcode) {
          finalBarcode = generatedBarcode;
        } else {
          // Fallback: generate a unique code if RPC fails
          finalBarcode = `HH-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        }
      }
    }
    
    onSubmit({
      name: formData.name.trim(),
      strength: formData.strength?.trim() || null,
      dosage_form: formData.dosage_form || null,
      barcode: finalBarcode,
      category: formData.category || null,
      // Prices are managed at batch level
      min_stock: minStock,
      manufacturer: formData.manufacturer?.trim() || null,
      salt_formula: formData.salt_formula?.trim() || null,
      rack_id: formData.rack_id, // Required - always a valid rack.id
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto pr-0 sm:pr-2 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Medicine Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Paracetamol"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="strength">Strength</Label>
            <Input
              id="strength"
              value={formData.strength}
              onChange={(e) => setFormData({ ...formData, strength: e.target.value })}
              placeholder="e.g., 500mg, 100ml"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="dosageForm">Dosage Form</Label>
            <Select
              value={formData.dosage_form}
              onValueChange={(value) => setFormData({ ...formData, dosage_form: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select form" />
              </SelectTrigger>
              <SelectContent>
                {dosageForms.map((form) => (
                  <SelectItem key={form} value={form}>
                    {form}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="barcode">Barcode</Label>
            <div className="flex gap-2">
              <Input
                id="barcode"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                onKeyDown={(e) => {
                  // Support hardware scanner: scanners typically send Enter after barcode
                  // This allows both manual entry and scanner input
                  if (e.key === 'Enter' && formData.barcode.trim()) {
                    e.preventDefault();
                    // Barcode is ready - form will handle it on submit
                  }
                }}
                placeholder="Scan barcode or enter manually (leave empty to auto-generate)"
                disabled={!!product?.barcode}
                autoComplete="off"
                autoFocus={false}
              />
              {!product?.barcode && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGenerateBarcode}
                  disabled={isGeneratingBarcode}
                >
                  {isGeneratingBarcode ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Generate'
                  )}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {product?.barcode 
                ? 'Barcode cannot be changed after creation'
                : 'Scan with hardware scanner, type manually, or leave empty to auto-generate'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select
              value={formData.category || ''}
              onValueChange={(value) => setFormData({ ...formData, category: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rack_id">Rack / Section <span className="text-destructive">*</span></Label>
            {racks.length === 0 ? (
              <div className="p-3 bg-muted/50 rounded-lg border border-border">
                <p className="text-sm text-muted-foreground">
                  No racks available. Please create a rack first in the Racks page.
                </p>
              </div>
            ) : (
              <>
                <Select
                  value={formData.rack_id && formData.rack_id.trim() !== '' ? formData.rack_id : undefined}
                  onValueChange={(value) => {
                    if (value && value.trim() !== '') {
                      setFormData({ ...formData, rack_id: value });
                    }
                  }}
                  required
                >
                  <SelectTrigger className={!formData.rack_id ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Search or select rack" />
                  </SelectTrigger>
                  <SelectContent>
                    {racks
                      .filter(rack => rack && rack.id && rack.id.trim() !== '')
                      .map((rack) => (
                        <SelectItem key={rack.id} value={rack.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: rack.color || '#10b981' }}
                            />
                            {rack.name}
                            {rack.description && (
                              <span className="text-xs text-muted-foreground ml-1">({rack.description})</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {!formData.rack_id && (
                  <p className="text-xs text-destructive">Rack selection is required</p>
                )}
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="manufacturer">Manufacturer</Label>
            <Input
              id="manufacturer"
              value={formData.manufacturer}
              onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
              placeholder="e.g., PharmaCo"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="salt_formula">Salt / Formula</Label>
            <Input
              id="salt_formula"
              value={formData.salt_formula}
              onChange={(e) => setFormData({ ...formData, salt_formula: e.target.value })}
              placeholder="e.g., Paracetamol, Ibuprofen"
            />
            <p className="text-xs text-muted-foreground">Optional - Active ingredient or formula</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="min_stock">Minimum Stock Alert</Label>
            <Input
              id="min_stock"
              type="number"
              value={formData.min_stock}
              onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="p-4 bg-muted/50 rounded-xl border border-border">
          <p className="text-sm text-muted-foreground">
            <strong>Note:</strong> Product prices are managed at the batch level. 
            When you add stock purchases, you'll set the cost and selling prices for each batch.
          </p>
        </div>

        <div className="p-4 bg-muted/50 rounded-xl border border-border">
          <p className="text-sm text-muted-foreground">
            <strong>Note:</strong> Stock is managed through Stock Purchases with batch tracking. 
            Each purchase creates a new batch with its own expiry date.
          </p>
        </div>
      </div>

      <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t mt-4 flex-shrink-0">
        <Button type="button" variant="outline" onClick={onCancel} className="w-full sm:w-auto">
          Cancel
        </Button>
        <Button type="submit" className="w-full sm:w-auto">
          {product ? 'Update Product' : 'Add Product'}
        </Button>
      </div>
    </form>
  );
}
