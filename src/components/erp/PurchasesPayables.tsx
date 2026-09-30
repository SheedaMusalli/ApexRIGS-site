import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { authFetch } from '../../utils/apiClient';
import {
  Truck,
  Building2,
  Plus,
  Search,
  FileCheck,
  CreditCard,
  Ship,
  Layers,
  Clock,
  DollarSign,
  Printer,
  Eye,
  CheckCircle,
  AlertTriangle,
  ArrowUpRight,
  Trash2,
  FileText,
  Check,
  X,
  Phone,
  Mail,
  MapPin,
  Share2,
  MessageCircle,
  AlertCircle
} from 'lucide-react';
import {
  Vendor,
  PurchaseDocument, DocumentPaymentMode,
  LetterOfCredit,
  PurchaseDocType,
  BranchLocationId,
  PurchaseItemLine
} from '../../types/erp';
import { Product } from '../../types';
import { erpStorage } from '../../services/erpStorage';
import { formatPkr } from '../../utils/formatters';
import { SearchableProductSelect } from '../SearchableProductSelect';

interface PurchasesPayablesProps {
  products: Product[];
  activeBranchId: BranchLocationId;
}

export const PurchasesPayables: React.FC<PurchasesPayablesProps> = ({ products, activeBranchId }) => {
  const [activeTab, setActiveTab] = useState<'orders' | 'vendors' | 'grn' | 'lc'>('orders');
  const [vendors, setVendors] = useState<Vendor[]>(() => erpStorage.getVendors());
  const [purchaseDocs, setPurchaseDocs] = useState<PurchaseDocument[]>(() => erpStorage.getPurchaseDocuments());
  const [searchQuery, setSearchQuery] = useState('');
  const [notification, setNotification] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  // Real-time synchronization
  const syncDocsAndVendors = useCallback(() => {
    setPurchaseDocs(erpStorage.getPurchaseDocuments());
    setVendors(erpStorage.getVendors());
  }, []);

  useEffect(() => {
    // Initial fetch from backend to ensure cross-device / server sync
    authFetch('/api/erp/purchase-docs')
      .then((res) => res.json())
      .then((docs) => {
        if (Array.isArray(docs) && docs.length > 0) {
          const current = erpStorage.getPurchaseDocuments();
          const docMap = new Map(current.map((d) => [d.id, d]));
          docs.forEach((d) => docMap.set(d.id, d));
          const merged = Array.from(docMap.values()).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setPurchaseDocs(merged);
        }
      })
      .catch(() => {});

    authFetch('/api/erp/vendors')
      .then((res) => res.json())
      .then((vList) => {
        if (Array.isArray(vList) && vList.length > 0) {
          const current = erpStorage.getVendors();
          const vMap = new Map(current.map((v) => [v.id, v]));
          vList.forEach((v) => {
            vMap.set(v.id, v);
            erpStorage.saveVendor(v);
          });
          setVendors(Array.from(vMap.values()));
        }
      })
      .catch(() => {});

    const handleUpdate = () => {
      syncDocsAndVendors();
    };

    window.addEventListener('apex:erp_updated', handleUpdate);
    window.addEventListener('apex:vendors_updated', handleUpdate);
    window.addEventListener('apex:products_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    // Fast 3s interval poll for realtime reactivity without page reload
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        syncDocsAndVendors();
      }
    }, 3000);

    return () => {
      window.removeEventListener('apex:erp_updated', handleUpdate);
      window.removeEventListener('apex:vendors_updated', handleUpdate);
      window.removeEventListener('apex:products_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      clearInterval(interval);
    };
  }, [syncDocsAndVendors]);

  // Modals
  const [isPoModalOpen, setIsPoModalOpen] = useState(false);
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [selectedDocForView, setSelectedDocForView] = useState<PurchaseDocument | null>(null);
  const [selectedVendorForView, setSelectedVendorForView] = useState<Vendor | null>(null);

  // Payment Recording State
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BANK_TRANSFER' | 'CHEQUE'>('BANK_TRANSFER');

  // New PO State
  const bankAccounts = useMemo(() => erpStorage.getBankAccounts(), []);
  const [termDays, setTermDays] = useState<number>(30);
  const [dueDate, setDueDate] = useState<string>(new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]);
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentBank, setPaymentBank] = useState<string>('Cash in Hand');
  const [createPaymentMode, setCreatePaymentMode] = useState<DocumentPaymentMode>('CASH');
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [createPaymentAmount, setCreatePaymentAmount] = useState<number | ''>('');
  const [customDocumentNumber, setCustomDocumentNumber] = useState<string>('');
  
  const [selectedVendorId, setSelectedVendorId] = useState<string>(vendors[0]?.id || '');
  const [poDocType, setPoDocType] = useState<PurchaseDocType>('PURCHASE_ORDER');
  const [poLines, setPoLines] = useState<{ productId: string; qty: number; unitCost: number; serialNumber?: string }[]>([
    { productId: products[0]?.id || '', qty: 10, unitCost: products[0]?.costPrice || 250000, serialNumber: '' }
  ]);
  const [poNotes, setPoNotes] = useState('Official distributor invoice required with valid warranty cards and serial numbers.');

  // Vendor Form
  const [vendorForm, setVendorForm] = useState<Partial<Vendor>>({
    name: '',
    companyName: '',
    contactPerson: '',
    email: '',
    phone: '',
    city: '',
    address: '',
    ntn: '',
    isFiler: false,
    paymentTermsDays: 0,
  });

  // KPI Calculations
  const stats = useMemo(() => {
    const totalPayables = vendors.reduce((acc, v) => acc + v.currentPayableBalancePkr, 0);
    const totalPurchased = purchaseDocs.reduce((acc, d) => acc + d.grandTotalPkr, 0);
    const activePOs = purchaseDocs.filter((d) => d.status === 'SUBMITTED' || d.status === 'APPROVED').length;
    return { totalPayables, totalPurchased, activePOs, totalVendors: vendors.length };
  }, [vendors, purchaseDocs]);

  // Handle PO Lines
  const handleAddLine = () => {
    if (products.length === 0) return;
    setPoLines([...poLines, { productId: products[0].id, qty: 5, unitCost: products[0].costPrice || products[0].price * 0.82, serialNumber: '' }]);
  };

  const handleRemoveLine = (idx: number) => {
    setPoLines(poLines.filter((_, i) => i !== idx));
  };

  const handleProductChange = (idx: number, prodId: string, product?: Product) => {
    const prod = product || products.find((p) => p.id === prodId);
    if (!prod) return;
    const updated = [...poLines];
    updated[idx] = {
      ...updated[idx],
      productId: prod.id,
      unitCost: prod.costPrice || Math.round(prod.price * 0.82),
    };
    setPoLines(updated);
  };

  const handleCreatePO = (e: React.FormEvent) => {
    e.preventDefault();
    const vendor = vendors.find((v) => v.id === selectedVendorId);
    if (!vendor) {
      alert('Please select a vendor.');
      return;
    }

    let subtotal = 0;
    
    const items: PurchaseItemLine[] = poLines.map((line, idx) => {
      const prod = products.find((p) => p.id === line.productId);
      const lineSub = line.qty * line.unitCost;
      subtotal += lineSub;
      const cleanSerial = line.serialNumber?.trim() || undefined;
      const serialsArray = cleanSerial ? cleanSerial.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean) : undefined;
      
      return {
        id: 'pline-' + idx + '-' + Date.now(),
        productId: line.productId,
        productName: prod ? prod.name : 'Component',
        sku: prod ? prod.sku || 'SKU-001' : 'SKU-001',
        orderedQty: line.qty,
        receivedQty: line.qty,
        billedQty: line.qty,
        unitCostPkr: line.unitCost,
        taxRatePercent: 0,
        taxAmountPkr: 0,
        totalPkr: lineSub,
        warehouseId: activeBranchId,
        serialNumber: cleanSerial,
        serialNumbers: serialsArray,
      };
    });

    const whtDeduction = 0;
    const grandTotal = subtotal;

    const finalDocNumber = customDocumentNumber.trim() || `PO-2026-${String(purchaseDocs.length + 101).padStart(4, '0')}`;
    const paidAmount = Number(createPaymentAmount) || 0;

    const newDoc: PurchaseDocument = {
      id: 'pdoc-' + Date.now(),
      docNumber: finalDocNumber,
      type: poDocType,
      vendorId: vendor.id,
      vendorName: vendor.name,
      vendorNtn: vendor.ntn,
      vendorIsFiler: vendor.isFiler,
      branchId: activeBranchId,
      issueDate: new Date().toISOString().split('T')[0],
      deliveryDueDate: dueDate,
      termDays,
      previousBalancePkr: vendor.currentPayableBalancePkr,
      status: paidAmount >= grandTotal ? 'PAID' : paidAmount > 0 ? 'PARTIALLY_PAID' : 'APPROVED',
      items,
      subtotalPkr: subtotal,
      inputGstPkr: 0,
      whtDeductionRate: 0,
      whtDeductionPkr: 0,
      freightShippingPkr: 0,
      customsAndClearancePkr: 0,
      grandTotalPkr: grandTotal,
      paidAmountPkr: paidAmount,
      balancePayablePkr: Math.max(0, grandTotal - paidAmount),
      paymentDetails: paidAmount > 0 ? {
        date: paymentDate,
        bank: paymentBank,
        mode: createPaymentMode as DocumentPaymentMode,
        referenceNumber: paymentReference || finalDocNumber,
        amount: paidAmount,
      } : undefined,
      createdBy: 'Chief Procurement Manager',
      notes: poNotes,
      createdAt: new Date().toISOString(),
    };

    const updated = erpStorage.savePurchaseDocument(newDoc);
    setPurchaseDocs(updated);

    // Sync with backend API
    authFetch('/api/erp/purchase-docs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newDoc),
    }).catch(() => {});

    // Update Vendor Balance
    const remainingBalance = grandTotal - paidAmount;
    vendor.currentPayableBalancePkr += remainingBalance;
    vendor.totalPurchasesPkr += grandTotal;
    erpStorage.saveVendor(vendor);
    
    if (paidAmount > 0) {
      erpStorage.saveVoucher({
        id: 'vch-' + Date.now(),
        voucherNumber: `CPV-2026-${Math.floor(Math.random() * 10000)}`,
        type: 'CPV',
        date: paymentDate,
        partyType: 'VENDOR',
        partyId: vendor.id,
        partyName: vendor.name,
        paymentMode: createPaymentMode === 'CASH' ? 'CASH' : createPaymentMode === 'CHECK' ? 'CHEQUE' : 'ONLINE_TRANSFER',
        chequeOrRefNumber: paymentReference || finalDocNumber,
        narration: `Direct Payment made for PO/Bill ${finalDocNumber} via ${createPaymentMode}`,
        amountPkr: paidAmount,
        netPaidOrReceivedPkr: paidAmount,
        debitAccountCode: '2100', // Accounts Payable
        debitAccountName: 'Accounts Payable',
        creditAccountCode: paymentBank.includes('Cash') ? '1010' : '1020',
        creditAccountName: paymentBank,
        preparedBy: 'Admin',
        branchId: activeBranchId,
        createdAt: new Date().toISOString()
      });
    }

    authFetch('/api/erp/vendors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vendor),
    }).catch(() => {});
    setVendors(erpStorage.getVendors());

    setIsPoModalOpen(false);
    setSelectedDocForView(newDoc);
  };

  const handleCreateVendor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorForm.name || !vendorForm.phone) {
      alert('Please fill vendor company name and phone.');
      return;
    }

    const newVend: Vendor = {
      id: 'vend-' + Date.now(),
      name: vendorForm.name || '',
      companyName: vendorForm.companyName || vendorForm.name || '',
      contactPerson: vendorForm.contactPerson || '',
      email: vendorForm.email || '',
      phone: vendorForm.phone || '',
      city: vendorForm.city || '',
      address: vendorForm.address || '',
      ntn: vendorForm.ntn || '',
      isFiler: vendorForm.isFiler ?? false,
      paymentTermsDays: Number(vendorForm.paymentTermsDays) || 0,
      currentPayableBalancePkr: 0,
      totalPurchasesPkr: 0,
      productCategoriesSupplied: ['Graphic Card', 'Processor', 'Storage'],
      createdAt: new Date().toISOString(),
    };

    const updated = erpStorage.saveVendor(newVend);
    setVendors(updated);
    setIsVendorModalOpen(false);

    // Sync with backend API
    authFetch('/api/erp/vendors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newVend),
    }).catch(() => {});

    // Notify all components in real-time
    window.dispatchEvent(new CustomEvent('apex:vendors_updated', { detail: newVend }));
    window.dispatchEvent(new CustomEvent('apex:erp_updated'));

    setVendorForm({
      name: '',
      companyName: '',
      contactPerson: '',
      email: '',
      phone: '',
      city: '',
      address: '',
      ntn: '',
      isFiler: false,
      paymentTermsDays: 0,
    });
  };

  const handleDeleteVendor = (vendorId: string, vendorName: string) => {
    const updated = erpStorage.deleteVendor(vendorId);
    setVendors(updated);
    if (selectedVendorForView?.id === vendorId) {
      setSelectedVendorForView(null);
    }
    fetch(`/api/erp/vendors/${encodeURIComponent(vendorId)}`, { method: 'DELETE' }).catch(() => {});
    showToast(`Supplier "${vendorName}" removed from records.`);
    window.dispatchEvent(new CustomEvent('apex:vendors_updated'));
    window.dispatchEvent(new CustomEvent('apex:erp_updated'));
  };

  const handleDeleteDoc = (docId: string, docNumber: string) => {
    const updated = erpStorage.deletePurchaseDocument(docId);
    setPurchaseDocs(updated);
    if (selectedDocForView?.id === docId || selectedDocForView?.docNumber === docNumber) {
      setSelectedDocForView(null);
    }
    fetch(`/api/erp/purchase-docs/${encodeURIComponent(docId)}`, { method: 'DELETE' }).catch(() => {});
    if (docNumber && docNumber !== docId) {
      fetch(`/api/erp/purchase-docs/${encodeURIComponent(docNumber)}`, { method: 'DELETE' }).catch(() => {});
    }
    showToast(`Purchase document #${docNumber} deleted successfully.`);
    window.dispatchEvent(new CustomEvent('apex:erp_updated'));
  };

  const handleRecordDocPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDocForView) return;
    const payVal = Number(paymentAmount);
    if (!payVal || payVal <= 0) {
      alert('Please enter a valid payment amount in PKR.');
      return;
    }

    const currentBalance = selectedDocForView.balancePayablePkr || 0;
    const actualPay = Math.min(payVal, currentBalance);
    const updatedPaid = (selectedDocForView.paidAmountPkr || 0) + actualPay;
    const newBalance = Math.max(0, currentBalance - actualPay);
    const newStatus = newBalance === 0 ? 'PAID' : 'PARTIALLY_PAID';

    const updatedDoc: PurchaseDocument = {
      ...selectedDocForView,
      paidAmountPkr: updatedPaid,
      balancePayablePkr: newBalance,
      status: newStatus,
      notes: `${selectedDocForView.notes || ''}\n[Payment Recorded]: PKR ${actualPay.toLocaleString()} via ${paymentMethod} on ${new Date().toLocaleDateString('en-GB')}`.trim(),
    };

    const updatedDocs = erpStorage.savePurchaseDocument(updatedDoc);
    setPurchaseDocs(updatedDocs);
    setSelectedDocForView(updatedDoc);

    // Sync purchase document to backend
    authFetch('/api/erp/purchase-docs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedDoc),
    }).catch(() => {});

    // Update vendor balance
    const vend = vendors.find((v) => v.id === updatedDoc.vendorId || v.name === updatedDoc.vendorName);
    if (vend) {
      vend.currentPayableBalancePkr = Math.max(0, (vend.currentPayableBalancePkr || 0) - actualPay);
      erpStorage.saveVendor(vend);
      authFetch('/api/erp/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vend),
      }).catch(() => {});
      setVendors(erpStorage.getVendors());
    }

    window.dispatchEvent(new CustomEvent('apex:erp_updated'));
    setIsRecordingPayment(false);
    setPaymentAmount('');
  };

  const generateWhatsAppShare = (doc: PurchaseDocument) => {
    const text = `*APEXRIG PC & GAMING HARDWARE - ${doc.type}*\n` +
      `Doc #: ${doc.docNumber}\n` +
      `Vendor: ${doc.vendorName} ${doc.vendorNtn ? `(NTN: ${doc.vendorNtn})` : ''}\n` +
      `Issue Date: ${doc.issueDate}\n` +
      `Items: ${doc.items.length} line items (${doc.items.reduce((s, i) => s + i.orderedQty, 0)} units)\n` +
      `Grand Total: PKR ${doc.grandTotalPkr.toLocaleString()}\n` +
      `Amount Paid: PKR ${(doc.paidAmountPkr || 0).toLocaleString()}\n` +
      `Balance Payable: PKR ${doc.balancePayablePkr.toLocaleString()}\n` +
      `Status: ${doc.status}\n` +
      `Storefront: Shop 12-A, 3rd Floor, Hafeez Center, Gulberg III, Lahore`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      {notification && (
        <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-semibold animate-in fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-red-500/20 rounded-2xl p-4 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Outstanding Payables</span>
            <DollarSign className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl font-black text-red-300 font-mono">
            {formatPkr(stats.totalPayables)}
          </div>
          <div className="text-[11px] text-red-400/80 mt-1">Due to local & international suppliers</div>
        </div>

        <div className="bg-slate-900/80 border border-blue-500/20 rounded-2xl p-4 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Total Purchases (Landed)</span>
            <Truck className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-blue-300 font-mono">
            {formatPkr(stats.totalPurchased)}
          </div>
          
        </div>

        <div className="bg-slate-900/80 border border-amber-500/20 rounded-2xl p-4 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Active Purchase Orders</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-300 font-mono">
            {stats.activePOs} POs Pending Delivery
          </div>
          <div className="text-[11px] text-amber-400/80 mt-1">2-Way / 3-Way GRN matching</div>
        </div>

        <div className="bg-slate-900/80 border border-emerald-500/20 rounded-2xl p-4 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Registered Vendors</span>
            <Building2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-300 font-mono">
            {stats.totalVendors} Distributors
          </div>
          <div className="text-[11px] text-slate-400 mt-1">ASUS, Megaplus, Galaxy, Shing Tech</div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-white/10">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'orders'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Purchase Orders & Bills</span>
          </button>

          <button
            onClick={() => setActiveTab('vendors')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'vendors'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Vendor Management & Aging</span>
          </button>

          <button
            onClick={() => setActiveTab('grn')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'grn'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>Goods Received Notes (GRN)</span>
          </button>

          <button
            onClick={() => setActiveTab('lc')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'lc'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Ship className="w-3.5 h-3.5" />
            <span>Letter of Credit (LC) & Landed Cost</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search vendor, PO #, item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <button
            onClick={() => {
              if (vendors.length > 0) setSelectedVendorId(vendors[0].id);
              setTermDays(14);
              setDueDate(new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]);
              setPaymentDate(new Date().toISOString().split('T')[0]);
              setPaymentBank('Cash in Hand');
              setCreatePaymentMode('CASH');
              setPaymentReference('');
              setCreatePaymentAmount('');
              setCustomDocumentNumber('');
              setIsPoModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all shrink-0"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Create Purchase Order</span>
          </button>

          <button
            onClick={() => setIsVendorModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-blue-600/20 transition-all shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Supplier</span>
          </button>
        </div>
      </div>

      {/* Main Table */}
      {activeTab === 'orders' || activeTab === 'grn' ? (
        <div className="bg-slate-900/90 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] font-bold border-b border-white/10">
                <tr>
                  <th className="py-3.5 px-4">PO # / Bill</th>
                  <th className="py-3.5 px-4">Vendor / Distributor</th>
                  <th className="py-3.5 px-4">Issue Date</th>
                  <th className="py-3.5 px-4">Ordered SKUs</th>
                  <th className="py-3.5 px-4 text-right">Subtotal</th>
                  
                  <th className="py-3.5 px-4 text-right">Grand Total (PKR)</th>
                  <th className="py-3.5 px-4 text-right">Balance Payable</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {purchaseDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-amber-400">{doc.docNumber}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-white">{doc.vendorName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        Supplier
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">{doc.issueDate}</td>
                    <td className="py-3 px-4">
                      <span className="bg-white/5 px-2 py-0.5 rounded text-[11px] text-slate-300">
                        {doc.items.reduce((acc, i) => acc + i.orderedQty, 0)} Units ({doc.items.length} SKUs)
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-300">{formatPkr(doc.subtotalPkr)}</td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-400">{formatPkr(doc.inputGstPkr)}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-white">{formatPkr(doc.grandTotalPkr)}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-red-400">{formatPkr(doc.balancePayablePkr)}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        {doc.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {doc.balancePayablePkr > 0 && (
                          <button
                            onClick={() => {
                              setSelectedDocForView(doc);
                              setIsRecordingPayment(true);
                            }}
                            className="px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold flex items-center gap-1 transition-colors"
                            title="Record Payment to Supplier"
                          >
                            <CreditCard className="w-3 h-3" />
                            <span>Pay</span>
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedDocForView(doc)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                          title="View PO / Bill Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedDocForView(doc);
                            setTimeout(() => window.print(), 300);
                          }}
                          className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 hover:text-amber-200 transition-colors"
                          title="Print Document"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDoc(doc.id, doc.docNumber);
                          }}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors"
                          title="Delete Record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'vendors' ? (
        /* VENDOR LIST */
        <div className="bg-slate-900/90 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] font-bold border-b border-white/10">
                <tr>
                  <th className="py-3.5 px-4">Supplier / Distributor</th>
                  <th className="py-3.5 px-4">Contact Person</th>
                  <th className="py-3.5 px-4">Phone & City</th>
                  <th className="py-3.5 px-4">Payment Terms</th>
                  <th className="py-3.5 px-4 text-right">Outstanding Payable</th>
                  <th className="py-3.5 px-4 text-right">Total Purchases</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {vendors.map((vend) => (
                  <tr key={vend.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-white">{vend.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        Supplier
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-300">{vend.contactPerson}</td>
                    <td className="py-3 px-4">
                      <div className="font-mono text-white">{vend.phone}</div>
                      <div className="text-[10px] text-slate-500">{vend.city}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">{vend.paymentTermsDays} Days Net</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-red-400">
                      {formatPkr(vend.currentPayableBalancePkr)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-white">
                      {formatPkr(vend.totalPurchasesPkr)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedVendorForView(vend)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                          title="View Supplier Profile & Ledger"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedVendorId(vend.id);
                            setIsPoModalOpen(true);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 text-[11px] font-bold transition-colors"
                        >
                          + Issue PO
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteVendor(vend.id, vend.name);
                          }}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors"
                          title="Remove Supplier"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* LETTER OF CREDIT (LC) TRACKING */
        <div className="p-6 bg-slate-900/90 border border-white/10 rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Ship className="w-5 h-5 text-amber-400" />
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Letter of Credit (LC) Import Tracking</h3>
                <p className="text-[11px] text-slate-400">Customs clearance, port duties, and landed unit cost allocation</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setPoDocType('LETTER_OF_CREDIT');
                setIsPoModalOpen(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1 transition-all active:scale-95 shadow-md shadow-amber-500/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Open New Import LC</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-950 p-4 rounded-xl border border-white/10 space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-mono font-bold text-amber-400">LC-MEEZAN-2026-8802</span>
                <span className="bg-blue-500/20 text-blue-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  CUSTOMS CLEARING
                </span>
              </div>
              <div className="text-xs space-y-1">
                <div className="text-white font-bold">Supplier: Shing Tech FZCO (Dubai, UAE)</div>
                <div className="text-slate-400">Container: 40ft High Cube (50x RTX 4090, 80x RTX 4080 Super)</div>
                <div className="font-mono text-emerald-400">Total Foreign Value: $85,000 USD @ 283.50 PKR = PKR 24,097,500</div>
                <div className="font-mono text-slate-400">Customs & Regulatory Duty (FBR): PKR 2,410,000</div>
                <div className="font-mono text-amber-300 font-bold">Total Landed Allocation: PKR 26,850,000</div>
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-white/10 space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-mono font-bold text-amber-400">LC-HBL-2026-1049</span>
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  ARRIVED & STOCKED
                </span>
              </div>
              <div className="text-xs space-y-1">
                <div className="text-white font-bold">Supplier: Lian Li Industrial Corp (Taiwan)</div>
                <div className="text-slate-400">Cases & AIO Liquid Coolers (O11 Dynamic EVO, Galahad II LCD)</div>
                <div className="font-mono text-emerald-400">Total Foreign Value: $32,000 USD @ 281.20 PKR = PKR 8,998,400</div>
                <div className="font-mono text-slate-400">Port Surcharge & Freight: PKR 680,000</div>
                <div className="font-mono text-emerald-300 font-bold">Inventory Landed Cost Verified</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE PURCHASE ORDER */}
      {isPoModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
          <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-6 lg:p-7 max-w-6xl w-full shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-base font-bold text-white uppercase tracking-wider">Create Purchase Order / Supplier Document</h3>
                  <p className="text-[11px] text-slate-400">Procure hardware items from authorized distributor and record supplier payable</p>
                </div>
              </div>
              <button onClick={() => setIsPoModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-base">✕</button>
            </div>

            <form onSubmit={handleCreatePO} className="space-y-4 text-xs">
              {/* Top Row: Supplier Selection & Destination Store */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/70 p-4 rounded-2xl border border-white/5">
                <div>
                  <label className="text-slate-300 font-bold block mb-1.5 uppercase tracking-wider text-[11px]">Select Supplier / Distributor *</label>
                  <select
                    value={selectedVendorId}
                    onChange={(e) => setSelectedVendorId(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                  >
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.city}) · Prev Payable: {formatPkr(v.currentPayableBalancePkr || 0)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1.5 uppercase tracking-wider text-[11px]">Receiving Branch / Warehouse</label>
                  <input
                    type="text"
                    disabled
                    value="Shop 12-A, 3rd Floor, Hafeez Center, Gulberg III, Lahore"
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-slate-300 font-mono text-xs"
                  />
                </div>
              </div>

              {/* Product Lines */}
              <div className="border border-white/10 rounded-2xl p-4 bg-slate-950/60 space-y-3">
                <div className="flex items-center justify-between text-slate-300 font-bold text-xs pb-1 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="uppercase tracking-wider">Hardware Lines to Procure</span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-amber-400 font-mono">
                      {poLines.length} {poLines.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="text-amber-400 hover:text-amber-300 font-bold text-xs px-3 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Hardware Line
                  </button>
                </div>

                {poLines.map((line, idx) => (
                  <div key={idx} className="bg-slate-900 p-3.5 rounded-xl border border-white/5 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                      <div className="md:col-span-7">
                        <SearchableProductSelect
                          products={products}
                          selectedProductId={line.productId}
                          onSelectProduct={(id, p) => handleProductChange(idx, id, p)}
                          compact={true}
                          label={`Hardware Item #${idx + 1}`}
                          idPrefix={`po-line-${idx}`}
                        />
                      </div>
                      <div className="md:col-span-5">
                        <label className="text-[10px] text-slate-400 block mb-1 font-semibold uppercase">
                          Hardware Serial # (S/N)
                        </label>
                        <input
                          type="text"
                          placeholder="Serial # (e.g. SN-90412)"
                          value={line.serialNumber || ''}
                          onChange={(e) => {
                            const updated = [...poLines];
                            updated[idx].serialNumber = e.target.value;
                            setPoLines(updated);
                          }}
                          className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-amber-300 font-mono text-xs focus:border-amber-500 focus:outline-none placeholder-slate-600"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-12 gap-3 items-center pt-2 border-t border-white/5">
                      <div className="col-span-4">
                        <label className="text-[10px] text-slate-400 block mb-1 font-semibold uppercase">Quantity (Units)</label>
                        <input
                          type="number"
                          min="1"
                          placeholder="Qty"
                          value={line.qty}
                          onChange={(e) => {
                            const updated = [...poLines];
                            updated[idx].qty = Number(e.target.value);
                            setPoLines(updated);
                          }}
                          className="w-full bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-white font-mono text-center text-xs focus:border-amber-500 focus:outline-none"
                        />
                      </div>
                      <div className="col-span-5">
                        <label className="text-[10px] text-slate-400 block mb-1 font-semibold uppercase">Unit Cost (PKR)</label>
                        <input
                          type="number"
                          placeholder="Unit Cost"
                          value={line.unitCost}
                          onChange={(e) => {
                            const updated = [...poLines];
                            updated[idx].unitCost = Number(e.target.value);
                            setPoLines(updated);
                          }}
                          className="w-full bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-white font-mono text-right text-xs focus:border-amber-500 focus:outline-none"
                        />
                      </div>
                      <div className="col-span-3 text-right pt-4">
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          className="text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-xs font-bold transition-colors inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" /> Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Lower Section: 2 Columns (Left: Terms/Dates/Notes, Right: Financial Totals & Settlement) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Left (7 cols): Document metadata & Notes */}
                <div className="lg:col-span-7 space-y-3 bg-slate-950/60 p-4 rounded-2xl border border-white/5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-slate-400 block mb-1 font-semibold text-[11px]">Doc / PO #</label>
                      <input
                        type="text"
                        placeholder="Auto-generated"
                        value={customDocumentNumber}
                        onChange={(e) => setCustomDocumentNumber(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white font-mono focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1 font-semibold text-[11px]">Term Days</label>
                      <input
                        type="number"
                        value={termDays}
                        onChange={(e) => {
                          setTermDays(Number(e.target.value));
                          setDueDate(new Date(Date.now() + Number(e.target.value) * 86400000).toISOString().split('T')[0]);
                        }}
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white font-mono focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1 font-semibold text-[11px]">Due Date</label>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white font-mono focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1 font-semibold text-[11px]">Delivery Terms & Notes</label>
                    <textarea
                      value={poNotes}
                      onChange={(e) => setPoNotes(e.target.value)}
                      rows={2}
                      placeholder="e.g. Include official distributor warranty card, delivery by cargo..."
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Right (5 cols): Billing Settlement & Totals */}
                <div className="lg:col-span-5 space-y-3 bg-slate-950/60 p-4 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-2 text-amber-400 font-bold border-b border-white/5 pb-2">
                    <CreditCard className="w-4 h-4" />
                    <h4 className="uppercase tracking-wider text-xs">Procurement Settlement</h4>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-400 block mb-1 text-[11px]">Payment Mode</label>
                      <select
                        value={createPaymentMode}
                        onChange={(e) => setCreatePaymentMode(e.target.value as DocumentPaymentMode)}
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-white text-xs focus:border-amber-500 focus:outline-none"
                      >
                        <option value="CASH">Cash</option>
                        <option value="CHECK">Check</option>
                        <option value="CREDIT_CARD">Credit Card</option>
                        <option value="OFFSET">Trade-in (Offset)</option>
                        <option value="ONLINE">Online (IBFT)</option>
                        <option value="PAY_ORDER">Pay Order</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1 text-[11px]">Bank / Account</label>
                      <select
                        value={paymentBank}
                        onChange={(e) => setPaymentBank(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-white text-xs focus:border-amber-500 focus:outline-none"
                      >
                        <option value="Cash in Hand">Cash in Hand</option>
                        {bankAccounts.filter(b => b.type !== 'CASH_DRAWER').map(bank => (
                          <option key={bank.id} value={bank.accountName}>{bank.accountName}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-400 block mb-1 text-[11px]">Ref # (Optional)</label>
                      <input
                        type="text"
                        placeholder="Ref #"
                        value={paymentReference}
                        onChange={(e) => setPaymentReference(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-white font-mono text-xs focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-emerald-400 font-bold block mb-1 text-[11px]">Advance Paid (PKR)</label>
                      <input
                        type="number"
                        placeholder="0.00"
                        value={createPaymentAmount}
                        onChange={(e) => setCreatePaymentAmount(e.target.value ? Number(e.target.value) : '')}
                        className="w-full bg-slate-900 border border-emerald-500/50 rounded-xl px-2.5 py-1.5 text-emerald-300 font-mono font-bold text-xs focus:border-emerald-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Summary Box */}
                  <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl flex justify-between items-center">
                    <div>
                      <span className="text-[10px] text-amber-300 font-bold uppercase tracking-wider block">PO Total Value</span>
                      <span className="text-[11px] text-slate-400">{poLines.reduce((s, l) => s + (Number(l.qty) || 0), 0)} Units</span>
                    </div>
                    <span className="text-lg font-black text-amber-400 font-mono">
                      {formatPkr(poLines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitCost) || 0), 0))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsPoModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all active:scale-95"
                >
                  Submit & Approve PO
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE VENDOR */}
      {isVendorModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-blue-500/30 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Add Supplier / Distributor</h3>
              </div>
              <button onClick={() => setIsVendorModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateVendor} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Company / Business Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Megaplus Distribution Pakistan"
                  value={vendorForm.name || ''}
                  onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">Contact Person</label>
                  <input
                    type="text"
                    placeholder="e.g. Khurram Shehzad"
                    value={vendorForm.contactPerson || ''}
                    onChange={(e) => setVendorForm({ ...vendorForm, contactPerson: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Phone *</label>
                  <input
                    type="text"
                    required
                    placeholder="+92 42 111 222 333"
                    value={vendorForm.phone || ''}
                    onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                
                <div>
                  <label className="text-slate-400 block mb-1">Credit Terms (Days)</label>
                  <input
                    type="number"
                    value={vendorForm.paymentTermsDays || ''}
                    onChange={(e) => setVendorForm({ ...vendorForm, paymentTermsDays: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsVendorModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-600/20"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PRINTABLE PURCHASE ORDER / SUPPLIER BILL VOUCHER */}
      {selectedDocForView && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4">
          <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-6 lg:p-8 max-w-5xl xl:max-w-6xl w-full shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            {/* Modal Header Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                      {selectedDocForView.type} #{selectedDocForView.docNumber}
                    </h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      selectedDocForView.status === 'PAID'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : selectedDocForView.status === 'RECEIVED' || selectedDocForView.status === 'APPROVED'
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      {selectedDocForView.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Supplier: <span className="text-white font-medium">{selectedDocForView.vendorName}</span> • Issue Date: {selectedDocForView.issueDate}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {selectedDocForView.balancePayablePkr > 0 && (
                  <button
                    onClick={() => {
                      setIsRecordingPayment(!isRecordingPayment);
                      setPaymentAmount(selectedDocForView.balancePayablePkr);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>{isRecordingPayment ? 'Close Payment' : 'Record Payment'}</span>
                  </button>
                )}

                <button
                  onClick={() => generateWhatsAppShare(selectedDocForView)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-700/80 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 transition-all"
                  title="Share document details via WhatsApp"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">WhatsApp</span>
                </button>

                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Voucher</span>
                </button>

                <button
                  onClick={() => handleDeleteDoc(selectedDocForView.id, selectedDocForView.docNumber)}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 font-bold text-xs flex items-center gap-1.5 border border-rose-500/30 transition-all"
                  title="Delete Document Record"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Delete</span>
                </button>

                <button
                  onClick={() => {
                    setSelectedDocForView(null);
                    setIsRecordingPayment(false);
                  }}
                  className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
                  title="Close Modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Quick Inline Payment Drawer */}
            {isRecordingPayment && (
              <form onSubmit={handleRecordDocPayment} className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                    <CreditCard className="w-4 h-4" />
                    <span>Record Settlement / Payment Towards Bill</span>
                  </div>
                  <div className="text-xs font-mono text-slate-400">
                    Remaining Balance: <span className="text-red-400 font-bold">{formatPkr(selectedDocForView.balancePayablePkr)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Amount to Pay (PKR) *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={selectedDocForView.balancePayablePkr}
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="e.g. 50000"
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-xs focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Payment Method</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="BANK_TRANSFER">Bank Transfer (Meezan / HBL)</option>
                      <option value="CASH">Cash Counter (Shop Hafeez Center)</option>
                      <option value="CHEQUE">Crossed Company Cheque</option>
                    </select>
                  </div>

                  <div className="flex items-end gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentAmount(selectedDocForView.balancePayablePkr)}
                      className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold"
                    >
                      Pay Full
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20"
                    >
                      Confirm Payment
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Printable Voucher Sheet */}
            <div className="bg-white text-slate-900 p-6 md:p-8 rounded-2xl space-y-5 font-sans text-xs border border-slate-200 shadow-sm print:m-0 print:border-none">
              {/* Document Letterhead */}
              <div className="flex flex-wrap justify-between items-start border-b border-slate-200 pb-5 gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-black tracking-tight text-slate-950 font-sans">APEXRIG PC & GAMING HARDWARE</span>
                  </div>
                  <p className="text-slate-600 text-[11px] mt-0.5">Official Retail Storefront: Shop 12-A, 3rd Floor, Hafeez Center, Gulberg iii, Lahore</p>
                  <p className="text-slate-500 text-[10px] font-mono mt-0.5">
                    
                  </p>
                  <p className="text-slate-500 text-[10px] font-mono">Contact: +447597030688 | apexrig.pk</p>
                </div>
                <div className="text-right">
                  <div className="text-xs font-black text-amber-600 uppercase tracking-wider">{selectedDocForView.type}</div>
                  <div className="text-base font-mono font-black text-slate-900">{selectedDocForView.docNumber}</div>
                  <div className="text-[11px] text-slate-500 mt-1">Issue Date: <span className="font-mono text-slate-800">{selectedDocForView.issueDate}</span></div>
                  <div className="text-[11px] text-slate-500">Due Date: <span className="font-mono text-slate-800">{selectedDocForView.deliveryDueDate}</span></div>
                </div>
              </div>

              {/* Vendor & Storefront Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-slate-200 pb-4">
                <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                  <div className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">Vendor / Distributor:</div>
                  <div className="font-bold text-sm text-slate-900">{selectedDocForView.vendorName}</div>
                  <div className="text-slate-600 font-mono text-[11px]">
                    
                  </div>
                  <div className="text-slate-500 text-[11px]">
                    Filer Status: <span className="font-bold text-emerald-700">{selectedDocForView.vendorIsFiler ? 'Active Filer (4.5% WHT)' : 'Non-Filer'}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl space-y-1 text-right md:text-right">
                  <div className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">Receiving Storefront:</div>
                  <div className="font-bold text-slate-900">ApexRig Storefront #12-A</div>
                  <div className="text-slate-600 text-[11px]">3rd Floor, Hafeez Center, Gulberg iii, Lahore</div>
                  <div className="text-slate-500 text-[11px] font-mono">Audited Status: Verified Store Inventory</div>
                </div>
              </div>

              {/* Hardware Items Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b-2 border-slate-300 text-slate-600 text-[10px] uppercase font-bold tracking-wider">
                      <th className="py-2.5">Hardware Item & SKU</th>
                      <th className="py-2.5 text-center">Ordered Qty</th>
                      <th className="py-2.5 text-center">Received Qty</th>
                      <th className="py-2.5 text-right">Unit Cost (PKR)</th>
                      
                      <th className="py-2.5 text-right">Line Total (PKR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                    {(selectedDocForView.items || []).map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2.5 font-sans">
                          <div className="font-bold text-slate-900">{item.productName}</div>
                          <div className="text-[10px] text-slate-500 font-mono">SKU: {item.sku}</div>
                          {(item.serialNumber || (item.serialNumbers && item.serialNumbers.length > 0)) && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {(item.serialNumbers || (item.serialNumber ? [item.serialNumber] : [])).slice(0, 5).map((sn, sIdx) => (
                                <span key={sIdx} className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[9px] font-mono border border-slate-200">
                                  {sn}
                                </span>
                              ))}
                              {(item.serialNumbers?.length || 0) > 5 && (
                                <span className="text-[9px] text-slate-500 font-mono self-center">
                                  +{(item.serialNumbers?.length || 0) - 5} more S/Ns
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 text-center font-bold">{item.orderedQty}</td>
                        <td className="py-2.5 text-center font-bold text-emerald-700">{item.receivedQty}</td>
                        <td className="py-2.5 text-right">{formatPkr(item.unitCostPkr)}</td>
                        <td className="py-2.5 text-right text-slate-600">{formatPkr(item.taxAmountPkr || 0)}</td>
                        <td className="py-2.5 text-right font-bold text-slate-900">{formatPkr(item.totalPkr)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Calculation & Signatures */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-3 border-t border-slate-200">
                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                    <span className="font-bold text-slate-600 text-[10px] uppercase">Notes & Special Instructions:</span>
                    <p className="text-slate-700 italic text-[11px] whitespace-pre-wrap">
                      {selectedDocForView.notes || 'No special notes logged. Genuine local distributor warranty applies.'}
                    </p>
                  </div>
                  <div className="pt-6 grid grid-cols-2 gap-4 text-center">
                    <div className="border-t border-slate-300 pt-1">
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">Store Purchasing Lead</div>
                      <div className="text-[11px] font-bold text-slate-800">Hammad Ur Rehman</div>
                    </div>
                    <div className="border-t border-slate-300 pt-1">
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">Vendor Representative</div>
                      <div className="text-[11px] font-bold text-slate-800">{selectedDocForView.vendorName}</div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <div className="w-72 space-y-1.5 font-mono text-[11px]">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal:</span>
                      <span>{formatPkr(selectedDocForView.subtotalPkr)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Input GST (18% FBR):</span>
                      <span className="text-emerald-700">+{formatPkr(selectedDocForView.inputGstPkr)}</span>
                    </div>
                    {selectedDocForView.whtDeductionPkr > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span>WHT Deduction (4.5%):</span>
                        <span>-{formatPkr(selectedDocForView.whtDeductionPkr)}</span>
                      </div>
                    )}
                    {selectedDocForView.freightShippingPkr > 0 && (
                      <div className="flex justify-between text-slate-600">
                        <span>Freight / Shipping:</span>
                        <span>+{formatPkr(selectedDocForView.freightShippingPkr)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-sm text-slate-950 pt-2 border-t border-slate-300 font-sans">
                      <span>Grand Total:</span>
                      <span className="text-amber-600">{formatPkr(selectedDocForView.grandTotalPkr)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-700 font-semibold pt-1">
                      <span>Amount Paid:</span>
                      <span>{formatPkr(selectedDocForView.paidAmountPkr || 0)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-sm pt-1 border-t border-slate-200 font-sans">
                      <span className="text-slate-900">Balance Payable:</span>
                      <span className={selectedDocForView.balancePayablePkr > 0 ? 'text-red-600' : 'text-emerald-600'}>
                        {formatPkr(selectedDocForView.balancePayablePkr)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VENDOR DETAILS & LEDGER STATEMENT */}
      {selectedVendorForView && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-blue-500/30 rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                    {selectedVendorForView.name}
                  </h3>
                  <p className="text-[11px] text-slate-400">Supplier Ledger & Profile Summary</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSelectedVendorId(selectedVendorForView.id);
                    setSelectedVendorForView(null);
                    setIsPoModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1 shadow-md shadow-amber-500/20"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Issue PO</span>
                </button>
                <button
                  onClick={() => {
                    handleDeleteVendor(selectedVendorForView.id, selectedVendorForView.name);
                    setSelectedVendorForView(null);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 font-bold text-xs flex items-center gap-1 border border-rose-500/30 transition-all"
                  title="Delete Supplier Record"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
                <button
                  onClick={() => setSelectedVendorForView(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Metric Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-white/10 space-y-1">
                <div className="text-[10px] text-slate-400 uppercase font-bold">Outstanding Payable</div>
                <div className="text-base font-mono font-bold text-red-400">{formatPkr(selectedVendorForView.currentPayableBalancePkr)}</div>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-white/10 space-y-1">
                <div className="text-[10px] text-slate-400 uppercase font-bold">Lifetime Purchases</div>
                <div className="text-base font-mono font-bold text-white">{formatPkr(selectedVendorForView.totalPurchasesPkr)}</div>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-white/10 space-y-1">
                <div className="text-[10px] text-slate-400 uppercase font-bold">Credit Terms</div>
                <div className="text-base font-mono font-bold text-amber-300">{selectedVendorForView.paymentTermsDays} Days Net</div>
              </div>
            </div>

            {/* Profile Information */}
            <div className="bg-slate-950 p-4 rounded-xl border border-white/10 space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2 text-slate-300">
                <div><span className="text-slate-500">Contact Person:</span> {selectedVendorForView.contactPerson || 'Sales Desk'}</div>
                <div><span className="text-slate-500">Phone:</span> {selectedVendorForView.phone || 'N/A'}</div>
                <div><span className="text-slate-500">City:</span> {selectedVendorForView.city || 'Lahore'}</div>
                
                <div className="col-span-2"><span className="text-slate-500">Address:</span> {selectedVendorForView.address || 'Hafeez Centre Market Channel, Lahore'}</div>
                <div className="col-span-2">
                  <span className="text-slate-500">Product Lines:</span> {selectedVendorForView.productCategoriesSupplied?.join(', ') || 'PC Components & Hardware'}
                </div>
              </div>
            </div>

            {/* Associated Documents */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-white uppercase tracking-wider">Recent POs & Invoices</div>
              <div className="bg-slate-950 border border-white/10 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase font-bold">
                    <tr>
                      <th className="py-2 px-3">Doc #</th>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3 text-right">Total</th>
                      <th className="py-2 px-3 text-right">Balance</th>
                      <th className="py-2 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                    {purchaseDocs
                      .filter((d) => d.vendorId === selectedVendorForView.id || d.vendorName === selectedVendorForView.name)
                      .map((doc) => (
                        <tr
                          key={doc.id}
                          onClick={() => {
                            setSelectedVendorForView(null);
                            setSelectedDocForView(doc);
                            if (doc.balancePayablePkr > 0) {
                              setIsRecordingPayment(true);
                            }
                          }}
                          className="hover:bg-white/5 cursor-pointer transition-colors"
                          title="Click to view or record payment towards this bill"
                        >
                          <td className="py-2 px-3 font-bold text-amber-400 hover:underline">{doc.docNumber}</td>
                          <td className="py-2 px-3 text-slate-400">{doc.issueDate}</td>
                          <td className="py-2 px-3 text-right text-white">{formatPkr(doc.grandTotalPkr)}</td>
                          <td className="py-2 px-3 text-right text-red-400">{formatPkr(doc.balancePayablePkr)}</td>
                          <td className="py-2 px-3 text-center">
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/20 text-blue-300">
                              {doc.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
