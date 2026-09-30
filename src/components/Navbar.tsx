import React, { useState } from 'react';
import {
  ShoppingCart,
  Heart,
  User,
  Shield,
  Search,
  Sparkles,
  Cpu,
  Store,
  Layers,
  Moon,
  Sun,
  Menu,
  X,
  Truck,
} from 'lucide-react';
import { Product, UserAccount, NavigationTab, ProductCategory } from '../types';
import { formatPkr } from '../utils/formatters';
import { GoogleSearchBar } from './GoogleSearchBar';

interface NavbarProps {
  currentTab: NavigationTab;
  setCurrentTab: (tab: NavigationTab) => void;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  cartCount: number;
  cartTotal: number;
  onOpenCart: () => void;
  onOpenAI: () => void;
  onOpenUser: () => void;
  onOpenWishlist: () => void;
  onOpenAdmin: () => void;
  onOpenTracking?: () => void;
  currentUser: UserAccount | null;
  isAdminLoggedIn: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  products: Product[];
  onViewDetails: (prod: Product) => void;
  onAddToCart: (prod: Product) => void;
  onSelectCategory: (cat: ProductCategory | 'All') => void;
  wishlistCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  darkMode,
  setDarkMode,
  cartCount,
  cartTotal,
  onOpenCart,
  onOpenAI,
  onOpenUser,
  onOpenWishlist,
  onOpenAdmin,
  onOpenTracking,
  currentUser,
  isAdminLoggedIn,
  searchQuery,
  setSearchQuery,
  products,
  onViewDetails,
  onAddToCart,
  onSelectCategory,
  wishlistCount,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo */}
          <div
            onClick={() => setCurrentTab('home')}
            className="flex items-center gap-3 cursor-pointer shrink-0"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-black tracking-tight text-white block leading-none">
                APEX<span className="text-indigo-400">RIG</span>
              </span>
              <span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase block">
                PC & Hardware Store
              </span>
            </div>
          </div>

          {/* Navigation links */}
          <nav className="hidden md:flex items-center gap-1">
            <button
              onClick={() => setCurrentTab('home')}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                currentTab === 'home'
                  ? 'bg-slate-800 text-indigo-400'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900'
              }`}
            >
              Home
            </button>
            <button
              onClick={() => setCurrentTab('shop')}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                currentTab === 'shop'
                  ? 'bg-slate-800 text-indigo-400'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900'
              }`}
            >
              Shop Catalog
            </button>
            <button
              onClick={() => setCurrentTab('builder')}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                currentTab === 'builder'
                  ? 'bg-slate-800 text-indigo-400'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900'
              }`}
            >
              PC Builder
            </button>
          </nav>

          {/* Google-Style Predictive Search bar */}
          <div className="hidden lg:flex flex-1 max-w-sm relative">
            <GoogleSearchBar
              variant="navbar"
              products={products}
              searchQuery={searchQuery}
              onSearch={(q) => {
                setSearchQuery(q);
                setCurrentTab('shop');
              }}
              onSelectCategory={(cat) => {
                onSelectCategory(cat);
                setCurrentTab('shop');
              }}
              onViewProduct={(prod) => onViewDetails(prod)}
              onAddToCart={(prod) => onAddToCart(prod)}
              onNavigateTab={(tab) => setCurrentTab(tab)}
              placeholder="Search RTX 4070, Ryzen 7, DDR5..."
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* AI Assistant Button */}
            <button
              onClick={onOpenAI}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 hover:border-indigo-500/40 rounded-xl text-xs font-semibold text-indigo-300 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              <span>Build Assistant</span>
            </button>

            {/* Track Shipment Button */}
            {onOpenTracking && (
              <button
                onClick={onOpenTracking}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-slate-600 rounded-xl text-xs font-semibold text-slate-200 hover:text-white transition-all shadow-sm"
                title="Track Live Pakistan Courier Shipment"
              >
                <Truck className="w-3.5 h-3.5 text-amber-400" />
                <span>Track Order</span>
              </button>
            )}

            {/* Wishlist Button */}
            <button
              onClick={onOpenWishlist}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-900 rounded-xl relative transition-colors"
              title="Wishlist"
            >
              <Heart className="w-5 h-5" />
              {wishlistCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {wishlistCount}
                </span>
              )}
            </button>

            {/* Cart Button */}
            <button
              onClick={onOpenCart}
              className="flex items-center gap-2 p-2 sm:px-3 text-slate-200 hover:bg-slate-900 border border-slate-800 rounded-xl relative transition-colors"
            >
              <ShoppingCart className="w-5 h-5 text-indigo-400" />
              <div className="hidden sm:flex flex-col text-left leading-none">
                <span className="text-[10px] text-slate-400 font-medium">Cart</span>
                <span className="text-xs font-bold">{formatPkr(cartTotal)}</span>
              </div>
              {cartCount > 0 && (
                <span className="sm:hidden absolute top-1 right-1 w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>

            {/* User Account Button */}
            <button
              onClick={onOpenUser}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-900 rounded-xl transition-colors"
              title={currentUser ? currentUser.fullName : 'Sign In'}
            >
              <User className="w-5 h-5" />
            </button>

            {/* Admin Portal Button - Only visible when an admin account is logged in */}
            {(isAdminLoggedIn || currentUser?.role === 'admin') && (
              <button
                onClick={onOpenAdmin}
                className="p-2 text-indigo-400 hover:text-indigo-300 bg-indigo-950/40 hover:bg-indigo-900/40 border border-indigo-800/50 rounded-xl transition-colors"
                title="Admin & ERP Portal"
              >
                <Shield className="w-5 h-5" />
              </button>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-slate-400 hover:text-white rounded-xl"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-800 py-3 space-y-3">
            <div className="px-1">
              <GoogleSearchBar
                variant="navbar"
                products={products}
                searchQuery={searchQuery}
                onSearch={(q) => {
                  setSearchQuery(q);
                  setCurrentTab('shop');
                  setMobileMenuOpen(false);
                }}
                onSelectCategory={(cat) => {
                  onSelectCategory(cat);
                  setCurrentTab('shop');
                  setMobileMenuOpen(false);
                }}
                onViewProduct={(prod) => {
                  onViewDetails(prod);
                  setMobileMenuOpen(false);
                }}
                onAddToCart={(prod) => onAddToCart(prod)}
                onNavigateTab={(tab) => {
                  setCurrentTab(tab);
                  setMobileMenuOpen(false);
                }}
                placeholder="Search components by name or brand..."
              />
            </div>
            <button
              onClick={() => {
                setCurrentTab('home');
                setMobileMenuOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-900 rounded-lg"
            >
              Home
            </button>
            <button
              onClick={() => {
                setCurrentTab('shop');
                setMobileMenuOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-900 rounded-lg"
            >
              Shop Catalog
            </button>
            <button
              onClick={() => {
                setCurrentTab('builder');
                setMobileMenuOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-900 rounded-lg"
            >
              PC Builder
            </button>
            {onOpenTracking && (
              <button
                onClick={() => {
                  onOpenTracking();
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm text-amber-400 hover:bg-slate-900 rounded-lg flex items-center gap-2 font-medium"
              >
                <Truck className="w-4 h-4" />
                <span>Track Order (Pakistan Couriers)</span>
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
