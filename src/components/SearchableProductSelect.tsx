import React, { useState, useMemo } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';
import { Product } from '../types';
import { formatPkr } from '../utils/formatters';

export interface SearchableProductSelectProps {
  products: Product[];
  selectedProductId?: string;
  onSelectProduct: (id: string, product?: Product) => void;
  compact?: boolean;
  label?: string;
  disabled?: boolean;
  className?: string;
  idPrefix?: string;
}

export const SearchableProductSelect: React.FC<SearchableProductSelectProps> = ({
  products = [],
  selectedProductId,
  onSelectProduct,
  compact = false,
  label,
  disabled = false,
  className = '',
  idPrefix,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId),
    [products, selectedProductId]
  );

  const filteredProducts = useMemo(() => {
    if (!query.trim()) return products.slice(0, 30);
    const q = query.toLowerCase();
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          p.category.toLowerCase().includes(q)
      )
      .slice(0, 30);
  }, [products, query]);

  return (
    <div className={`relative ${className}`}>
      {label && <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between text-left border rounded-xl transition-all ${
          compact ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2.5 text-sm'
        } ${
          isOpen
            ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-slate-900'
            : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer text-slate-200'}`}
      >
        <span className="truncate">
          {selectedProduct ? (
            <span className="font-medium text-slate-200">{selectedProduct.name}</span>
          ) : (
            <span className="text-slate-500">Select product...</span>
          )}
        </span>
        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
      </button>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-72 flex flex-col">
          <div className="p-2 border-b border-slate-800 flex items-center gap-2 bg-slate-950/60">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="text"
              autoFocus
              placeholder="Search by product name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-transparent text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
            />
          </div>
          <div className="overflow-y-auto flex-1 divide-y divide-slate-800/40">
            {filteredProducts.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-500">No products found</div>
            ) : (
              filteredProducts.map((p) => {
                const isSelected = p.id === selectedProductId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onSelectProduct(p.id, p);
                      setIsOpen(false);
                      setQuery('');
                    }}
                    className={`w-full text-left px-3 py-2.5 flex items-center justify-between transition-colors text-xs ${
                      isSelected
                        ? 'bg-indigo-600/15 text-indigo-400 font-medium'
                        : 'text-slate-300 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="truncate mr-2">
                      <div className="truncate text-slate-200 font-medium">{p.name}</div>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
