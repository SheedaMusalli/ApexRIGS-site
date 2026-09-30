import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  X,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Tag,
  Folder,
  ShoppingCart,
  Eye,
  CornerDownLeft,
  Clock,
} from 'lucide-react';
import { Product, ProductCategory, NavigationTab } from '../types';
import { formatPkr } from '../utils/formatters';
import {
  generateGoogleSuggestions,
  GoogleSearchSuggestion,
} from '../utils/searchEngine';

interface GoogleSearchBarProps {
  products: Product[];
  searchQuery: string;
  onSearch: (query: string) => void;
  onSelectCategory?: (category: ProductCategory | 'All') => void;
  onViewProduct?: (product: Product) => void;
  onAddToCart?: (product: Product) => void;
  onNavigateTab?: (tab: NavigationTab) => void;
  variant?: 'hero' | 'navbar' | 'catalog';
  placeholder?: string;
  autoFocus?: boolean;
}

const POPULAR_SEARCH_CHIPS = [
  'RTX 4070 Super',
  'Ryzen 7 7800X3D',
  'DDR5 32GB RAM',
  'B650 Motherboard',
  'Samsung 990 Pro',
  '240Hz Gaming Monitor',
  '360mm Liquid Cooler',
];

export const GoogleSearchBar: React.FC<GoogleSearchBarProps> = ({
  products,
  searchQuery,
  onSearch,
  onSelectCategory,
  onViewProduct,
  onAddToCart,
  onNavigateTab,
  variant = 'hero',
  placeholder = 'Search RTX 4070, Ryzen 7, DDR5, or brands...',
  autoFocus = false,
}) => {
  const [inputValue, setInputValue] = useState(searchQuery);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('apex_recent_searches');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external search query
  useEffect(() => {
    setInputValue(searchQuery);
  }, [searchQuery]);

  // Save recent search
  const saveRecentSearch = (term: string) => {
    const clean = term.trim();
    if (!clean) return;
    setRecentSearches((prev) => {
      const updated = [clean, ...prev.filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(0, 5);
      try {
        localStorage.setItem('apex_recent_searches', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Generate Google-style autocomplete suggestions
  const { suggestions, didYouMean } = useMemo(() => {
    return generateGoogleSuggestions(inputValue, products);
  }, [inputValue, products]);

  // Click outside listener to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation like Google
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        handleSelectSuggestion(suggestions[selectedIndex]);
      } else {
        executeSearch(inputValue);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setSelectedIndex(-1);
    }
  };

  const executeSearch = (query: string) => {
    saveRecentSearch(query);
    setIsOpen(false);
    onSearch(query);
    if (onNavigateTab) {
      onNavigateTab('shop');
    }
  };

  const handleSelectSuggestion = (suggestion: GoogleSearchSuggestion) => {
    if (suggestion.type === 'query') {
      setInputValue(suggestion.text);
      executeSearch(suggestion.text);
    } else if (suggestion.type === 'category' && suggestion.category) {
      saveRecentSearch(suggestion.text);
      setIsOpen(false);
      if (onSelectCategory) {
        onSelectCategory(suggestion.category);
      }
      if (onNavigateTab) {
        onNavigateTab('shop');
      }
    } else if (suggestion.type === 'brand') {
      setInputValue(suggestion.brand || suggestion.text);
      executeSearch(suggestion.brand || suggestion.text);
    } else if (suggestion.type === 'product' && suggestion.product) {
      saveRecentSearch(suggestion.product.name);
      setIsOpen(false);
      if (onViewProduct) {
        onViewProduct(suggestion.product);
      } else {
        executeSearch(suggestion.product.name);
      }
    }
  };

  const handleClear = () => {
    setInputValue('');
    onSearch('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const isHero = variant === 'hero';
  const isNavbar = variant === 'navbar';

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${isHero ? 'max-w-3xl mx-auto' : isNavbar ? 'w-full' : 'max-w-md'}`}
    >
      {/* Search Input Container */}
      <div
        className={`relative flex items-center transition-all duration-200 ${
          isHero
            ? 'bg-slate-900/90 hover:bg-slate-900 border-2 border-slate-700/80 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/20 rounded-2xl sm:rounded-full shadow-2xl p-1.5 sm:p-2 backdrop-blur-xl'
            : isNavbar
            ? 'bg-slate-950/80 border border-slate-800 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 rounded-xl px-2.5 py-1.5'
            : 'bg-slate-950 border border-slate-800 focus-within:border-indigo-500 rounded-xl px-3 py-2'
        }`}
      >
        {/* Search Icon */}
        <div className={`flex items-center justify-center text-slate-400 ${isHero ? 'pl-3 pr-2' : 'pr-2'}`}>
          <Search className={`${isHero ? 'w-5 h-5 text-indigo-400' : 'w-4 h-4 text-slate-400'}`} />
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          autoFocus={autoFocus}
          placeholder={placeholder}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsOpen(true);
            setSelectedIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          className={`w-full bg-transparent text-slate-100 placeholder-slate-400 focus:outline-none ${
            isHero ? 'text-sm sm:text-base py-1' : 'text-xs py-0.5'
          }`}
        />

        {/* Action icons on right */}
        <div className="flex items-center gap-1.5 pl-2 pr-1">
          {inputValue && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {isHero && (
            <button
              type="button"
              onClick={() => executeSearch(inputValue)}
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl sm:rounded-full text-xs sm:text-sm flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition-all cursor-pointer whitespace-nowrap"
            >
              <span>Search</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {!isHero && (
            <button
              type="button"
              onClick={() => executeSearch(inputValue)}
              className="p-1.5 text-indigo-400 hover:text-indigo-300 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Search"
            >
              <CornerDownLeft className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Hero Quick Search Chips */}
      {isHero && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-indigo-400" /> Popular:
          </span>
          {POPULAR_SEARCH_CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => {
                setInputValue(chip);
                executeSearch(chip);
              }}
              className="px-2.5 py-1 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/50 text-slate-300 hover:text-white rounded-lg text-xs transition-all cursor-pointer shadow-sm"
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Google-Style Predictive Dropdown */}
      {isOpen && (
        <div
          className={`absolute left-0 right-0 top-full mt-2 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden z-50 backdrop-blur-2xl transition-all ${
            isHero ? 'max-h-[500px]' : 'max-h-[420px]'
          } overflow-y-auto custom-scrollbar`}
        >
          {/* Typo Correction Banner ("Did you mean: ...") */}
          {didYouMean && (
            <div
              onClick={() => {
                setInputValue(didYouMean);
                executeSearch(didYouMean);
              }}
              className="px-4 py-2.5 bg-indigo-500/10 border-b border-indigo-500/20 flex items-center justify-between text-xs text-indigo-300 hover:bg-indigo-500/20 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
                <span>
                  Did you mean: <strong className="font-bold underline text-white">{didYouMean}</strong>?
                </span>
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400">Search instead</span>
            </div>
          )}

          {/* Autocomplete Predictions & Rich Items */}
          <div className="py-2 divide-y divide-slate-800/60">
            {suggestions.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">
                No components found matching &ldquo;{inputValue}&rdquo;. Try another hardware keyword or brand.
              </div>
            ) : (
              suggestions.map((suggestion, idx) => {
                const isSelected = selectedIndex === idx;

                if (suggestion.type === 'query') {
                  return (
                    <div
                      key={`query-${suggestion.text}-${idx}`}
                      onClick={() => handleSelectSuggestion(suggestion)}
                      className={`px-4 py-2.5 flex items-center justify-between transition-colors cursor-pointer text-left ${
                        isSelected ? 'bg-indigo-600/20 text-white' : 'hover:bg-slate-800/80 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <div className="text-xs truncate">
                          {suggestion.highlightedPrefix ? (
                            <span>
                              <span className="text-slate-400">{suggestion.highlightedPrefix}</span>
                              <span className="font-bold text-indigo-300">{suggestion.suggestedSuffix}</span>
                            </span>
                          ) : (
                            <span>{suggestion.text}</span>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0 opacity-0 group-hover:opacity-100" />
                    </div>
                  );
                }

                if (suggestion.type === 'category') {
                  return (
                    <div
                      key={`cat-${suggestion.text}-${idx}`}
                      onClick={() => handleSelectSuggestion(suggestion)}
                      className={`px-4 py-2.5 flex items-center justify-between transition-colors cursor-pointer text-left ${
                        isSelected ? 'bg-indigo-600/20 text-white' : 'hover:bg-slate-800/80 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Folder className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <div className="text-xs">
                          <span className="font-medium text-slate-300">Category: </span>
                          <span className="font-bold text-white">{suggestion.text}</span>
                          {suggestion.count !== undefined && (
                            <span className="text-[11px] text-slate-500 ml-2">({suggestion.count} items)</span>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] text-indigo-400 font-semibold uppercase">Browse category</span>
                    </div>
                  );
                }

                if (suggestion.type === 'brand') {
                  return (
                    <div
                      key={`brand-${suggestion.text}-${idx}`}
                      onClick={() => handleSelectSuggestion(suggestion)}
                      className={`px-4 py-2.5 flex items-center justify-between transition-colors cursor-pointer text-left ${
                        isSelected ? 'bg-indigo-600/20 text-white' : 'hover:bg-slate-800/80 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Tag className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        <div className="text-xs">
                          <span className="font-medium text-slate-300">Brand: </span>
                          <span className="font-bold text-white">{suggestion.text}</span>
                          {suggestion.count !== undefined && (
                            <span className="text-[11px] text-slate-500 ml-2">({suggestion.count} components)</span>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] text-purple-400 font-semibold uppercase">Filter brand</span>
                    </div>
                  );
                }

                if (suggestion.type === 'product' && suggestion.product) {
                  const p = suggestion.product;
                  return (
                    <div
                      key={`prod-${p.id}-${idx}`}
                      className={`px-4 py-3 flex items-center justify-between gap-3 transition-colors ${
                        isSelected ? 'bg-indigo-600/20' : 'hover:bg-slate-800/80'
                      }`}
                    >
                      <div
                        onClick={() => handleSelectSuggestion(suggestion)}
                        className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                      >
                        <img
                          src={p.image}
                          alt={p.name}
                          className="w-10 h-10 rounded-lg object-cover bg-slate-950 border border-slate-800 shrink-0"
                        />
                        <div className="min-w-0 text-left">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                              {p.category}
                            </span>
                            {p.brand && (
                              <span className="text-[10px] text-slate-400 font-medium">· {p.brand}</span>
                            )}
                          </div>
                          <h4 className="text-xs font-bold text-slate-100 truncate hover:text-indigo-400 transition-colors">
                            {p.name}
                          </h4>
                          <div className="text-xs font-extrabold text-white mt-0.5">
                            {formatPkr(p.price)}
                            <span
                              className={`text-[10px] font-semibold ml-2 ${
                                p.inStock !== false ? 'text-emerald-400' : 'text-amber-400'
                              }`}
                            >
                              {p.inStock !== false ? 'In Stock' : 'Out of Stock'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {onViewProduct && (
                          <button
                            type="button"
                            onClick={() => {
                              saveRecentSearch(p.name);
                              setIsOpen(false);
                              onViewProduct(p);
                            }}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"
                            title="Quick View"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onAddToCart && (
                          <button
                            type="button"
                            onClick={() => {
                              saveRecentSearch(p.name);
                              onAddToCart(p);
                            }}
                            className="p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
                            title="Add to Cart"
                          >
                            <ShoppingCart className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }

                return null;
              })
            )}
          </div>

          {/* Recent Searches (if input is empty) */}
          {!inputValue && recentSearches.length > 0 && (
            <div className="p-3 bg-slate-950/60 border-t border-slate-800">
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
                <span className="flex items-center gap-1 font-semibold">
                  <Clock className="w-3 h-3 text-slate-400" /> Recent Searches:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setRecentSearches([]);
                    localStorage.removeItem('apex_recent_searches');
                  }}
                  className="text-slate-500 hover:text-slate-300 text-[10px]"
                >
                  Clear history
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {recentSearches.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => {
                      setInputValue(term);
                      executeSearch(term);
                    }}
                    className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Footer note */}
          <div className="px-4 py-2 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <span>Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px] text-slate-300">Enter</kbd> to search all results</span>
            <span className="text-indigo-400">Intelligent Search Engine</span>
          </div>
        </div>
      )}
    </div>
  );
};
