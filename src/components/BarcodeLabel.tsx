import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { Printer, X } from 'lucide-react';
import { Product } from '../types';
import { formatPkr } from '../utils/formatters';

export interface BarcodeLabelProps {
  product: Product | null;
  showPrice?: boolean;
  showSerial?: boolean;
  showWarranty?: boolean;
  showQr?: boolean;
  onClose?: () => void;
}

export const BarcodeLabel: React.FC<BarcodeLabelProps> = ({
  product,
  showPrice = true,
  showSerial = true,
  showWarranty = true,
  showQr = true,
  onClose,
}) => {
  const barcodeRef = useRef<SVGSVGElement | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!product) return;

    if (barcodeRef.current) {
      try {
        const code = product.sku || product.id || 'APX-ITEM';
        JsBarcode(barcodeRef.current, code, {
          format: 'CODE128',
          width: 1.5,
          height: 40,
          displayValue: false,
          margin: 0,
        });
      } catch (e) {
        console.error('Barcode error:', e);
      }
    }

    if (qrCanvasRef.current && showQr) {
      try {
        const qrData = `https://apexrig.pk/product/${product.id}`;
        QRCode.toCanvas(qrCanvasRef.current, qrData, {
          width: 60,
          margin: 0,
        });
      } catch (e) {
        console.error('QR code error:', e);
      }
    }
  }, [product, showQr]);

  if (!product) return null;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="bg-white text-black p-4 rounded-xl shadow-lg border border-slate-200 w-80 text-left font-sans">
        <div className="flex justify-between items-start border-b border-gray-200 pb-2 mb-2">
          <div>
            <div className="text-[10px] font-bold tracking-wider uppercase text-gray-500">ApexRig Store</div>
            <div className="text-xs font-bold truncate max-w-[180px] text-gray-900">{product.name}</div>
          </div>
          {showQr && <canvas ref={qrCanvasRef} className="shrink-0" />}
        </div>

        <div className="flex flex-col items-center justify-center my-2">
          <svg ref={barcodeRef} className="w-full max-w-[220px]" />
          <div className="text-[10px] font-mono tracking-widest text-gray-700 mt-1">
            {product.sku || product.id}
          </div>
        </div>

        <div className="flex justify-between items-center text-xs border-t border-gray-200 pt-2 mt-2">
          {showPrice && (
            <span className="font-extrabold text-sm text-gray-900">{formatPkr(product.pricePkr)}</span>
          )}
          {showWarranty && (
            <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 font-medium">
              Official Warranty
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
        >
          <Printer className="w-4 h-4" /> Print Label
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
};
