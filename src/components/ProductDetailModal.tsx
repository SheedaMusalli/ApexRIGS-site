import React, { useState, useEffect } from 'react';
import {
  X,
  ShoppingCart,
  Heart,
  Scale,
  Wrench,
  Check,
  Shield,
  Truck,
  Cpu,
  Zap,
  Info,
} from 'lucide-react';
import { Product, ProductVariant } from '../types';
import { formatPkr } from '../utils/formatters';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  onAddToCart: (product: Product, variantId?: string) => void;
  onSelectForBuilder: (product: Product) => void;
  isWishlisted: boolean;
  onToggleWishlist: (product: Product) => void;
  isCompared: boolean;
  onToggleCompare: (product: Product) => void;
  currentUserEmail?: string;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  onAddToCart,
  onSelectForBuilder,
  isWishlisted,
  onToggleWishlist,
  isCompared,
  onToggleCompare,
  currentUserEmail,
}) => {
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(undefined);
  const [activeImage, setActiveImage] = useState<string>('');

  useEffect(() => {
    if (product) {
      if (Array.isArray(product.variants) && product.variants.length > 0) {
        setSelectedVariantId(product.variants[0].id);
        setActiveImage(product.variants[0].image || product.image);
      } else {
        setSelectedVariantId(undefined);
        setActiveImage(product.image);
      }
    }
  }, [product]);

  if (!product) return null;

  const currentVariant = Array.isArray(product.variants) ? product.variants.find((v) => v.id === selectedVariantId) : undefined;
  const effectivePrice = currentVariant ? currentVariant.price : product.price;
  const originalPrice = currentVariant?.originalPrice || product.originalPrice;
  const isDiscounted = originalPrice && originalPrice > effectivePrice;

  const additionalImages = Array.isArray(product.additionalImages) ? product.additionalImages : [];
  const variantImages = Array.isArray(product.variants)
    ? (product.variants.map((v) => v.image).filter(Boolean) as string[])
    : [];

  const allImages = [
    product.image,
    ...additionalImages,
    ...variantImages,
  ].filter((img, idx, arr) => arr.indexOf(img) === idx && Boolean(img));

  const specs = product.specifications || product.specs || {};

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              {product.category}
            </span>
            <span className="text-xs text-slate-400">• Brand: {product.brand || 'Apex'}</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Images Column */}
          <div className="space-y-4">
            <div className="relative aspect-square w-full rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center">
              <img
                src={activeImage || product.image}
                alt={product.name}
                className="w-full h-full object-cover"
              />
              {isDiscounted && (
                <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg text-xs font-black bg-rose-600 text-white shadow-lg">
                  SALE
                </span>
              )}
            </div>

            {/* Thumbnail Strip */}
            {allImages.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {allImages.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(img)}
                    className={`w-16 h-16 rounded-xl overflow-hidden border-2 shrink-0 bg-slate-950 transition-all ${
                      activeImage === img ? 'border-indigo-500 scale-95' : 'border-slate-800 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Guarantees Box */}
            <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Warranty: {product.warranty || '1 Year Official Brand Warranty'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>Insured Nationwide Courier Dispatch across Pakistan</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>100% Genuine, Factory Sealed Components</span>
              </div>
            </div>
          </div>

          {/* Details Column */}
          <div className="space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div>
                <h1 className="text-xl font-black text-white leading-tight">{product.name}</h1>
                <p className="text-xs text-slate-400 mt-1">SKU: {product.sku || (product.id ? String(product.id).slice(0, 8) : '')}</p>
              </div>

              {/* Price & Stock */}
              <div className="flex items-baseline gap-3">
                <span className="text-2xl font-black text-emerald-400">
                  {formatPkr(effectivePrice)}
                </span>
                {isDiscounted && (
                  <span className="text-sm line-through text-slate-500">
                    {formatPkr(originalPrice)}
                  </span>
                )}
                <div className="ml-auto">
                  {product.inStock !== false ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      In Stock
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      Out of Stock
                    </span>
                  )}
                </div>
              </div>

              {/* Variants Selector */}
              {Array.isArray(product.variants) && product.variants.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Choose Option / Edition:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {product.variants.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => {
                          setSelectedVariantId(v.id);
                          if (v.image) setActiveImage(v.image);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          selectedVariantId === v.id
                            ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/25'
                            : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {v.name} {v.color ? `(${v.color})` : ''} - {formatPkr(v.price)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800">
                <h4 className="text-xs font-semibold text-slate-300">Overview</h4>
                <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-line">
                  {product.description}
                </p>
              </div>

              {/* Specs Table */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-indigo-400" /> Technical Specifications
                </h4>
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 grid grid-cols-2 gap-2 text-xs">
                  {specs.socket && (
                    <div>
                      <span className="text-slate-500 block">Socket</span>
                      <span className="font-semibold text-slate-200">{specs.socket}</span>
                    </div>
                  )}
                  {specs.chipset && (
                    <div>
                      <span className="text-slate-500 block">Chipset</span>
                      <span className="font-semibold text-slate-200">{specs.chipset}</span>
                    </div>
                  )}
                  {specs.ramType && (
                    <div>
                      <span className="text-slate-500 block">Memory Type</span>
                      <span className="font-semibold text-slate-200">{specs.ramType}</span>
                    </div>
                  )}
                  {specs.formFactor && (
                    <div>
                      <span className="text-slate-500 block">Form Factor</span>
                      <span className="font-semibold text-slate-200">{specs.formFactor}</span>
                    </div>
                  )}
                  {specs.tdpWatts && (
                    <div>
                      <span className="text-slate-500 block">TDP</span>
                      <span className="font-semibold text-slate-200">{specs.tdpWatts} Watts</span>
                    </div>
                  )}
                  {specs.psuWattage && (
                    <div>
                      <span className="text-slate-500 block">Wattage</span>
                      <span className="font-semibold text-slate-200">{specs.psuWattage}W</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-4 border-t border-slate-800">
              <div className="flex gap-2">
                <button
                  disabled={product.inStock === false}
                  onClick={() => {
                    onAddToCart(product, selectedVariantId);
                    onClose();
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs shadow-lg shadow-emerald-600/30 transition-all hover:scale-[1.01]"
                >
                  <ShoppingCart className="w-4 h-4" />
                  {product.inStock === false ? 'Out of Stock' : 'Add to Cart'}
                </button>
                <button
                  onClick={() => {
                    onSelectForBuilder(product);
                    onClose();
                  }}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.01]"
                  title="Configure in PC Builder"
                >
                  <Wrench className="w-4 h-4" />
                  Load into Rig
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onToggleWishlist(product)}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${
                    isWishlisted
                      ? 'bg-pink-500/20 border-pink-500/40 text-pink-300'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-750'
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${isWishlisted ? 'fill-pink-400 text-pink-400' : ''}`} />
                  {isWishlisted ? 'Wishlisted' : 'Add to Wishlist'}
                </button>
                <button
                  onClick={() => onToggleCompare(product)}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${
                    isCompared
                      ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-750'
                  }`}
                >
                  <Scale className="w-3.5 h-3.5" />
                  {isCompared ? 'Comparing' : 'Compare Specs'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
