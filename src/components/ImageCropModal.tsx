import React, { useState } from 'react';
import { X, Check, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';

export type AspectRatioType = '1:1' | '16:9' | '4:3' | 'free';

export interface ImageCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  title?: string;
  defaultAspectRatio?: AspectRatioType;
  onCropComplete: (croppedDataUrl: string) => void;
}

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  title = 'Adjust Image',
  onCropComplete,
}) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  if (!isOpen) return null;

  const handleApply = () => {
    // If no complex canvas transformation needed, pass through the image or apply to canvas
    const canvas = document.createElement('canvas');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.scale(zoom, zoom);
        ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
        ctx.restore();
        try {
          const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
          onCropComplete(dataUrl);
        } catch {
          onCropComplete(imageUrl);
        }
      } else {
        onCropComplete(imageUrl);
      }
    };
    img.onerror = () => onCropComplete(imageUrl);
    img.src = imageUrl;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-semibold text-slate-100">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 flex flex-col items-center justify-center bg-slate-950/50 min-h-[260px] overflow-hidden">
          <img
            src={imageUrl}
            alt="Preview"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
              transition: 'transform 0.15s ease',
              maxHeight: '260px',
              maxWidth: '100%',
              objectFit: 'contain',
            }}
          />
        </div>
        <div className="p-4 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              title="Rotate"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200">
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl text-sm flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" /> Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
