import { Product } from '@/hooks/useProducts';

export const isNumeric = (str: string) => /^\d+$/.test(str);

export const matchesSearch = (product: Product, searchTerm: string): boolean => {
  if (!product) return false;
  if (!searchTerm || searchTerm.trim() === '') return true;

  const term = searchTerm.toLowerCase().trim();
  const numeric = isNumeric(term);

  if (numeric) {
    // If input is numeric → treat as barcode
    // Check for exact barcode match capability implies we should allow finding it via search
    return product.barcode?.toLowerCase().includes(term) || false;
  } else {
    // If input is text → treat as product name (and keep existing salt_formula search if applicable)
    const nameMatch = product.name?.toLowerCase().includes(term) || false;
    // Preserving existing salt_formula search as part of "text search" to avoid breaking functionality
    // unless strictly forbidden. The prompt says "treat as product name", but removing salt search might be a regression.
    // I will include salt_formula to be safe against "Must not break existing..." rule.
    const saltMatch = product.salt_formula?.toLowerCase().includes(term) || false;
    
    return nameMatch || saltMatch;
  }
};
