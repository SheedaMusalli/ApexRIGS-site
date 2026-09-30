import React from 'react';
import {
  Sparkles,
  ArrowRight,
  Cpu,
  ShieldCheck,
  Truck,
  Wrench,
  Check,
  ShoppingCart,
  Eye,
  Heart,
  Scale,
} from 'lucide-react';
import { Product, ProductCategory, PCBuildParts, NavigationTab } from '../types';
import { formatPkr } from '../utils/formatters';
import { searchProducts } from '../utils/searchEngine';

interface HomePageProps {
  products: Product[];
  onAddToCart: (product: Product, variantId?: string) => void;
  onViewDetails: (product: Product) => void;
  onSelectForBuilder: (product: Product) => void;
  onApplyFullBuild: (build: PCBuildParts, variants: Record<string, string>) => void;
  onNavigateTab: (tab: NavigationTab) => void;
  onSelectCategory: (category: ProductCategory | 'All') => void;
  onOpenAI: () => void;
  wishlistProductIds: string[];
  onToggleWishlist: (product: Product) => void;
  comparedProducts: Product[];
  onToggleCompare: (product: Product) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  products,
  onAddToCart,
  onViewDetails,
  onSelectForBuilder,
  onNavigateTab,
  onSelectCategory,
  onOpenAI,
  wishlistProductIds,
  onToggleWishlist,
  comparedProducts,
  onToggleCompare,
  searchQuery,
  setSearchQuery,
}) => {
  const featured = products.slice(0, 8);

  // Live search results if search query is passed
  const searchResults = React.useMemo(() => {
    if (!searchQuery.trim()) return null;
    return searchProducts(products, searchQuery);
  }, [products, searchQuery]);

  return (
    <div className="space-y-14 pb-16">
      {/* Hero Banner */}
      <section className="relative overflow-hidden bg-slate-950 py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-b border-slate-800/80">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] animate-pulse delay-700" />
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-5" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/50 to-slate-950" />
        </div>

        <div className="max-w-7xl mx-auto relative z-10 flex flex-col lg:flex-row items-center justify-between gap-16">
          <div className="max-w-2xl text-left space-y-6">
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-slate-900/80 border border-slate-800 text-slate-300 text-[11px] font-bold uppercase tracking-[0.2em] shadow-xl">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-emerald-400">Live</span> Market Inventory · Pakistan
            </div>
            
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight leading-[1.05] text-wrap-balance">
              Architect Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">Ultimate Rig</span>
            </h1>
            
            <p className="text-slate-400 text-sm sm:text-lg max-w-xl leading-relaxed">
              Professional-grade hardware sourcing, precision assembly, and nationwide logistics. Your vision, our engineering expertise.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-4">
              <button
                onClick={() => onNavigateTab('builder')}
                className="group px-7 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl text-sm flex items-center gap-3 shadow-[0_0_40px_rgba(79,70,229,0.3)] transition-all hover:scale-105 active:scale-95 cursor-pointer"
              >
                <span>LAUNCH BUILDER</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
              <button
                onClick={() => onNavigateTab('shop')}
                className="px-7 py-4 bg-slate-900/50 hover:bg-slate-800/80 text-slate-200 border border-slate-700/50 font-black rounded-2xl text-sm transition-all hover:border-slate-500 cursor-pointer backdrop-blur-sm"
              >
                SHOP CATALOG
              </button>
            </div>

            {/* Quick Stats Ticker */}
            <div className="pt-10 flex flex-wrap items-center gap-8 border-t border-slate-800/50 mt-10">
              <div className="space-y-1">
                <div className="text-2xl font-black text-white font-mono tabular-nums">1.2k+</div>
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Components</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-black text-white font-mono tabular-nums">4.9/5</div>
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">User Rating</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-black text-white font-mono tabular-nums">24h</div>
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Support</div>
              </div>
            </div>
          </div>

          <div className="relative w-full max-w-lg">
            <div className="absolute -inset-4 bg-gradient-to-tr from-indigo-500/20 to-purple-600/20 rounded-[40px] blur-2xl opacity-50" />
            <div className="relative aspect-[4/5] rounded-[32px] overflow-hidden border border-white/10 bg-slate-900/40 backdrop-blur-xl p-8 flex flex-col justify-between shadow-2xl">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                    <Cpu className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div className="px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                    OPTIMIZED
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-black text-white tracking-tight">AI Build Engine</h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    Our neural suggestion engine analyzes 500+ benchmarks to pick the perfect components for your budget.
                  </p>
                </div>
              </div>

              <div className="space-y-3 py-6">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/50 border border-slate-800">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-indigo-400 border border-slate-800">
                    <Check className="w-4 h-4" />
                  </div>
                  <div className="text-[11px] font-bold text-slate-300">Socket Compatibility Verified</div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/50 border border-slate-800">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-purple-400 border border-slate-800">
                    <Check className="w-4 h-4" />
                  </div>
                  <div className="text-[11px] font-bold text-slate-300">TDP Thermal Margin Analysis</div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/50 border border-slate-800">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-pink-400 border border-slate-800">
                    <Check className="w-4 h-4" />
                  </div>
                  <div className="text-[11px] font-bold text-slate-300">RAM Clearance & Clearance Checks</div>
                </div>
              </div>

              <button
                onClick={onOpenAI}
                className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black rounded-2xl text-xs flex items-center justify-center gap-3 shadow-lg shadow-indigo-950/50 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer ring-1 ring-white/10"
              >
                <Sparkles className="w-4 h-4" />
                <span>START AI CONSULTATION</span>
              </button>
            </div>
            
            {/* Floating Element for visual interest */}
            <div className="absolute -bottom-6 -right-6 p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl animate-bounce-slow hidden sm:block">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                  <Wrench className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <div className="text-[10px] font-black text-white uppercase tracking-wider">Expert Assembly</div>
                  <div className="text-[9px] text-slate-400 font-bold">Standard on all builds</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Search Results (Only shown when user has searched on HomePage) */}
      {searchResults && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-900/80 border border-indigo-500/30 rounded-2xl backdrop-blur-md">
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-bold text-indigo-400 tracking-wider">Search Results</span>
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[11px] font-bold">
                  {searchResults.matchedCount} found
                </span>
              </div>
              <h2 className="text-lg font-bold text-white mt-0.5">
                Matches for &ldquo;{searchQuery}&rdquo;
              </h2>
              {searchResults.didYouMean && (
                <p className="text-xs text-indigo-300 mt-1">
                  Did you mean:{' '}
                  <button
                    onClick={() => setSearchQuery(searchResults.didYouMean!)}
                    className="font-bold underline text-white hover:text-indigo-200"
                  >
                    {searchResults.didYouMean}
                  </button>
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigateTab('shop')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                View in Shop Catalog
              </button>
              <button
                onClick={() => setSearchQuery('')}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Clear Search
              </button>
            </div>
          </div>

          {searchResults.results.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
              <p className="text-slate-300 text-sm font-semibold">
                No components matched &ldquo;{searchQuery}&rdquo;.
              </p>
              <p className="text-slate-500 text-xs max-w-md mx-auto">
                Try searching for specific brands like <span className="text-indigo-400">ASUS</span>, <span className="text-indigo-400">AMD</span>, <span className="text-indigo-400">Corsair</span>, or models like <span className="text-indigo-400">RTX 4070</span> or <span className="text-indigo-400">B650</span>.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {searchResults.results.slice(0, 8).map((p) => {
                const isWishlisted = wishlistProductIds.includes(p.id);
                const isCompared = comparedProducts.some((cp) => cp.id === p.id);

                return (
                  <div
                    key={p.id}
                    className="bg-slate-900/90 border border-indigo-500/20 hover:border-indigo-500/50 rounded-2xl p-4 flex flex-col justify-between transition-all group shadow-lg"
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
                              isWishlisted ? 'bg-rose-500 text-white' : 'bg-black/50 text-slate-300 hover:text-white'
                            }`}
                          >
                            <Heart className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onToggleCompare(p)}
                            className={`p-1.5 rounded-lg backdrop-blur-md transition-colors ${
                              isCompared ? 'bg-indigo-600 text-white' : 'bg-black/50 text-slate-300 hover:text-white'
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
              })}
            </div>
          )}
        </section>
      )}

      {/* Featured Products */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="text-left">
            <h2 className="text-2xl font-bold text-white tracking-tight">Featured Hardware</h2>
            <p className="text-xs text-slate-400 mt-1">High-demand components and gaming essentials</p>
          </div>
          <button
            onClick={() => onNavigateTab('shop')}
            className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {featured.map((p) => {
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
          })}
        </div>
      </section>
    </div>
  );
};
