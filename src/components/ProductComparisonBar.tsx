import React from 'react';
import { Scale, X, ArrowRight } from 'lucide-react';
import { Product } from '../types';
import { formatPkr } from '../utils/formatters';

interface ProductComparisonBarProps {
  comparedProducts: Product[];
  onOpenComparisonModal: () => void;
  onRemoveProduct: (productId: string) => void;
  onClearAll: () => void;
}

export const ProductComparisonBar: React.FC<ProductComparisonBarProps> = ({
  comparedProducts,
  onOpenComparisonModal,
  onRemoveProduct,
  onClearAll,
}) => {
  if (!comparedProducts || comparedProducts.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-700/80 shadow-2xl py-3 px-4 transition-all">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Left: Title & Count */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <span className="font-semibold text-white text-sm">
              Component Comparison ({comparedProducts.length}/3)
            </span>
            <p className="text-xs text-slate-400 hidden sm:block">
              Side-by-side technical specs & benchmark comparison
            </p>
          </div>
        </div>

        {/* Center: Selected Products Preview */}
        <div className="flex items-center gap-3 overflow-x-auto py-1 max-w-full">
          {comparedProducts.map((prod) => (
            <div
              key={prod.id}
              className="flex items-center gap-2 bg-slate-800/90 border border-slate-700 rounded-lg p-1.5 pr-2.5 shrink-0 max-w-[200px]"
            >
              <img
                src={prod.image}
                alt={prod.name}
                className="w-8 h-8 rounded object-cover bg-slate-950 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-200 truncate">{prod.name}</p>
                <p className="text-[11px] text-emerald-400 font-bold">{formatPkr(prod.price)}</p>
              </div>
              <button
                onClick={() => onRemoveProduct(prod.id)}
                className="text-slate-400 hover:text-red-400 p-0.5 rounded transition-colors"
                title="Remove component"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {/* Empty slot placeholder */}
          {Array.from({ length: 3 - comparedProducts.length }).map((_, idx) => (
            <div
              key={`empty-${idx}`}
              className="hidden md:flex items-center justify-center w-36 h-10 border border-dashed border-slate-700 rounded-lg text-xs text-slate-500 shrink-0"
            >
              + Add component
            </div>
          ))}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onClearAll}
            className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Clear
          </button>
          <button
            onClick={onOpenComparisonModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-lg shadow-indigo-600/30 transition-all"
          >
            <span>Compare Now</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
