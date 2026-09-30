import React from 'react';
import { X, Heart, ShoppingCart, Trash2, Eye, Wrench, ArrowRight } from 'lucide-react';
import { Product } from '../types';
import { formatPkr } from '../utils/formatters';

interface WishlistDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  wishlistProducts: Product[];
  onRemoveFromWishlist: (productId: string) => void;
  onAddToCart: (product: Product, variantId?: string) => void;
  onViewProductDetails: (product: Product) => void;
  onSelectForBuilder: (product: Product) => void;
}

export const WishlistDrawer: React.FC<WishlistDrawerProps> = ({
  isOpen,
  onClose,
  wishlistProducts,
  onRemoveFromWishlist,
  onAddToCart,
  onViewProductDetails,
  onSelectForBuilder,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center">
                <Heart className="w-5 h-5 fill-pink-400/30" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Your Saved Wishlist</h2>
                <p className="text-xs text-slate-400">{wishlistProducts.length} items saved</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {wishlistProducts.length === 0 ? (
              <div className="text-center py-20">
                <Heart className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-slate-300">Your wishlist is empty</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  Click the heart icon on any component or rig to save it for later review or price tracking.
                </p>
              </div>
            ) : (
              wishlistProducts.map((prod) => (
                <div
                  key={prod.id}
                  className="bg-slate-800/60 border border-slate-800 rounded-xl p-3.5 flex gap-3.5 hover:border-slate-700 transition-colors"
                >
                  <img
                    src={prod.image}
                    alt={prod.name}
                    className="w-18 h-18 object-cover rounded-lg bg-slate-950 shrink-0"
                  />
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[10px] font-semibold uppercase text-indigo-400">
                          {prod.category}
                        </span>
                        <button
                          onClick={() => onRemoveFromWishlist(prod.id)}
                          className="text-slate-500 hover:text-red-400 p-0.5 rounded transition-colors"
                          title="Remove from wishlist"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <h4 className="text-xs font-semibold text-white truncate mt-0.5">{prod.name}</h4>
                      <p className="text-xs font-bold text-emerald-400 mt-1">
                        {formatPkr(prod.price)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-800/80">
                      <button
                        onClick={() => {
                          onAddToCart(prod);
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
                      >
                        <ShoppingCart className="w-3 h-3" />
                        Add to Cart
                      </button>
                      <button
                        onClick={() => {
                          onSelectForBuilder(prod);
                          onClose();
                        }}
                        className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                        title="Add to PC Builder"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          onViewProductDetails(prod);
                        }}
                        className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {wishlistProducts.length > 0 && (
            <div className="p-5 border-t border-slate-800 bg-slate-900/90">
              <button
                onClick={() => {
                  wishlistProducts.forEach((p) => onAddToCart(p));
                  onClose();
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-lg shadow-emerald-600/20 transition-all"
              >
                <ShoppingCart className="w-4 h-4" />
                Add All Items to Cart
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
