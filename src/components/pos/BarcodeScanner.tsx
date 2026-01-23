import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { ScanLine } from 'lucide-react';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
}

export function BarcodeScanner({ onScan }: BarcodeScannerProps) {
  const [barcode, setBarcode] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus the input on mount
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && barcode.trim()) {
      onScan(barcode.trim());
      setBarcode('');
    }
  };

  return (
    <div className="relative">
      <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={barcode}
        onChange={(e) => setBarcode(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Scan barcode or enter manually..."
        className="pl-10 h-12 text-lg"
      />
    </div>
  );
}
