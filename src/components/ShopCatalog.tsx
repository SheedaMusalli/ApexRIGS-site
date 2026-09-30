import React, { useState, useMemo } from 'react';
import { Search, ShoppingCart, Heart, Scale, Cpu, Filter, Sparkles, X, AlertCircle } from 'lucide-react';
import { Product, ProductCategory } from '../types';
import { formatPkr } from '../utils/formatters';
import { GoogleSearchBar } from './GoogleSearchBar';
import { searchProducts } from '../utils/searchEngine';

interface ShopCatalogProps {
  products: Product[];
  onAddToCart: (product: Product, variantId?: string) => void;
  onViewDetails: (product: Product) => void;
  onSelectForBuilder: (product: Product) => void;
  onOpenBuilder: () => void;
  onOpenAI: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: ProductCategory | 'All';
  onSelectCategory: (category: ProductCategory | 'All') => void;
  wishlistProductIds: string[];
  onToggleWishlist: (product: Product) => void;
  comparedProducts: Product[];
  onToggleCompare: (product: Product) => void;
}

const CATEGORIES: (ProductCategory | 'All')[] = [
  'All',
  'Processor',
  'Motherboard',
  'Graphic Card',
  'RAM',
  'Storage',
  'Power Supply',
  'Casing',
  'CPU Cooler',
  'PC Case Fans',
  'Monitor',
  'Gaming Mouse',
  'Gaming Keyboard',
  'Gaming Headset',
  'Pre-Built PC',
];

export const ShopCatalog: React.FC<ShopCatalogProps> = ({
  products,
  onAddToCart,
  onViewDetails,
  onSelectForBuilder,
  searchQuery,
  setSearchQuery,
  selectedCategory,
  onSelectCategory,
  wishlistProductIds,
  onToggleWishlist,
  comparedProducts,
  onToggleCompare,
}) => {
  const [selectedBrand, setSelectedBrand] = useState<string>('All');
  const [priceSort, setPriceSort] = useState<'none' | 'asc' | 'desc'>('none');

  const brands = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.brand) set.add(p.brand);
    });
    return ['All', ...Array.from(set).sort()];
  }, [products]);

  // Google-like intelligent search query result
  const searchResult = useMemo(() => {
    if (!searchQuery.trim()) return null;
    return searchProducts(products, searchQuery);
  }, [products, searchQuery]);

  const filtered = useMemo(() => {
    let list: Product[] = [];

    if (searchQuery.trim() && searchResult) {
      list = searchResult.results;
      if (selectedCategory !== 'All') {
        const inCat = list.filter((p) => p.category === selectedCategory);
        // If there are matches in the selected category, prioritize them.
        // If 0 matches in selected category, but matches exist globally, display all results
        // so user isn't shown 0 products due to an active category filter.
        list = inCat.length > 0 ? inCat : list;
      }
      if (selectedBrand !== 'All') {
        const inBrand = list.filter((p) => p.brand === selectedBrand);
        list = inBrand.length > 0 ? inBrand : list;
      }
    } else {
      list = products.filter((p) => !p.isDeleted);
      if (selectedCategory !== 'All') {
        list = list.filter((p) => p.category === selectedCategory);
      }
      if (selectedBrand !== 'All') {
        list = list.filter((p) => p.brand === selectedBrand);
      }
    }

    if (priceSort === 'asc') {
      list.sort((a, b) => (a.price || 0) - (b.price || 0));
    } else if (priceSort === 'desc') {
      list.sort((a, b) => (b.price || 0) - (a.price || 0));
    }

    return list;
  }, [products, selectedCategory, selectedBrand, searchQuery, searchResult, priceSort]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Category Pills */}
      <div className="overflow-x-auto pb-2 custom-scrollbar">
        <div className="flex gap-2 min-w-max">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => onSelectCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
        <div className="relative w-full sm:w-96">
          <GoogleSearchBar
            variant="catalog"
            products={products}
            searchQuery={searchQuery}
            onSearch={(q) => setSearchQuery(q)}
            onSelectCategory={(cat) => onSelectCategory(cat)}
            onViewProduct={(prod) => onViewDetails(prod)}
            onAddToCart={(prod) => onAddToCart(prod)}
            placeholder="Search by product name, brand, or specs..."
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
          >
            {brands.map((b) => (
              <option key={b} value={b}>
                Brand: {b}
              </option>
            ))}
          </select>

          <select
            value={priceSort}
            onChange={(e) => setPriceSort(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
          >
            <option value="none">Sort: Default</option>
            <option value="asc">Price: Low to High</option>
            <option value="desc">Price: High to Low</option>
          </select>
        </div>
      </div>

      {/* Search status banner if active */}
      {searchQuery.trim() && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-900/80 border border-indigo-500/30 rounded-2xl">
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-bold text-indigo-400">Search Results</span>
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[11px] font-bold">
                {filtered.length} matching
              </span>
            </div>
            <p className="text-sm text-slate-200 mt-0.5">
              Showing hardware results for <strong className="text-white">&ldquo;{searchQuery}&rdquo;</strong>
            </p>
            {searchResult?.didYouMean && (
              <p className="text-xs text-indigo-300 mt-1 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                <span>Did you mean:</span>
                <button
                  onClick={() => setSearchQuery(searchResult.didYouMean!)}
                  className="font-bold underline text-white hover:text-indigo-200 cursor-pointer"
                >
                  {searchResult.didYouMean}
                </button>
              </p>
            )}
          </div>
          <button
            onClick={() => setSearchQuery('')}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
          >
            <X className="w-3.5 h-3.5" />
            <span>Clear Search</span>
          </button>
        </div>
      )}

      {/* Product Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {filtered.length === 0 ? (
          <div className="col-span-full py-16 px-4 bg-slate-900/40 border border-slate-800 rounded-3xl text-center space-y-4 max-w-xl mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
              <Search className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">No products found</h3>
              <p className="text-xs text-slate-400 mt-1">
                {searchQuery
                  ? `We couldn't find any hardware matching "${searchQuery}".`
                  : 'No products match the selected filters.'}
              </p>
            </div>
            {searchResult?.didYouMean && (
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl inline-flex items-center gap-2 text-xs text-indigo-300">
                <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
                <span>Did you mean:</span>
                <button
                  onClick={() => setSearchQuery(searchResult.didYouMean!)}
                  className="font-bold underline text-white hover:text-indigo-200 cursor-pointer"
                >
                  {searchResult.didYouMean}
                </button>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Clear Search Query
                </button>
              )}
              {selectedCategory !== 'All' && (
                <button
                  onClick={() => onSelectCategory('All')}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Show All Categories
                </button>
              )}
            </div>
          </div>
        ) : (
          filtered.map((p) => {
            const isWishlisted = wishlistProductIds.includes(p.id);
            const isCompared = comparedProducts.some((cp) => cp.id === p.id);

            return (
              <div
                key={p.id}
                className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-700 transition-all group"
              >
                <div>
                  <div className="relative aspect-video rounded-xl bg-slate-950 overflow-hidden mb-3">
                    <img
                      src={p.image}
                      alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-2 right-2 flex gap-1.5">
                      <button
                        onClick={() => onToggleWishlist(p)}
                        className={`p-1.5 rounded-lg backdrop-blur-md transition-colors ${
                          isWishlisted
                            ? 'bg-rose-500 text-white'
                            : 'bg-black/50 text-slate-300 hover:text-white'
                        }`}
                      >
                        <Heart className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onToggleCompare(p)}
                        className={`p-1.5 rounded-lg backdrop-blur-md transition-colors ${
                          isCompared
                            ? 'bg-indigo-600 text-white'
                            : 'bg-black/50 text-slate-300 hover:text-white'
                        }`}
                      >
                        <Scale className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider mb-1">
                    {p.category}
                  </div>
                  <h3
                    onClick={() => onViewDetails(p)}
                    className="font-bold text-sm text-slate-200 line-clamp-2 hover:text-indigo-400 cursor-pointer text-left mb-2"
                  >
                    {p.name}
                  </h3>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <div className="text-left">
                    <div className="text-base font-extrabold text-white">{formatPkr(p.price)}</div>
                    <div className="text-[10px] mt-0.5">
                      {p.inStock !== false ? (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          In Stock
                        </span>
                      ) : (
                        <span className="text-rose-400 font-semibold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                          Out of Stock
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    disabled={p.inStock === false}
                    onClick={() => onAddToCart(p)}
                    className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-colors cursor-pointer"
                    title={p.inStock === false ? 'Out of Stock' : 'Add to Cart'}
                  >
                    <ShoppingCart className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
