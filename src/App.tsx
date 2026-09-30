import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Navbar } from './components/Navbar';
import { HomePage } from './components/HomePage';
import { ShopCatalog } from './components/ShopCatalog';
import { PCBuilder } from './components/PCBuilder';
import { AIAssistantModal } from './components/AIAssistantModal';
import { ProductDetailModal } from './components/ProductDetailModal';
import { CartDrawer } from './components/CartDrawer';
import { CheckoutModal } from './components/CheckoutModal';
import { QuotationPrintModal } from './components/QuotationPrintModal';
import { UserAccountModal } from './components/UserAccountModal';
import { WishlistDrawer } from './components/WishlistDrawer';
import { TrackOrderModal } from './components/TrackOrderModal';
import { AdminPanel } from './components/AdminPanel';
import { ProductComparisonBar } from './components/ProductComparisonBar';
import { ProductComparisonModal } from './components/ProductComparisonModal';
import { WhatsAppFloatingButton } from './components/WhatsAppFloatingButton';
import { GeminiLiveFloatingButton } from './components/GeminiLiveFloatingButton';
import { GeminiLiveModal } from './components/GeminiLiveModal';
import { Footer } from './components/Footer';
import { Product, PCBuildParts, CartItem, UserAccount, StoreSettings, Order, NavigationTab, ProductCategory } from './types';
import { formatPkr } from './utils/formatters';
import { mapPrebuiltToBuilderParts } from './utils/prebuiltMapper';
import { fetchWithBackoff, clearCachedApiResponse } from './utils/apiClient';
import { INITIAL_PRODUCTS } from './data/initialProducts';

const DEFAULT_SETTINGS: StoreSettings = {
  storeName: 'ApexRig PC & Hardware Store',
  tagline: 'Pakistan\'s Premier Custom PC Builder & Hardware Hub',
  ownerName: 'Hammad Ur Rehman',
  ownerTitle: 'Store Owner & Lead Hardware Architect',
  adminUsername: 'hammadurrehman',
  whatsappNumber: '+447597030688',
  phone: '+447597030688',
  email: 'bhaiisheeda@gmail.com',
  address: 'Shop #G-14, Ground Floor, Hafeez Centre, Main Boulevard Gulberg III, Lahore, Pakistan',
  bankDetails: {
    bankName: 'Meezan Bank Ltd / Bank Alfalah / Raast',
    accountTitle: 'Apex Hardware PK',
    accountNumber: 'PK64MEZN0001020304050607',
  },
};


export const App: React.FC = () => {
  // Navigation & View states
  const [currentTab, setCurrentTab] = useState<NavigationTab>('home');
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'All'>('All');
  const [darkMode, setDarkMode] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Store data with live server state
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(INITIAL_PRODUCTS.length === 0);

  // Custom PC Builder State
  const [build, setBuild] = useState<PCBuildParts>({});
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});

  // Cart State
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('apex_cart');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });

  // User & Admin Auth State
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    try {
      const saved = localStorage.getItem('apex_user');
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('apex_user') || localStorage.getItem('apex_admin_user');
      if (saved) {
        const u = JSON.parse(saved);
        return u?.role === 'admin';
      }
    } catch {}
    return false;
  });

  useEffect(() => {
    const token = localStorage.getItem('apex_token');
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['x-apex-token'] = token;
    }
    fetch('/api/auth/me', { credentials: 'include', headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) {
          setCurrentUser(data.user);
          if (data.user.role === 'admin') setIsAdminLoggedIn(true);
        } else if (!localStorage.getItem('apex_user') && !localStorage.getItem('apex_admin_user')) {
          setCurrentUser(null);
          setIsAdminLoggedIn(false);
        }
      })
      .catch(() => {});
    const logout = () => {
      setCurrentUser(null);
      setIsAdminLoggedIn(false);
    };
    window.addEventListener('apex:logout', logout);
    return () => window.removeEventListener('apex:logout', logout);
  }, []);

  // Wishlist State (List of Product IDs)
  const [wishlist, setWishlist] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('apex_wishlist');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });

  // Product Comparison State (Up to 3 products)
  const [comparedProducts, setComparedProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('apex_compared');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });

  // Modal States
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [isGeminiLiveOpen, setIsGeminiLiveOpen] = useState(false);
  const [aiInitialVoice, setAiInitialVoice] = useState(false);
  const [isUserOpen, setIsUserOpen] = useState(false);

  const handleOpenAI = (voiceMode: boolean = false) => {
    setAiInitialVoice(voiceMode);
    setIsAIOpen(true);
  };
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [isTrackOrderOpen, setIsTrackOrderOpen] = useState(false);
  const [trackingInitialData, setTrackingInitialData] = useState<{ trackingNumber?: string; courierCode?: string }>({});

  const handleOpenTracking = (trackingNumber?: string, courierCode?: string) => {
    setTrackingInitialData({ trackingNumber: trackingNumber || '', courierCode: courierCode || 'auto' });
    setIsTrackOrderOpen(true);
  };

  // Apply Dark Mode class to root HTML
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Persist Cart
  useEffect(() => {
    localStorage.setItem('apex_cart', JSON.stringify(cart));
  }, [cart]);

  // Persist Wishlist
  useEffect(() => {
    localStorage.setItem('apex_wishlist', JSON.stringify(wishlist));
  }, [wishlist]);

  // Persist Compared Products
  useEffect(() => {
    localStorage.setItem('apex_compared', JSON.stringify(comparedProducts));
  }, [comparedProducts]);

  // Persist User & synchronize admin access
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('apex_user', JSON.stringify(currentUser));
      if (currentUser.role === 'admin') {
        setIsAdminLoggedIn(true);
      }
    } else {
      localStorage.removeItem('apex_user');
      setIsAdminLoggedIn(false);
    }
  }, [currentUser]);

  // Fetch initial products and store settings
  useEffect(() => {
    try {
      localStorage.removeItem('apex_persisted_products');
      clearCachedApiResponse('/api/products');
    } catch {}
    fetchProducts(true);
    fetchSettings();

    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('gemini_live') === 'true' || params.get('screenshare') === 'true' || params.get('live') === 'true') {
        setIsGeminiLiveOpen(true);
      }
      const trackParam = params.get('track') || params.get('tracking') || params.get('trackNo');
      const courierParam = params.get('courier') || params.get('courierCode');
      if (trackParam) {
        setTrackingInitialData({ trackingNumber: trackParam, courierCode: courierParam || 'auto' });
        setIsTrackOrderOpen(true);
      }
    } catch {}
  }, []);

  // Real-time synchronization listeners across tabs, window focus & background polling
  useEffect(() => {
    const handleProductsUpdated = (e: CustomEvent<{ product?: Product }>) => {
      clearCachedApiResponse('/api/products');
      if (e.detail?.product) {
        const updated = e.detail.product;
        setProducts((prev) => {
          const exists = prev.some((p) => p.id === updated.id);
          return exists ? prev.map((p) => (p.id === updated.id ? updated : p)) : [updated, ...prev];
        });
      }
      fetchProducts(true);
    };

    const handleInventorySync = () => {
      clearCachedApiResponse('/api/products');
      fetchProducts(true);
    };

    const handleFocusSync = () => {
      fetchProducts(true);
    };

    window.addEventListener('apex:products_updated', handleProductsUpdated as EventListener);
    window.addEventListener('apex:inventory_updated', handleInventorySync);
    window.addEventListener('focus', handleFocusSync);
    document.addEventListener('visibilitychange', handleFocusSync);

    // Live background polling so catalog & inventory changes reflect automatically without overwhelming the browser
    const pollInterval = setInterval(() => {
      fetchProducts(false);
    }, 25000);

    return () => {
      window.removeEventListener('apex:products_updated', handleProductsUpdated as EventListener);
      window.removeEventListener('apex:inventory_updated', handleInventorySync);
      window.removeEventListener('focus', handleFocusSync);
      document.removeEventListener('visibilitychange', handleFocusSync);
      clearInterval(pollInterval);
    };
  }, []);

  const fetchProducts = async (forceRefresh = false) => {
    if (!products.length) setIsLoadingProducts(true);
    try {
      if (forceRefresh) clearCachedApiResponse('/api/products');
      const data = await fetchWithBackoff<Product[]>(forceRefresh ? `/api/products?_t=${Date.now()}` : '/api/products', {
        maxRetries: 2,
        initialDelayMs: 250,
        maxDelayMs: 1500,
        useCache: !forceRefresh,
      });

      if (Array.isArray(data)) {
        setProducts(data);
      }
    } catch {
      // Retain in-memory state on transient network disconnect
    } finally {
      setIsLoadingProducts(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const data = await fetchWithBackoff<StoreSettings>('/api/settings', {
        maxRetries: 4,
        initialDelayMs: 400,
        maxDelayMs: 3000,
        useCache: true,
        cacheTtlMs: 120000,
      });
      if (data && typeof data === 'object') {
        setStoreSettings(data);
      }
    } catch {
      // Retains DEFAULT_SETTINGS safely
    }
  };

  const handleUpdateSettings = async (newSettings: StoreSettings) => {
    setStoreSettings(newSettings);
    clearCachedApiResponse('/api/settings');
    try {
      await fetchWithBackoff('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
        maxRetries: 2,
      });
    } catch (e) {
      console.warn('Could not persist settings to server, saved locally in state:', e);
    }
  };

  // Cart operations
  const handleAddToCart = (product: Product, variantId?: string) => {
    const activeVariant = product.variants?.find((v) => v.id === variantId) || product.variants?.[0];
    const itemPrice = activeVariant ? activeVariant.price : product.price;
    const itemImage = activeVariant?.image || product.image;
    const cartItemId = variantId ? `${product.id}-${variantId}` : product.id;

    setCart((prev) => {
      const existing = prev.find((item) => item.id === cartItemId);
      if (existing) {
        return prev.map((item) =>
          item.id === cartItemId ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          id: cartItemId,
          productId: product.id,
          name: product.name,
          price: itemPrice,
          quantity: 1,
          image: itemImage,
          variantId,
          variantColor: activeVariant?.color || activeVariant?.name,
          category: product.category,
        },
      ];
    });
  };

  // Add build components directly to cart as individual items
  const handleAddBuildToCart = (_customRig?: boolean) => {
    const partsArray = Object.entries(build as Record<string, Product | undefined | null>).filter(
      (entry): entry is [string, Product] => Boolean(entry[1])
    );
    if (partsArray.length === 0) return;

    const newItems: CartItem[] = partsArray.map(([cat, prod], idx) => {
      const variantId = selectedVariants[prod.id];
      const variant = prod.variants?.find((v) => v.id === variantId);
      const price = variant?.price || prod.price;
      return {
        id: `${prod.id}-${variantId || 'std'}-${Date.now()}-${idx}`,
        productId: prod.id,
        name: prod.name,
        price,
        quantity: 1,
        image: prod.image,
        category: cat as ProductCategory,
        variantId: variant?.id,
        variantColor: variant?.color || variant?.name || 'Standard',
      };
    });

    setCart((prev) => [...prev, ...newItems]);
    setIsCartOpen(true);
  };

  // Add all AI recommended parts directly to cart as individual components
  const handleAddAIBuildDirectlyToCart = (suggestion: any) => {
    if (!suggestion?.recommendedCategoryParts) return;
    const newItems: CartItem[] = [];
    suggestion.recommendedCategoryParts.forEach((rec: any, idx: number) => {
      const prod = products.find((p) => p.id === rec.productId);
      if (prod) {
        const variantId = rec.variantId || (prod.variants && prod.variants[0]?.id);
        const variant = prod.variants?.find((v) => v.id === variantId);
        const price = rec.price || variant?.price || prod.price;
        newItems.push({
          id: `${prod.id}-${variantId || 'std'}-${Date.now()}-${idx}`,
          productId: prod.id,
          name: prod.name,
          price,
          quantity: 1,
          image: prod.image,
          category: (rec.category || prod.category) as ProductCategory,
          variantId: variant?.id,
          variantColor: variant?.color || variant?.name || 'Standard',
        });
      }
    });

    if (newItems.length > 0) {
      setCart((prev) => [...prev, ...newItems]);
      setIsCartOpen(true);
    }
  };

  const handleUpdateCartQuantity = (id: string, qty: number) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((item) => item.id !== id));
    } else {
      setCart((prev) => prev.map((item) => (item.id === id ? { ...item, quantity: qty } : item)));
    }
  };

  const handleRemoveCartItem = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearCart = () => {
    setCart([]);
  };

  // Wishlist operations
  const handleToggleWishlist = (product: Product) => {
    setWishlist((prev) => {
      const exists = prev.includes(product.id);
      const next = exists ? prev.filter((id) => id !== product.id) : [...prev, product.id];
      return next;
    });

    // Sync to backend store asynchronously
    fetch('/api/wishlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: product.id,
        userId: currentUser?.id,
        email: currentUser?.email,
      }),
    }).catch((e) => console.warn('Could not sync wishlist to backend:', e));
  };

  const handleRemoveFromWishlist = (productId: string) => {
    setWishlist((prev) => prev.filter((id) => id !== productId));
    fetch(`/api/wishlist/${productId}`, {
      method: 'DELETE',
    }).catch((e) => console.warn('Could not delete wishlist item from backend:', e));
  };

  // Product Comparison operations (up to 3 products)
  const handleToggleCompare = (product: Product) => {
    setComparedProducts((prev) => {
      const exists = prev.some((p) => p.id === product.id);
      if (exists) {
        return prev.filter((p) => p.id !== product.id);
      }
      if (prev.length >= 3) {
        // Can compare max 3 products side-by-side
        alert('You can compare up to 3 components side-by-side. Please remove one first.');
        return prev;
      }
      return [...prev, product];
    });
  };

  const handleAddCompareProduct = (product: Product) => {
    setComparedProducts((prev) => {
      if (prev.some((p) => p.id === product.id)) return prev;
      if (prev.length >= 3) {
        return [...prev.slice(1), product];
      }
      return [...prev, product];
    });
  };

  const handleRemoveCompareProduct = (productId: string) => {
    setComparedProducts((prev) => prev.filter((p) => p.id !== productId));
  };

  const handleClearCompare = () => {
    setComparedProducts([]);
  };

  const wishlistProducts = products.filter((p) => wishlist.includes(p.id));

  // Load component or full Pre-Built into PC Builder
  const handleSelectForBuilder = (product: Product) => {
    if (product.category === 'Pre-Built PC') {
      const { build: mappedBuild, variants: mappedVariants } = mapPrebuiltToBuilderParts(product, products);
      setBuild(mappedBuild);
      setSelectedVariants(mappedVariants);
      setCurrentTab('builder');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setBuild((prev) => ({
      ...prev,
      [product.category]: product,
    }));
    if (product.isVariable && product.variants && product.variants.length > 0) {
      setSelectedVariants((prev) => ({
        ...prev,
        [product.id]: product.variants![0].id,
      }));
    }
    setCurrentTab('builder');
  };

  // AI Auto-Fill PC Builder
  const handleApplyAIBuild = (newBuild: PCBuildParts, newVariants: Record<string, string>) => {
    setBuild(newBuild);
    setSelectedVariants(newVariants);
    setCurrentTab('builder');
  };

  // WhatsApp Share Build
  const handleShareWhatsApp = () => {
    const activeParts = Object.entries(build as Record<string, Product | undefined | null>).filter(
      (entry): entry is [string, Product] => Boolean(entry[1])
    );

    const partsLines = activeParts
      .map(([cat, prod]) => {
        const variantId = selectedVariants[prod.id];
        const variant = prod.variants?.find((v) => v.id === variantId);
        const price = variant?.price || prod.price;
        return `• *${cat}:* ${prod.name} (${formatPkr(price)})`;
      })
      .join('\n');

    const total = activeParts.reduce((acc, [_, prod]) => {
      const variantId = selectedVariants[prod.id];
      const variant = prod.variants?.find((v) => v.id === variantId);
      return acc + (variant?.price || prod.price);
    }, 0);

    const message = `*CUSTOM PC BUILD QUOTATION - APEXRIG PC*\n\n` +
      `${partsLines}\n\n` +
      `*Total Build Price:* ${formatPkr(total)}\n\n` +
      `Please check component stock and delivery time to my city in Pakistan. Thanks!`;

    const cleanNum = storeSettings.whatsappNumber.replace(/[^0-9]/g, '');
    const url = `https://wa.me/${cleanNum}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const cartTotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-slate-950 font-sans transition-colors duration-300 dark:bg-slate-950 light:bg-slate-50 light:text-slate-900">
      {/* Navigation Bar */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        cartCount={cartCount}
        cartTotal={cartTotal}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenAI={() => handleOpenAI(false)}
        onOpenUser={() => setIsUserOpen(true)}
        onOpenWishlist={() => setIsWishlistOpen(true)}
        onOpenAdmin={() => setIsAdminOpen(true)}
        onOpenTracking={() => handleOpenTracking()}
        currentUser={currentUser}
        isAdminLoggedIn={isAdminLoggedIn}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        products={products}
        onViewDetails={(prod) => setDetailProduct(prod)}
        onAddToCart={handleAddToCart}
        onSelectCategory={(cat) => setSelectedCategory(cat)}
        wishlistCount={wishlist.length}
      />

      {/* Main Content Router with Smooth View Transitions */}
      <main className="min-h-[calc(100vh-320px)]">
        <AnimatePresence mode="wait">
          {currentTab === 'home' && (
            <motion.div
              key="tab-home"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              <HomePage
                products={products}
                onAddToCart={handleAddToCart}
                onViewDetails={(prod) => setDetailProduct(prod)}
                onSelectForBuilder={handleSelectForBuilder}
                onApplyFullBuild={(newBuild, newVariants) => {
                  setBuild(newBuild);
                  setSelectedVariants(newVariants);
                  setCurrentTab('builder');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                onNavigateTab={(tab) => setCurrentTab(tab)}
                onSelectCategory={(cat) => setSelectedCategory(cat)}
                onOpenAI={() => setIsAIOpen(true)}
                wishlistProductIds={wishlist}
                onToggleWishlist={handleToggleWishlist}
                comparedProducts={comparedProducts}
                onToggleCompare={handleToggleCompare}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
              />
            </motion.div>
          )}

          {currentTab === 'shop' && (
            <motion.div
              key="tab-shop"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              <ShopCatalog
                products={products}
                onAddToCart={handleAddToCart}
                onViewDetails={(prod) => setDetailProduct(prod)}
                onSelectForBuilder={handleSelectForBuilder}
                onOpenBuilder={() => setCurrentTab('builder')}
                onOpenAI={() => handleOpenAI(false)}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                selectedCategory={selectedCategory}
                onSelectCategory={(cat) => setSelectedCategory(cat)}
                wishlistProductIds={wishlist}
                onToggleWishlist={handleToggleWishlist}
                comparedProducts={comparedProducts}
                onToggleCompare={handleToggleCompare}
              />
            </motion.div>
          )}

          {currentTab === 'builder' && (
            <motion.div
              key="tab-builder"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              <PCBuilder
                products={products}
                build={build}
                setBuild={setBuild}
                selectedVariants={selectedVariants}
                setSelectedVariants={setSelectedVariants}
                onAddToCart={handleAddBuildToCart}
                onOpenAI={() => handleOpenAI(false)}
                onOpenVoiceAI={() => setIsGeminiLiveOpen(true)}
                onPrintQuotation={() => setIsPrintOpen(true)}
                onShareWhatsApp={handleShareWhatsApp}
                storeWhatsAppNumber={storeSettings.whatsappNumber}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <Footer
        onOpenBuilder={() => setCurrentTab('builder')}
        onOpenAI={() => handleOpenAI(false)}
        onOpenAdmin={() => setIsAdminOpen(true)}
        onOpenTracking={() => handleOpenTracking()}
        storeSettings={storeSettings}
      />

      {/* Floating Comparison Dock Bar */}
      <ProductComparisonBar
        comparedProducts={comparedProducts}
        onOpenComparisonModal={() => setIsComparisonOpen(true)}
        onRemoveProduct={handleRemoveCompareProduct}
        onClearAll={handleClearCompare}
      />

      {/* Floating Gemini Live AI Interaction Button (Above WhatsApp Button) */}
      <GeminiLiveFloatingButton onOpenLive={() => setIsGeminiLiveOpen(true)} />

      {/* Floating WhatsApp Action Button */}
      <WhatsAppFloatingButton storeSettings={storeSettings} />

      {/* Modals & Drawers */}
      <GeminiLiveModal
        isOpen={isGeminiLiveOpen}
        onClose={() => setIsGeminiLiveOpen(false)}
        products={products}
        build={build}
        setBuild={setBuild}
        selectedVariants={selectedVariants}
        setSelectedVariants={setSelectedVariants}
        onAddToCart={handleAddToCart}
        onAddBuildToCart={() => handleAddBuildToCart(true)}
        onOpenQuotation={() => setIsPrintOpen(true)}
        onOpenCart={() => setIsCartOpen(true)}
        storeSettings={storeSettings}
      />

      <ProductComparisonModal
        isOpen={isComparisonOpen}
        onClose={() => setIsComparisonOpen(false)}
        comparedProducts={comparedProducts}
        allProducts={products}
        onRemoveProduct={handleRemoveCompareProduct}
        onAddProduct={handleAddCompareProduct}
        onClearAll={handleClearCompare}
        onAddToCart={handleAddToCart}
        onSelectForBuilder={handleSelectForBuilder}
        onViewDetails={(prod) => setDetailProduct(prod)}
      />

      <AIAssistantModal
        isOpen={isAIOpen}
        onClose={() => {
          setIsAIOpen(false);
          setAiInitialVoice(false);
        }}
        products={products}
        currentBuild={build}
        onApplyBuildToBuilder={handleApplyAIBuild}
        onNavigateToBuilder={() => setCurrentTab('builder')}
        onAddBuildToCart={handleAddAIBuildDirectlyToCart}
        initialVoiceMode={aiInitialVoice}
      />

      <ProductDetailModal
        product={detailProduct}
        onClose={() => setDetailProduct(null)}
        onAddToCart={handleAddToCart}
        onSelectForBuilder={handleSelectForBuilder}
        isWishlisted={detailProduct ? wishlist.includes(detailProduct.id) : false}
        onToggleWishlist={handleToggleWishlist}
        isCompared={detailProduct ? comparedProducts.some((p) => p.id === detailProduct.id) : false}
        onToggleCompare={handleToggleCompare}
        currentUserEmail={currentUser?.email}
      />

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cart}
        onUpdateQuantity={handleUpdateCartQuantity}
        onRemoveItem={handleRemoveCartItem}
        onClearCart={handleClearCart}
        onOpenCheckout={() => {
          setIsCartOpen(false);
          setIsCheckoutOpen(true);
        }}
      />

      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        items={cart}
        currentUser={currentUser}
        storeSettings={storeSettings}
        onOrderSuccess={(order: Order) => {
          setCart([]);
        }}
        onOpenTracking={handleOpenTracking}
      />

      <QuotationPrintModal
        isOpen={isPrintOpen}
        onClose={() => setIsPrintOpen(false)}
        build={build}
        selectedVariants={selectedVariants}
        storeSettings={storeSettings}
      />

      <WishlistDrawer
        isOpen={isWishlistOpen}
        onClose={() => setIsWishlistOpen(false)}
        wishlistProducts={wishlistProducts}
        onRemoveFromWishlist={handleRemoveFromWishlist}
        onAddToCart={handleAddToCart}
        onViewProductDetails={(prod) => setDetailProduct(prod)}
        onSelectForBuilder={handleSelectForBuilder}
      />

      <UserAccountModal
        isOpen={isUserOpen}
        onClose={() => setIsUserOpen(false)}
        currentUser={currentUser}
        setCurrentUser={(user) => {
          setCurrentUser(user);
          if (user?.role === 'admin') {
            setIsAdminLoggedIn(true);
          } else if (!user) {
            setIsAdminLoggedIn(false);
          }
        }}
        onOpenAdmin={() => {
          setIsUserOpen(false);
          setIsAdminOpen(true);
        }}
        onOpenTracking={handleOpenTracking}
      />

      <TrackOrderModal
        isOpen={isTrackOrderOpen}
        onClose={() => setIsTrackOrderOpen(false)}
        initialTrackingNumber={trackingInitialData.trackingNumber}
        initialCourierCode={trackingInitialData.courierCode}
      />

      {isAdminOpen && (
        <AdminPanel
          isOpen={isAdminOpen}
          onClose={() => setIsAdminOpen(false)}
          products={products}
          onRefreshProducts={fetchProducts}
          isAdminLoggedIn={isAdminLoggedIn}
          setIsAdminLoggedIn={setIsAdminLoggedIn}
          storeSettings={storeSettings}
          onUpdateSettings={handleUpdateSettings}
        />
      )}
    </div>
  );
};
export default App;
