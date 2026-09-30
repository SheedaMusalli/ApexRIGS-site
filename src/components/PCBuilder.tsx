import React, { useState, useMemo } from 'react';
import {
  Cpu,
  Layers,
  HardDrive,
  Tv,
  Zap,
  Box,
  Fan,
  Sparkles,
  Printer,
  Share2,
  ShoppingCart,
  Trash2,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Mic,
  Search,
  X,
  Wrench,
  Check,
  Gauge,
} from 'lucide-react';
import { Product, ProductCategory, PCBuildParts } from '../types';
import { formatPkr } from '../utils/formatters';
import { optimizeBuildForBudget } from '../utils/budgetOptimizer';
import { BottleneckCalculatorModal } from './BottleneckCalculatorModal';

interface PCBuilderProps {
  products: Product[];
  build: PCBuildParts;
  setBuild: React.Dispatch<React.SetStateAction<PCBuildParts>>;
  selectedVariants: Record<string, string>;
  setSelectedVariants: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onAddToCart: (customRig: boolean) => void;
  onOpenAI: () => void;
  onOpenVoiceAI: () => void;
  onPrintQuotation: () => void;
  onShareWhatsApp: () => void;
  storeWhatsAppNumber?: string;
}

interface BuildSlotDef {
  key: keyof PCBuildParts;
  title: string;
  category: ProductCategory;
  icon: any;
  required?: boolean;
}

const BUILD_SLOTS: BuildSlotDef[] = [
  { key: 'Processor', title: 'Processor (CPU)', category: 'Processor', icon: Cpu, required: true },
  { key: 'Motherboard', title: 'Motherboard', category: 'Motherboard', icon: Layers, required: true },
  { key: 'CPU Cooler', title: 'CPU Cooler', category: 'CPU Cooler', icon: Fan },
  { key: 'RAM', title: 'Memory (RAM)', category: 'RAM', icon: Layers, required: true },
  { key: 'Graphic Card', title: 'Graphic Card (GPU)', category: 'Graphic Card', icon: Tv },
  { key: 'Storage', title: 'Storage (SSD/HDD)', category: 'Storage', icon: HardDrive, required: true },
  { key: 'Power Supply', title: 'Power Supply (PSU)', category: 'Power Supply', icon: Zap, required: true },
  { key: 'Casing', title: 'Casing / Chassis', category: 'Casing', icon: Box, required: true },
  { key: 'Casing Fans', title: 'Casing Fans', category: 'Casing Fans', icon: Fan },
  { key: 'Monitor', title: 'Gaming Monitor', category: 'Monitor', icon: Tv },
  { key: 'Gaming Keyboard', title: 'Keyboard', category: 'Gaming Keyboard', icon: Layers },
  { key: 'Gaming Mouse', title: 'Mouse', category: 'Gaming Mouse', icon: Layers },
];

export const PCBuilder: React.FC<PCBuilderProps> = ({
  products,
  build,
  setBuild,
  selectedVariants,
  setSelectedVariants,
  onAddToCart,
  onOpenAI,
  onOpenVoiceAI,
  onPrintQuotation,
  onShareWhatsApp,
}) => {
  const [activeSlot, setActiveSlot] = useState<BuildSlotDef | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [budgetInput, setBudgetInput] = useState('');
  const [isBottleneckModalOpen, setIsBottleneckModalOpen] = useState(false);

  // Active parts array
  const activeParts = useMemo(() => {
    return Object.entries(build as Record<string, Product | undefined | null>).filter(
      (entry): entry is [string, Product] => Boolean(entry[1])
    );
  }, [build]);

  // Total build calculation
  const totalBuildPrice = useMemo(() => {
    return activeParts.reduce((acc, [_, prod]) => {
      const variantId = selectedVariants[prod.id];
      const variant = prod.variants?.find((v) => v.id === variantId);
      return acc + (variant?.price || prod.price);
    }, 0);
  }, [activeParts, selectedVariants]);

  // Wattage estimation
  const estimatedWattage = useMemo(() => {
    let wattage = 100; // Base motherboard/fans/storage draw
    const cpuTdp = build.Processor?.specifications?.tdpWatts || (build.Processor?.name.includes('i9') ? 250 : 125);
    const gpuTdp = build['Graphic Card']?.specifications?.tdpWatts || (build['Graphic Card']?.name.includes('5090') ? 450 : build['Graphic Card']?.name.includes('4070') ? 220 : 180);
    if (build.Processor) wattage += cpuTdp;
    if (build['Graphic Card']) wattage += gpuTdp;
    return wattage;
  }, [build]);

  const psuWattage = build['Power Supply']?.specifications?.psuWattage || 0;
  const isPsuAdequate = !psuWattage || psuWattage >= estimatedWattage + 100;

  // Socket compatibility check
  const cpuSocket = build.Processor?.specifications?.socket || build.Processor?.specs?.socket;
  const moboSocket = build.Motherboard?.specifications?.socket || build.Motherboard?.specs?.socket;
  const isSocketCompatible = !cpuSocket || !moboSocket || cpuSocket === moboSocket;

  // RAM compatibility check
  const moboRam = build.Motherboard?.specifications?.ramType || build.Motherboard?.specs?.ramType;
  const ramType = build.RAM?.specifications?.ramType || build.RAM?.specs?.ramType;
  const isRamCompatible = !moboRam || !ramType || moboRam.includes(ramType) || ramType.includes(moboRam);

  const handleSelectProduct = (slot: BuildSlotDef, product: Product) => {
    setBuild((prev) => ({
      ...prev,
      [slot.key]: product,
    }));

    if (product.variants && product.variants.length > 0) {
      setSelectedVariants((prev) => ({
        ...prev,
        [product.id]: product.variants![0].id,
      }));
    }
    setActiveSlot(null);
    setPickerSearch('');
  };

  const handleRemoveProduct = (slotKey: keyof PCBuildParts) => {
    setBuild((prev) => {
      const next = { ...prev };
      delete next[slotKey];
      return next;
    });
  };

  const handleClearAll = () => {
    setBuild({});
    setSelectedVariants({});
  };

  const handleQuickBudgetOptimize = (e: React.FormEvent) => {
    e.preventDefault();
    const budgetNum = parseInt(budgetInput.replace(/[^0-9]/g, ''), 10);
    if (!budgetNum || budgetNum < 50000) {
      alert('Please enter a realistic budget in PKR (e.g. 150000).');
      return;
    }

    const suggestion = optimizeBuildForBudget(products, {
      targetBudget: budgetNum,
    });

    const newBuild: PCBuildParts = {};
    suggestion.recommendedCategoryParts.forEach((rec) => {
      const matched = products.find((p) => p.id === rec.productId);
      if (matched) {
        newBuild[matched.category] = matched;
      }
    });

    setBuild(newBuild);
    setBudgetInput('');
  };

  // Products available for active slot
  const slotProducts = useMemo(() => {
    if (!activeSlot) return [];
    return products.filter((p) => {
      const matchCat =
        p.category === activeSlot.category ||
        (activeSlot.category === 'Casing Fans' && p.category === 'PC Case Fans') ||
        (activeSlot.category === 'PC Case Fans' && p.category === 'Casing Fans');
      const matchSearch =
        pickerSearch === '' ||
        p.name.toLowerCase().includes(pickerSearch.toLowerCase()) ||
        p.brand.toLowerCase().includes(pickerSearch.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [products, activeSlot, pickerSearch]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Real-time Compatibility Engine
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Custom Gaming PC Builder
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Select parts, verify socket & wattage compatibility, and export official quotations.
          </p>
        </div>

        {/* Quick AI & Voice Assistant Callouts */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsBottleneckModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500/20 via-rose-500/20 to-indigo-500/20 hover:from-amber-500/30 hover:to-indigo-500/30 border border-amber-500/40 text-amber-300 font-semibold text-xs transition-all hover:scale-105 shadow-md shadow-amber-500/10"
          >
            <Gauge className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>Calculate Bottleneck</span>
          </button>
          <button
            onClick={onOpenVoiceAI}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 font-semibold text-xs transition-all hover:scale-105"
          >
            <Mic className="w-4 h-4 text-purple-400 animate-pulse" />
            <span>Voice Hardware AI</span>
          </button>
          <button
            onClick={onOpenAI}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/25 transition-all hover:scale-105"
          >
            <Sparkles className="w-4 h-4" />
            <span>AI Rig Advisor</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Slots on Left, Summary on Right */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Build Slots (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Compatibility Alerts */}
          {(!isSocketCompatible || !isRamCompatible || (!isPsuAdequate && psuWattage > 0)) && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Compatibility Warning Detected:</span>
              </div>
              {!isSocketCompatible && (
                <p>
                  • CPU Socket ({cpuSocket}) does not match Motherboard Socket ({moboSocket}).
                </p>
              )}
              {!isRamCompatible && (
                <p>
                  • RAM type ({ramType}) may be incompatible with Motherboard memory support ({moboRam}).
                </p>
              )}
              {!isPsuAdequate && psuWattage > 0 && (
                <p>
                  • Selected PSU ({psuWattage}W) is lower than recommended headroom for estimated load ({estimatedWattage}W).
                </p>
              )}
            </div>
          )}

          {/* Quick Budget Recommendation */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs">
              <span className="font-bold text-slate-200 block">Match Parts to Budget:</span>
              <span className="text-slate-400">Select components that fit within your target PKR budget.</span>
            </div>
            <form onSubmit={handleQuickBudgetOptimize} className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                placeholder="e.g. 200,000"
                className="w-36 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs whitespace-nowrap transition-colors"
              >
                Find Parts
              </button>
            </form>
          </div>

          {/* Slot Cards List */}
          <div className="space-y-3">
            {BUILD_SLOTS.map((slot) => {
              const selectedProduct = build[slot.key];
              const variantId = selectedProduct ? selectedVariants[selectedProduct.id] : undefined;
              const activeVariant = selectedProduct?.variants?.find((v) => v.id === variantId);
              const price = activeVariant ? activeVariant.price : selectedProduct?.price || 0;
              const IconComp = slot.icon;

              return (
                <div
                  key={slot.key}
                  className={`relative rounded-xl border p-4 transition-all ${
                    selectedProduct
                      ? 'bg-slate-900/80 border-slate-700/80'
                      : 'bg-slate-900/30 border-slate-800/60 border-dashed hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    {/* Slot Title & Component info */}
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                          selectedProduct
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        {selectedProduct ? (
                          <img
                            src={activeVariant?.image || selectedProduct.image}
                            alt=""
                            className="w-full h-full object-cover rounded-xl"
                          />
                        ) : (
                          <IconComp className="w-6 h-6" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            {slot.title}
                          </span>
                          {slot.required && !selectedProduct && (
                            <span className="text-[10px] text-amber-400 font-medium">Required</span>
                          )}
                        </div>

                        {selectedProduct ? (
                          <div>
                            <h4 className="text-sm font-bold text-white truncate mt-0.5">
                              {selectedProduct.name}
                            </h4>
                            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
                              <span className="text-emerald-400 font-bold">{formatPkr(price)}</span>
                              {selectedProduct.brand && (
                                <span className="text-slate-400">• {selectedProduct.brand}</span>
                              )}
                              {selectedProduct.specifications?.socket && (
                                <span className="text-slate-500">• {selectedProduct.specifications.socket}</span>
                              )}
                            </div>

                            {/* Variant switcher */}
                            {selectedProduct.variants && selectedProduct.variants.length > 1 && (
                              <div className="flex items-center gap-1.5 mt-2">
                                <span className="text-[11px] text-slate-400">Option:</span>
                                {selectedProduct.variants.map((v) => (
                                  <button
                                    key={v.id}
                                    onClick={() =>
                                      setSelectedVariants((prev) => ({
                                        ...prev,
                                        [selectedProduct.id]: v.id,
                                      }))
                                    }
                                    className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                                      (activeVariant?.id || selectedProduct.variants![0].id) === v.id
                                        ? 'bg-indigo-600 border-indigo-500 text-white'
                                        : 'bg-slate-800 border-slate-700 text-slate-400'
                                    }`}
                                  >
                                    {v.name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 mt-0.5">
                            No component selected for this slot.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      {selectedProduct ? (
                        <>
                          <button
                            onClick={() => setActiveSlot(slot)}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors"
                          >
                            Change
                          </button>
                          <button
                            onClick={() => handleRemoveProduct(slot.key)}
                            className="p-2 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                            title="Remove component"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setActiveSlot(slot)}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-md shadow-indigo-600/20 transition-all"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Select {slot.key}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Build Summary & Actions */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sticky top-24 space-y-6 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Wrench className="w-4 h-4 text-emerald-400" />
                Rig Summary
              </h3>
              {activeParts.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-xs text-slate-400 hover:text-red-400 transition-colors"
                >
                  Clear Rig
                </button>
              )}
            </div>

            {/* Power Estimate Meter */}
            <div className="bg-slate-800/50 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" /> Estimated Load
                </span>
                <span className="font-bold text-white">{estimatedWattage} Watts</span>
              </div>
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    estimatedWattage > 600 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, (estimatedWattage / 850) * 100)}%` }}
                ></div>
              </div>
              <p className="text-[11px] text-slate-400">
                Recommended PSU:{' '}
                <span className="font-semibold text-slate-200">
                  {Math.ceil((estimatedWattage + 150) / 50) * 50}W or higher
                </span>
              </p>
            </div>

            {/* Price Breakdown */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Selected Parts</span>
                <span className="font-semibold text-white">{activeParts.length} Components</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Assembly & Cable Tuning</span>
                <span className="text-emerald-400 font-semibold">FREE (Complimentary)</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>24-Hour Thermal Stress Test</span>
                <span className="text-emerald-400 font-semibold">FREE</span>
              </div>
              <div className="pt-3 border-t border-slate-800 flex justify-between items-baseline">
                <span className="text-sm font-bold text-white">Estimated Rig Total:</span>
                <span className="text-xl font-black text-emerald-400">
                  {formatPkr(totalBuildPrice)}
                </span>
              </div>
            </div>

            {/* Primary Action Buttons */}
            <div className="space-y-2.5 pt-2">
              <button
                disabled={activeParts.length === 0}
                onClick={() => onAddToCart(true)}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm shadow-xl shadow-emerald-600/30 transition-all hover:scale-[1.01]"
              >
                <ShoppingCart className="w-4 h-4" />
                Add Complete Rig to Cart
              </button>

              <button
                onClick={() => setIsBottleneckModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 font-bold text-xs border border-amber-500/30 transition-all active:scale-98"
              >
                <Gauge className="w-4 h-4 text-amber-400" />
                Calculate Bottleneck
              </button>

              <button
                disabled={activeParts.length === 0}
                onClick={onPrintQuotation}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-semibold text-xs border border-slate-700 transition-colors"
              >
                <Printer className="w-4 h-4 text-indigo-400" />
                Print / Save Official Quotation
              </button>

              <button
                disabled={activeParts.length === 0}
                onClick={onShareWhatsApp}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 disabled:opacity-50 text-emerald-400 font-semibold text-xs border border-emerald-500/30 transition-colors"
              >
                <Share2 className="w-4 h-4" />
                Share Build on WhatsApp
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottleneck Calculator Modal */}
      <BottleneckCalculatorModal
        isOpen={isBottleneckModalOpen}
        onClose={() => setIsBottleneckModalOpen(false)}
        build={build}
        products={products}
      />

      {/* Component Picker Modal */}
      {activeSlot && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
              <div>
                <h3 className="text-base font-bold text-white">Select {activeSlot.title}</h3>
                <p className="text-xs text-slate-400">
                  {slotProducts.length} verified products available in our inventory
                </p>
              </div>
              <button
                onClick={() => {
                  setActiveSlot(null);
                  setPickerSearch('');
                }}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search filter input */}
            <div className="px-6 py-3 border-b border-slate-800/80 bg-slate-950/40">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder={`Filter ${activeSlot.category} by brand, model, or socket...`}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Products List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {slotProducts.length === 0 ? (
                <div className="text-center py-16 text-slate-500 text-xs">
                  No matching products found in this category.
                </div>
              ) : (
                slotProducts.map((prod) => (
                  <div
                    key={prod.id}
                    onClick={() => handleSelectProduct(activeSlot, prod)}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 cursor-pointer transition-all group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <img
                        src={prod.image}
                        alt={prod.name}
                        className="w-14 h-14 rounded-lg object-cover bg-slate-950 shrink-0"
                      />
                      <div className="min-w-0">
                        <span className="text-[10px] font-semibold uppercase text-indigo-400">
                          {prod.brand}
                        </span>
                        <h4 className="text-xs font-bold text-white truncate group-hover:text-indigo-300 transition-colors">
                          {prod.name}
                        </h4>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                          {prod.specifications?.socket && <span>Socket: {prod.specifications.socket}</span>}
                          {prod.specifications?.tdpWatts && (
                            <span>• {prod.specifications.tdpWatts}W</span>
                          )}
                          {prod.inStock !== false ? (
                            <span className="text-emerald-400">• In Stock</span>
                          ) : (
                            <span className="text-rose-400">• Out of Stock</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 pl-4">
                      <span className="text-sm font-black text-emerald-400 block">
                        {formatPkr(prod.price)}
                      </span>
                      <span className="text-[10px] font-semibold text-indigo-400 group-hover:underline">
                        Select Component →
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
