import React, { useState, useMemo, useEffect } from 'react';
import { authFetch } from '../../utils/apiClient';
import {
  DollarSign,
  ShoppingCart,
  Boxes,
  FileBarChart,
  FileText,
  Receipt,
  Users,
  Truck,
  Plus,
  Search,
  Printer,
  Barcode,
  Package,
  CheckCircle2,
  TrendingUp,
  X,
  AlertCircle,
  Building2,
  Phone,
  Mail,
  MapPin,
  Clock,
  ArrowRight,
  Filter,
  Download,
  Eye,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Product, Order } from '../../types';
import { SalesReceivables } from '../erp/SalesReceivables';
import { PurchasesPayables } from '../erp/PurchasesPayables';
import { ProductPurchaseSalesAuditReport } from '../erp/ProductPurchaseSalesAuditReport';
import { formatPkr } from '../../utils/formatters';
import { getProductEan } from '../../utils/skuGenerator';
import { erpStorage } from '../../services/erpStorage';
import { Customer, Vendor } from '../../types/erp';
import { FastIntakeStation } from '../FastIntakeStation';
import { PurchaseDocument } from '../../types/erp';
import { PartyDetailsModal, PartyData } from '../erp/PartyDetailsModal';

export type OperationsTab = 'sale' | 'purchases' | 'inventory' | 'intake' | 'reports';
export type SaleSubTab = 'invoices' | 'receipts' | 'customers';
export type PurchasesSubTab = 'billing' | 'receipts' | 'suppliers';
export type ReportsSubTab = 'invoice_traceability' | 'billing_traceability' | 'stock_valuation';

interface OperationsHubProps {
  products: Product[];
  orders: Order[];
  onRefreshProducts: (forceRefresh?: boolean) => void | Promise<void>;
  onAddProductClick: () => void;
  defaultTab?: OperationsTab;
  defaultSubTab?: string;
}

export const OperationsHub: React.FC<OperationsHubProps> = ({
  products,
  orders,
  onRefreshProducts,
  onAddProductClick,
  defaultTab = 'sale',
  defaultSubTab,
}) => {
  // Main Operations Tabs: sale | purchases | inventory | reports
  const [activeTab, setActiveTab] = useState<OperationsTab>(defaultTab || 'sale');

  const handleFastIntakeComplete = async (payload: {
    product: Partial<Product>;
    vendorName: string;
    billNumber: string;
    quantity: number;
    unitCost: number;
    sellingPrice: number;
    generatedSerials: string[];
    variantSerials?: any[];
    warrantyMonths: number;
    autoPrint: boolean;
  }) => {
    try {
      const res = await authFetch('/api/inventory/fast-intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save fast intake to database');
      }
      const resData = await res.json().catch(() => ({}));

      // Store in ERP storage so Purchases & Payables displays the supplier bill immediately
      if (resData.bill) {
        erpStorage.savePurchaseDocument(resData.bill);
      } else {
        const fallbackBill: PurchaseDocument = {
          id: `doc-bill-${Date.now()}`,
          docNumber: payload.billNumber || `BILL-${Date.now().toString().slice(-6)}`,
          type: 'SUPPLIER_BILL',
          vendorId: `vend-${Date.now()}`,
          vendorName: payload.vendorName || 'Direct Distributor',
          vendorIsFiler: true,
          branchId: 'lahore_hafeez',
          issueDate: new Date().toISOString().split('T')[0],
          deliveryDueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
          status: 'RECEIVED',
          items: [
            {
              id: `item-${Date.now()}`,
              productId: payload.product.id || `prod-${Date.now()}`,
              productName: payload.product.name || 'Hardware Component',
              sku: payload.product.sku || 'SKU',
              orderedQty: payload.quantity,
              receivedQty: payload.quantity,
              billedQty: payload.quantity,
              unitCostPkr: payload.unitCost,
              taxRatePercent: 0,
              taxAmountPkr: 0,
              totalPkr: payload.unitCost * payload.quantity,
              warehouseId: 'lahore_hafeez',
              serialNumbers: payload.generatedSerials,
            },
          ],
          subtotalPkr: payload.unitCost * payload.quantity,
          inputGstPkr: 0,
          whtDeductionRate: 0,
          whtDeductionPkr: 0,
          freightShippingPkr: 0,
          customsAndClearancePkr: 0,
          grandTotalPkr: payload.unitCost * payload.quantity,
          paidAmountPkr: 0,
          balancePayablePkr: payload.unitCost * payload.quantity,
          notes: `Fast-intake supplier bill logged for ${payload.quantity}x ${payload.product.name}`,
          createdBy: 'Fast-Intake Station',
          createdAt: new Date().toISOString(),
        };
        erpStorage.savePurchaseDocument(fallbackBill);
      }
      if (resData.vendor) {
        erpStorage.saveVendor(resData.vendor);
        window.dispatchEvent(new CustomEvent('apex:vendors_updated', { detail: resData.vendor }));
      }
      
      // Dispatch global realtime events across window and tabs
      window.dispatchEvent(new CustomEvent('apex:products_updated', { detail: { product: resData.product } }));
      window.dispatchEvent(new CustomEvent('apex:erp_updated', { detail: { bill: resData.bill } }));
      window.dispatchEvent(new CustomEvent('apex:inventory_updated'));
      
      onRefreshProducts(true);
    } catch (err: any) {
      console.error('Failed to complete fast intake:', err);
      throw err;
    }
  };


  // Sub-tabs
  const [saleSubTab, setSaleSubTab] = useState<SaleSubTab>(
    defaultSubTab === 'customers' ? 'customers' : defaultSubTab === 'receipts' ? 'receipts' : 'invoices'
  );
  const [purchasesSubTab, setPurchasesSubTab] = useState<PurchasesSubTab>(
    defaultSubTab === 'suppliers' ? 'suppliers' : defaultSubTab === 'receipts' ? 'receipts' : 'billing'
  );
  const [reportsSubTab, setReportsSubTab] = useState<ReportsSubTab>(
    defaultSubTab === 'billing_traceability'
      ? 'billing_traceability'
      : defaultSubTab === 'stock_valuation'
      ? 'stock_valuation'
      : 'invoice_traceability'
  );

  // Inventory Search & Filters
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState('All');

  // Customer Modal in Sales
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState(false);
  const [customerForm, setCustomerForm] = useState({
    name: '',
    company: '',
    phone: '',
    email: '',
    city: '',
    address: '',
    taxNumber: '',
    creditLimit: 0,
  });

  // Supplier Modal in Purchases
  const [isNewSupplierModalOpen, setIsNewSupplierModalOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    companyName: '',
    contactPerson: '',
    phone: '',
    email: '',
    city: '',
    address: '',
    taxNumber: '',
    paymentTerms: '',
    categories: ['Processor', 'Graphic Card', 'Motherboard'],
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Synchronize when props change
  useEffect(() => {
    if (defaultTab) setActiveTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    if (defaultSubTab) {
      if (defaultTab === 'sale') {
        if (defaultSubTab === 'customers' || defaultSubTab === 'receipts' || defaultSubTab === 'invoices') {
          setSaleSubTab(defaultSubTab as SaleSubTab);
        }
      } else if (defaultTab === 'purchases') {
        if (defaultSubTab === 'suppliers' || defaultSubTab === 'receipts' || defaultSubTab === 'billing') {
          setPurchasesSubTab(defaultSubTab as PurchasesSubTab);
        }
      } else if (defaultTab === 'reports') {
        if (
          defaultSubTab === 'invoice_traceability' ||
          defaultSubTab === 'billing_traceability' ||
          defaultSubTab === 'stock_valuation'
        ) {
          setReportsSubTab(defaultSubTab as ReportsSubTab);
        }
      }
    }
  }, [defaultTab, defaultSubTab]);

  // Handle Save New Customer
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerForm.name.trim()) return;

    try {
      const newCust: Customer = {
        id: `cust-${Date.now()}`,
        code: `CUST-${Math.floor(1000 + Math.random() * 9000)}`,
        name: customerForm.name.trim(),
        companyName: customerForm.company.trim() || undefined,
        phone: customerForm.phone.trim() || '+92 300 1234567',
        email: customerForm.email.trim() || 'customer@apexforge.pk',
        city: customerForm.city.trim() || 'Lahore',
        address: customerForm.address.trim() || 'Gulberg III, Lahore',
        taxNumber: customerForm.taxNumber.trim() || undefined,
        creditLimit: Number(customerForm.creditLimit) || 100000,
        currentBalance: 0,
        createdAt: new Date().toISOString(),
      };

      erpStorage.saveCustomer(newCust);
      await authFetch('/api/erp/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCust),
      }).catch(() => {});

      setIsNewCustomerModalOpen(false);
      setCustomerForm({
        name: '',
        company: '',
        phone: '',
        email: '',
        city: '',
        address: '',
        taxNumber: '',
        creditLimit: 0,
      });
      showToast(`Customer "${newCust.name}" successfully registered with code ${newCust.code}!`);
    } catch (err) {
      showToast('Error registering customer');
    }
  };

  // Handle Save New Supplier
  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierForm.name.trim()) return;

    try {
      const newSup: Vendor = {
        id: `vend-${Date.now()}`,
        code: `VEND-${Math.floor(1000 + Math.random() * 9000)}`,
        name: supplierForm.name.trim(),
        companyName: supplierForm.companyName.trim() || supplierForm.name.trim(),
        contactPerson: supplierForm.contactPerson.trim() || supplierForm.name.trim(),
        phone: supplierForm.phone.trim(),
        email: supplierForm.email.trim(),
        city: supplierForm.city.trim(),
        address: supplierForm.address.trim(),
        taxNumber: supplierForm.taxNumber.trim() || undefined,
        paymentTerms: supplierForm.paymentTerms || '',
        currentPayable: 0,
        createdAt: new Date().toISOString(),
      };

      erpStorage.saveVendor(newSup);
      await authFetch('/api/erp/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSup),
      }).catch(() => {});

      setIsNewSupplierModalOpen(false);
      setSupplierForm({
        name: '',
        companyName: '',
        contactPerson: '',
        phone: '',
        email: '',
        city: '',
        address: '',
        taxNumber: '',
        paymentTerms: '',
        categories: ['Processor', 'Graphic Card', 'Motherboard'],
      });
      showToast(`Supplier "${newSup.name}" successfully added to authorized vendors!`);
    } catch (err) {
      showToast('Error adding supplier');
    }
  };

  // Filtered Inventory
  const filteredInventory = useMemo(() => {
    const q = inventorySearch.toLowerCase().trim();
    return products.filter((p) => {
      const matchesCategory = inventoryCategoryFilter === 'All' || p.category === inventoryCategoryFilter;
      if (!matchesCategory) return false;
      if (!q) return true;

      const ean = (p as any).ean || getProductEan(p);
      return (
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        ean.toLowerCase().includes(q)
      );
    });
  }, [products, inventorySearch, inventoryCategoryFilter]);

  // Inventory Totals
  const inventoryMetrics = useMemo(() => {
    let totalUnits = 0;
    let totalLandedCost = 0;
    let totalRetailValue = 0;

    products.forEach((p) => {
      const units = Math.max(0, p.stockCount ?? 0);
      const cost = p.costPrice || Math.round(p.price * 0.88);
      totalUnits += units;
      totalLandedCost += cost * units;
      totalRetailValue += p.price * units;
    });

    const unrealizedProfit = totalRetailValue - totalLandedCost;
    const marginPct = totalRetailValue > 0 ? Math.round((unrealizedProfit / totalRetailValue) * 100) : 0;

    return {
      totalUnits,
      totalLandedCost,
      totalRetailValue,
      unrealizedProfit,
      marginPct,
    };
  }, [products]);

  const uniqueCategories = useMemo(() => {
    return Array.from(new Set(products.map((p) => p.category))).filter(Boolean);
  }, [products]);

  return (
    <div className="space-y-6 text-slate-200">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-emerald-500/40 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* PRIMARY OPERATIONS HUB HEADER & TABS BAR */}
      <div className="bg-slate-900/90 border border-white/10 rounded-3xl p-5 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 font-black text-xs font-mono">
                OPS
              </span>
              <h2 className="text-xl font-black text-white tracking-tight">Operations Hub</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Complete management of Sales, Invoices, Purchases, Suppliers, Inventory, and Traceability Reports.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {activeTab === 'sale' && (
              <button
                onClick={() => setIsNewCustomerModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 transition-all"
              >
                <Users className="w-3.5 h-3.5" />
                <span>+ New Customer</span>
              </button>
            )}

            {activeTab === 'purchases' && (
              <button
                onClick={() => setIsNewSupplierModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-blue-600/20 transition-all"
              >
                <Truck className="w-3.5 h-3.5" />
                <span>+ Add Supplier</span>
              </button>
            )}

            {activeTab === 'inventory' && (
              <button
                onClick={onAddProductClick}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Product to Website</span>
              </button>
            )}
          </div>
        </div>

        {/* MAIN SUB TABS: Sale | Purchases | Inventory | Reports */}
        <div className="flex items-center gap-2 pt-4 overflow-x-auto custom-scrollbar">
          {/* 1. SALE TAB */}
          <button
            onClick={() => setActiveTab('sale')}
            className={`px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'sale'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20 font-black'
                : 'bg-white/5 hover:bg-white/10 text-slate-300'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Sale</span>
          </button>

          {/* 2. PURCHASES TAB */}
          <button
            onClick={() => setActiveTab('purchases')}
            className={`px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'purchases'
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20 font-black'
                : 'bg-white/5 hover:bg-white/10 text-slate-300'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Purchases</span>
          </button>

          {/* 5. FAST INTAKE TAB */}
          <button
            onClick={() => setActiveTab('intake')}
            className={`px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'intake'
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20 font-black'
                : 'bg-white/5 hover:bg-white/10 text-slate-300'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Fast Intake</span>
          </button>
          
          {/* 3. INVENTORY TAB */}
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'inventory'
                ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20 font-black'
                : 'bg-white/5 hover:bg-white/10 text-slate-300'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Inventory</span>
          </button>

          {/* 4. REPORTS TAB */}
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'reports'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 font-black'
                : 'bg-white/5 hover:bg-white/10 text-slate-300'
            }`}
          >
            <FileBarChart className="w-4 h-4" />
            <span>Reports</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. SALE SECTION (INVOICES, RECEIPTS, NEW CUSTOMER) */}
      {/* ========================================================================= */}
      {activeTab === 'sale' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Sub Tab Switcher for Sales */}
          <div className="flex items-center justify-between gap-3 bg-slate-900/60 p-2 rounded-2xl border border-white/5">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setSaleSubTab('invoices')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  saleSubTab === 'invoices'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Invoices</span>
              </button>

              <button
                onClick={() => setSaleSubTab('receipts')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  saleSubTab === 'receipts'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Receipts</span>
              </button>

              <button
                onClick={() => setSaleSubTab('customers')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  saleSubTab === 'customers'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Customers</span>
              </button>
            </div>

            <button
              onClick={() => setIsNewCustomerModalOpen(true)}
              className="px-3 py-1 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 text-xs font-bold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Make New Customer</span>
            </button>
          </div>

          {/* Render Sales Receivables Component */}
          <SalesReceivables products={products} activeBranchId="lahore_hafeez" />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. PURCHASES SECTION (BILLING, RECEIPTS, ADD SUPPLIER) */}
      {/* ========================================================================= */}
      {activeTab === 'purchases' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Sub Tab Switcher for Purchases */}
          <div className="flex items-center justify-between gap-3 bg-slate-900/60 p-2 rounded-2xl border border-white/5">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPurchasesSubTab('billing')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  purchasesSubTab === 'billing'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Billing Part</span>
              </button>

              <button
                onClick={() => setPurchasesSubTab('receipts')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  purchasesSubTab === 'receipts'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Receipt Part (GRN)</span>
              </button>

              <button
                onClick={() => setPurchasesSubTab('suppliers')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  purchasesSubTab === 'suppliers'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Supplier Part</span>
              </button>
            </div>

            <button
              onClick={() => setIsNewSupplierModalOpen(true)}
              className="px-3 py-1 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/20 text-xs font-bold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add Supplier</span>
            </button>
          </div>

          {/* Render Purchases Component */}
          <PurchasesPayables products={products} activeBranchId="lahore_hafeez" />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. INVENTORY SECTION (STOCK + ADD PRODUCT TO WEBSITE) */}
      {/* ========================================================================= */}
      {activeTab === 'inventory' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 shadow-lg">
              <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase">
                <span>Total Stock Units</span>
                <Boxes className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-black text-white font-mono mt-1">
                {inventoryMetrics.totalUnits} Units
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Across {products.length} hardware products</p>
            </div>

            <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 shadow-lg">
              <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase">
                <span>Total Landed Cost Asset</span>
                <Truck className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-black text-blue-300 font-mono mt-1">
                {formatPkr(inventoryMetrics.totalLandedCost)}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Warehouse procurement cost</p>
            </div>

            <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 shadow-lg">
              <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase">
                <span>Total Store Retail Value</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
                {formatPkr(inventoryMetrics.totalRetailValue)}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Expected showroom revenue</p>
            </div>

            <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 shadow-lg">
              <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase">
                <span>Unrealized Margin</span>
                <TrendingUp className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-black text-amber-400 font-mono mt-1">
                {formatPkr(inventoryMetrics.unrealizedProfit)}
              </div>
              <p className="text-[11px] text-amber-300 font-bold mt-0.5 font-mono">
                {inventoryMetrics.marginPct}% Projected Markup
              </p>
            </div>
          </div>

          {/* Search, Filter, & Add Product Action Bar */}
          <div className="bg-slate-900/90 border border-white/10 rounded-3xl p-4 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter inventory by Name, Brand, SKU, or scan EAN barcode..."
                  value={inventorySearch}
                  onChange={(e) => setInventorySearch(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <select
                value={inventoryCategoryFilter}
                onChange={(e) => setInventoryCategoryFilter(e.target.value)}
                className="bg-slate-950 border border-white/10 text-white rounded-xl px-3 py-2 text-xs outline-none"
              >
                <option value="All">All Categories ({products.length})</option>
                {uniqueCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* DIRECT BUTTON TO ADD A NEW PRODUCT TO THE WEBSITE */}
            <button
              onClick={onAddProductClick}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add New Product to Website</span>
            </button>
          </div>

          {/* INVENTORY TABLE */}
          <div className="bg-slate-900/90 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400 uppercase text-[10px] tracking-wider bg-slate-950 font-mono">
                    <th className="py-4 px-4">#</th>
                    <th className="py-4 px-4">Product Name</th>
                    <th className="py-4 px-3 font-mono">EAN-13 Barcode</th>
                    <th className="py-4 px-3">Category & Brand</th>
                    <th className="py-4 px-3 text-center">Stock Quantity</th>
                    <th className="py-4 px-3 text-right">Landed Cost</th>
                    <th className="py-4 px-3 text-right">Sale Price</th>
                    <th className="py-4 px-3 text-right">Total Landed Cost</th>
                    <th className="py-4 px-3 text-right">Total Retail Value</th>
                    <th className="py-4 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredInventory.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        <Boxes className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                        <p className="font-bold text-sm text-slate-300">No products match criteria</p>
                        <p className="text-xs text-slate-500 mt-1">
                          Click "+ Add New Product to Website" to add hardware components.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredInventory.map((prod, idx) => {
                      const units = Math.max(0, prod.stockCount ?? 0);
                      const cost = prod.costPrice || Math.round(prod.price * 0.88);
                      const totalCost = cost * units;
                      const totalRetail = prod.price * units;
                      const eanCode = (prod as any).ean || getProductEan(prod);

                      return (
                        <tr key={prod.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-3.5 px-4 font-mono text-slate-500">{idx + 1}</td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              {prod.image && (
                                <img
                                  src={prod.image}
                                  alt={prod.name}
                                  className="w-10 h-10 rounded-lg object-cover bg-slate-950 border border-white/10 shrink-0"
                                />
                              )}
                              <div className="min-w-0">
                                <div className="font-bold text-white text-xs">{prod.name}</div>
                                <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                                  SKU: {prod.sku || `APX-${prod.id.slice(0, 6)}`}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-3">
                            <span className="font-mono text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded flex items-center gap-1 w-fit">
                              <Barcode className="w-3.5 h-3.5 text-amber-400" />
                              {eanCode}
                            </span>
                          </td>
                          <td className="py-3.5 px-3">
                            <div className="text-slate-300 font-medium">{prod.brand}</div>
                            <div className="text-[10px] text-slate-500">{prod.category}</div>
                          </td>
                          <td className="py-3.5 px-3 text-center">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-mono font-black ${
                                units > 5
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : units > 0
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : 'bg-red-500/20 text-red-300 border border-red-500/30'
                              }`}
                            >
                              {units} Units
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono text-slate-300">
                            {formatPkr(cost)}
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono text-white font-bold">
                            {formatPkr(prod.price)}
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono font-bold text-blue-300">
                            {formatPkr(totalCost)}
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono font-bold text-emerald-400">
                            {formatPkr(totalRetail)}
                          </td>
                          <td className="py-3.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                units > 0
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
                              }`}
                            >
                              {units > 0 ? 'In Stock' : 'Out of Stock'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}


      {/* ========================================================================= */}
      {/* 5. FAST INTAKE SECTION */}
      {/* ========================================================================= */}
      {activeTab === 'intake' && (
        <div className="animate-in fade-in duration-200">
          <FastIntakeStation
            products={products}
            onCompleteIntake={handleFastIntakeComplete}
            onRefreshProducts={onRefreshProducts}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. REPORTS SECTION (INVOICE TRACEABILITY, BILLING TRACEABILITY, STOCK VALUATION) */}
      {/* ========================================================================= */}
      {activeTab === 'reports' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Sub Tab Switcher for Reports: Exactly the 3 requested sub tabs */}
          <div className="flex items-center gap-2 bg-slate-900/60 p-2 rounded-2xl border border-white/5 overflow-x-auto custom-scrollbar">
            {/* SUB TAB 1: INVOICE TRACEABILITY */}
            <button
              onClick={() => setReportsSubTab('invoice_traceability')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                reportsSubTab === 'invoice_traceability'
                  ? 'bg-emerald-500 text-slate-950 font-black shadow-lg shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white bg-white/5'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Invoice Traceability</span>
            </button>

            {/* SUB TAB 2: BILLING TRACEABILITY */}
            <button
              onClick={() => setReportsSubTab('billing_traceability')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                reportsSubTab === 'billing_traceability'
                  ? 'bg-blue-500 text-white font-black shadow-lg shadow-blue-500/20'
                  : 'text-slate-400 hover:text-white bg-white/5'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Billing Traceability (Where Purchased)</span>
            </button>

            {/* SUB TAB 3: STOCK VALUATION */}
            <button
              onClick={() => setReportsSubTab('stock_valuation')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                reportsSubTab === 'stock_valuation'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white bg-white/5'
              }`}
            >
              <Boxes className="w-3.5 h-3.5" />
              <span>Stock Valuation (Overall Stock)</span>
            </button>
          </div>

          {/* Render the appropriate report mode */}
          <ProductPurchaseSalesAuditReport
            products={products}
            orders={orders}
            activeBranchId="lahore_hafeez"
            initialReportType={
              reportsSubTab === 'invoice_traceability'
                ? 'invoice_detail'
                : reportsSubTab === 'billing_traceability'
                ? 'bills_detail'
                : 'stock_valuation'
            }
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE NEW CUSTOMER WITH SUB-TABS & COMPLETE PROFILES */}
      {/* ========================================================================= */}
      {isNewCustomerModalOpen && (
        <PartyDetailsModal
          isOpen={isNewCustomerModalOpen}
          kind="sales"
          onClose={() => setIsNewCustomerModalOpen(false)}
          onSaved={(saved: PartyData) => {
            setIsNewCustomerModalOpen(false);
            showToast(`Customer "${saved.businessName || saved.name}" registered successfully!`);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD SUPPLIER WITH SUB-TABS & COMPLETE PROFILES */}
      {/* ========================================================================= */}
      {isNewSupplierModalOpen && (
        <PartyDetailsModal
          isOpen={isNewSupplierModalOpen}
          kind="purchases"
          onClose={() => setIsNewSupplierModalOpen(false)}
          onSaved={(saved: PartyData) => {
            setIsNewSupplierModalOpen(false);
            showToast(`Supplier "${saved.businessName || saved.name}" registered successfully!`);
          }}
        />
      )}
    </div>
  );
};
