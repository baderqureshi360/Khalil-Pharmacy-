import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Camera, X, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface CameraScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (barcode: string) => void;
}

export function CameraScanner({ open, onOpenChange, onScan }: CameraScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      Html5Qrcode.getCameras()
        .then((devices) => {
          if (devices && devices.length > 0) {
            setCameras(devices);
            // Prefer back camera
            const backCamera = devices.find(
              (d) => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear')
            );
            setSelectedCamera(backCamera?.id || devices[0].id);
          }
        })
        .catch((err) => {
          console.error('Error getting cameras:', err);
          toast.error('Could not access cameras');
        });
    }

    return () => {
      stopScanning();
    };
  }, [open]);

  const startScanning = async () => {
    if (!selectedCamera || !containerRef.current) return;

    try {
      scannerRef.current = new Html5Qrcode('camera-scanner-container');
      
      await scannerRef.current.start(
        selectedCamera,
        {
          fps: 10,
          qrbox: { width: 250, height: 100 },
          aspectRatio: 1.777778,
        },
        (decodedText) => {
          onScan(decodedText);
          stopScanning();
          onOpenChange(false);
          toast.success(`Scanned: ${decodedText}`);
        },
        () => {} // Ignore errors during scanning
      );
      
      setIsScanning(true);
    } catch (err) {
      console.error('Error starting scanner:', err);
      toast.error('Failed to start camera scanner');
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
    setIsScanning(false);
  };

  const handleClose = () => {
    stopScanning();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Camera Barcode Scanner
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {cameras.length > 1 && (
            <div className="flex gap-2">
              <select
                value={selectedCamera}
                onChange={(e) => {
                  stopScanning();
                  setSelectedCamera(e.target.value);
                }}
                className="flex-1 px-3 py-2 border rounded-lg bg-background"
              >
                {cameras.map((camera) => (
                  <option key={camera.id} value={camera.id}>
                    {camera.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div
            id="camera-scanner-container"
            ref={containerRef}
            className="w-full min-h-[300px] bg-muted rounded-lg overflow-hidden"
          />

          <div className="flex gap-2">
            {!isScanning ? (
              <Button onClick={startScanning} className="flex-1">
                <Camera className="w-4 h-4 mr-2" />
                Start Scanning
              </Button>
            ) : (
              <Button onClick={stopScanning} variant="outline" className="flex-1">
                <RefreshCw className="w-4 h-4 mr-2" />
                Stop
              </Button>
            )}
            <Button variant="outline" onClick={handleClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <p className="text-sm text-muted-foreground text-center">
            Point your camera at a barcode to scan
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
