import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeDisplayProps {
  value: string;
  width?: number;
  height?: number;
  displayValue?: boolean;
  className?: string;
}

export function BarcodeDisplay({
  value,
  width = 2,
  height = 60,
  displayValue = true,
  className = '',
}: BarcodeDisplayProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
          format: 'EAN13',
          width,
          height,
          displayValue,
          fontSize: 14,
          margin: 10,
          background: 'transparent',
        });
      } catch (error) {
        // Fallback to CODE128 if EAN-13 fails
        try {
          JsBarcode(svgRef.current, value, {
            format: 'CODE128',
            width,
            height,
            displayValue,
            fontSize: 14,
            margin: 10,
            background: 'transparent',
          });
        } catch (e) {
          console.error('Barcode generation failed:', e);
        }
      }
    }
  }, [value, width, height, displayValue]);

  if (!value) {
    return (
      <div className={`text-muted-foreground text-sm ${className}`}>
        No barcode assigned
      </div>
    );
  }

  return <svg ref={svgRef} className={className} />;
}
