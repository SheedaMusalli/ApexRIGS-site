import React, { useState } from 'react';
import { X, Scale, ShoppingCart, Wrench, Eye, Plus, Check, Trash2 } from 'lucide-react';
import { Product } from '../types';
import { formatPkr } from '../utils/formatters';

interface ProductComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  comparedProducts: Product[];
  allProducts: Product[];
  onRemoveProduct: (productId: string) => void;
  onAddProduct: (product: Product) => void;
  onClearAll: () => void;
  onAddToCart: (product: Product, variantId?: string) => void;
  onSelectForBuilder: (product: Product) => void;
  onViewDetails: (product: Product) => void;
}

export const ProductComparisonModal: React.FC<ProductComparisonModalProps> = ({
  isOpen,
  onClose,
  comparedProducts,
  allProducts,
  onRemoveProduct,
  onAddProduct,
  onClearAll,
  onAddToCart,
  onSelectForBuilder,
  onViewDetails,
}) => {
  const [showAddPicker, setShowAddPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  if (!isOpen) return null;

  // Filter available products to add (not already compared, same or related category preferred)
  const availableToAdd = allProducts.filter(
    (p) =>
      !comparedProducts.some((cp) => cp.id === p.id) &&
      ((p.name || '').toLowerCase().includes(pickerSearch.toLowerCase()) ||
        (p.category || '').toLowerCase().includes(pickerSearch.toLowerCase()) ||
        (p.brand || '').toLowerCase().includes(pickerSearch.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-6xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Component Comparison Matrix</h2>
              <p className="text-xs text-slate-400">
                Compare architectural specs, socket compatibility, TDP, and pricing
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {comparedProducts.length > 0 && (
              <button
                onClick={onClearAll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-red-400 hover:bg-slate-800/80 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear All
              </button>
            )}
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Comparison Body */}
        <div className="overflow-y-auto flex-1 p-6">
          {comparedProducts.length === 0 ? (
            <div className="text-center py-16">
              <Scale className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-300">No components selected</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                Add up to 3 components from our catalog or PC builder to analyze their specs side-by-side.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="py-4 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider w-44">
                      Specification
                    </th>
                    {comparedProducts.map((prod) => (
                      <th key={prod.id} className="py-4 px-4 w-72 align-top">
                        <div className="relative bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
                          <button
                            onClick={() => onRemoveProduct(prod.id)}
                            className="absolute top-2 right-2 p-1 text-slate-400 hover:text-red-400 rounded transition-colors"
                            title="Remove"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <img
                            src={prod.image}
                            alt={prod.name}
                            className="w-full h-32 object-cover rounded-lg bg-slate-950 mb-3"
                          />
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-700 text-slate-300 mb-1">
                            {prod.category}
                          </span>
                          <h4 className="text-sm font-bold text-white line-clamp-2 mb-1">{prod.name}</h4>
                          <p className="text-base font-black text-emerald-400 mb-3">
                            {formatPkr(prod.price)}
                          </p>

                          <div className="space-y-1.5">
                            <button
                              onClick={() => {
                                onAddToCart(prod);
                              }}
                              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
                            >
                              <ShoppingCart className="w-3.5 h-3.5" />
                              Add to Cart
                            </button>
                            <div className="grid grid-cols-2 gap-1.5">
                              <button
                                onClick={() => {
                                  onSelectForBuilder(prod);
                                  onClose();
                                }}
                                className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-medium transition-colors"
                              >
                                <Wrench className="w-3 h-3" />
                                Rig Slot
                              </button>
                              <button
                                onClick={() => onViewDetails(prod)}
                                className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-[11px] font-medium transition-colors"
                              >
                                <Eye className="w-3 h-3" />
                                Details
                              </button>
                            </div>
                          </div>
                        </div>
                      </th>
                    ))}

                    {/* Add Product Slot */}
                    {comparedProducts.length < 3 && (
                      <th className="py-4 px-4 w-60 align-top">
                        <div className="h-full min-h-[300px] border-2 border-dashed border-slate-800 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                          <button
                            onClick={() => setShowAddPicker(true)}
                            className="w-12 h-12 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-400 flex items-center justify-center mb-2 transition-all hover:scale-105"
                          >
                            <Plus className="w-6 h-6" />
                          </button>
                          <span className="text-xs font-semibold text-slate-300">Add Another</span>
                          <span className="text-[11px] text-slate-500 mt-1">
                            Compare up to 3 components
                          </span>
                        </div>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  <tr>
                    <td className="py-3 px-4 font-medium text-slate-400">Brand / Maker</td>
                    {comparedProducts.map((p) => (
                      <td key={p.id} className="py-3 px-4 text-slate-200 font-semibold">
                        {p.brand || 'Apex'}
                      </td>
                    ))}
                    {comparedProducts.length < 3 && <td className="py-3 px-4"></td>}
                  </tr>

                  <tr>
                    <td className="py-3 px-4 font-medium text-slate-400">Stock Availability</td>
                    {comparedProducts.map((p) => (
                      <td key={p.id} className="py-3 px-4">
                        {p.inStock !== false ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                            <Check className="w-3.5 h-3.5" /> In Stock
                          </span>
                        ) : (
                          <span className="text-rose-400 font-medium">Out of Stock</span>
                        )}
                      </td>
                    ))}
                    {comparedProducts.length < 3 && <td className="py-3 px-4"></td>}
                  </tr>

                  <tr>
                    <td className="py-3 px-4 font-medium text-slate-400">Socket / Platform</td>
                    {comparedProducts.map((p) => (
                      <td key={p.id} className="py-3 px-4 text-slate-300">
                        {p.specifications?.socket || p.specs?.socket || 'N/A'}
                      </td>
                    ))}
                    {comparedProducts.length < 3 && <td className="py-3 px-4"></td>}
                  </tr>

                  <tr>
                    <td className="py-3 px-4 font-medium text-slate-400">RAM Type / Generation</td>
                    {comparedProducts.map((p) => (
                      <td key={p.id} className="py-3 px-4 text-slate-300">
                        {p.specifications?.ramType || p.specs?.ramType || 'N/A'}
                      </td>
                    ))}
                    {comparedProducts.length < 3 && <td className="py-3 px-4"></td>}
                  </tr>

                  <tr>
                    <td className="py-3 px-4 font-medium text-slate-400">TDP / Power Consumption</td>
                    {comparedProducts.map((p) => (
                      <td key={p.id} className="py-3 px-4 text-slate-300">
                        {p.specifications?.tdpWatts ? `${p.specifications.tdpWatts} Watts` : 'N/A'}
                      </td>
                    ))}
                    {comparedProducts.length < 3 && <td className="py-3 px-4"></td>}
                  </tr>

                  <tr>
                    <td className="py-3 px-4 font-medium text-slate-400">Warranty</td>
                    {comparedProducts.map((p) => (
                      <td key={p.id} className="py-3 px-4 text-slate-300">
                        {p.warranty || '1 Year Official Warranty'}
                      </td>
                    ))}
                    {comparedProducts.length < 3 && <td className="py-3 px-4"></td>}
                  </tr>

                  <tr>
                    <td className="py-3 px-4 font-medium text-slate-400">Description Overview</td>
                    {comparedProducts.map((p) => (
                      <td key={p.id} className="py-3 px-4 text-slate-400 line-clamp-3 leading-relaxed">
                        {p.description}
                      </td>
                    ))}
                    {comparedProducts.length < 3 && <td className="py-3 px-4"></td>}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Product Picker Sub-dialog */}
        {showAddPicker && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-10 flex flex-col p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Select Component to Compare</h3>
              <button
                onClick={() => setShowAddPicker(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="py-4">
              <input
                type="text"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="Search component name, category or brand..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {availableToAdd.slice(0, 20).map((prod) => (
                <div
                  key={prod.id}
                  onClick={() => {
                    onAddProduct(prod);
                    setShowAddPicker(false);
                  }}
                  className="flex items-center justify-between p-3 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={prod.image}
                      alt={prod.name}
                      className="w-10 h-10 object-cover rounded-lg bg-slate-950"
                    />
                    <div>
                      <p className="text-xs font-semibold text-white">{prod.name}</p>
                      <p className="text-[11px] text-slate-400">
                        {prod.category} • {prod.brand}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-emerald-400">{formatPkr(prod.price)}</p>
                    <span className="text-[10px] text-indigo-400 font-medium">+ Add to Compare</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
