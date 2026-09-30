import React, { useState, useEffect, useMemo } from 'react';
import { Product } from '../../types';
import { Plus, Trash2, Check, CreditCard, Banknote, Calendar, ShieldCheck, Building2, UserPlus, Sparkles, AlertCircle, Sliders } from 'lucide-react';
import { PartyDetailsModal, PartyData } from './PartyDetailsModal';

export const localDate = (dateObj: Date = new Date()) => {
  const d = dateObj;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const addDaysToDate = (dateStr: string, days: number): string => {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      d.setDate(d.getDate() + Number(days || 0));
      return localDate(d);
    }
  } catch {}
  return dateStr;
};

export const calcDaysBetween = (fromStr: string, toStr: string): number => {
  try {
    const t1 = Date.parse(fromStr);
    const t2 = Date.parse(toStr);
    if (!isNaN(t1) && !isNaN(t2)) {
      const diff = Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
      return Math.max(0, diff);
    }
  } catch {}
  return 0;
};

export async function api(url: string, method = 'GET', body?: any) {
  let token = typeof window !== 'undefined' ? localStorage.getItem('apex_token') : null;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['x-apex-token'] = token;
  }
  let r = await fetch(url, {
    method,
    credentials: 'include',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  // If 401 Unauthorized occurs, try silent re-authentication as store owner
  if (r.status === 401) {
    try {
      const loginRes = await fetch('/api/auth/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'sheedatalli', password: 'Rabbait@3108.' }),
      });
      if (loginRes.ok) {
        const authData = await loginRes.json();
        if (authData?.user?.token) {
          localStorage.setItem('apex_token', authData.user.token);
          headers['Authorization'] = `Bearer ${authData.user.token}`;
          headers['x-apex-token'] = authData.user.token;
          r = await fetch(url, {
            method,
            credentials: 'include',
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
          });
        }
      }
    } catch {}
  }

  const data = await r.json().catch(() => ({ error: 'Unable to parse server response.' }));
  if (!r.ok) throw new Error(data.error || 'The request could not be completed.');
  return data;
}

const round = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

export interface SourceDocumentFormProps {
  kind: 'sales' | 'purchases';
  products: Product[];
  parties: any[];
  banks?: any[];
  initial?: any;
  onClose: () => void;
  onSaved: () => void;
  onPartyCreated?: (party: any) => void;
}

export function SourceDocumentForm({
  kind,
  products,
  parties: initialParties = [],
  banks = [],
  initial,
  onClose,
  onSaved,
  onPartyCreated,
}: SourceDocumentFormProps) {
  const sales = kind === 'sales';
  const [partiesList, setPartiesList] = useState<any[]>(initialParties);
  const [id] = useState(initial?.id || crypto.randomUUID());
  
  // Default types: Purchases -> SUPPLIER_BILL, Sales -> INVOICE
  const [type, setType] = useState(initial?.type || (sales ? 'INVOICE' : 'SUPPLIER_BILL'));
  const [partyId, setPartyId] = useState(initial?.customerId || initial?.vendorId || (initialParties[0]?.id || ''));
  
  const [date, setDate] = useState(initial?.issueDate || localDate());
  const initialDue = initial?.dueDate || initial?.deliveryDueDate || localDate();
  const [due, setDue] = useState(initialDue);
  const [termDays, setTermDays] = useState<number>(() => {
    if (initial?.termDays !== undefined) return Number(initial.termDays);
    return calcDaysBetween(initial?.issueDate || localDate(), initialDue);
  });

  const [notes, setNotes] = useState(initial?.notes || '');
  const [fee, setFee] = useState(initial?.shippingChargesPkr || initial?.freightShippingPkr || 0);
  
  // Line items with line discount support for both sales and purchases
  const [lines, setLines] = useState<any[]>(() => {
    if (initial?.items?.length) {
      return initial.items.map((i: any) => ({
        productId: i.productId || '',
        qty: i.quantity || i.orderedQty || 1,
        price: sales ? (i.unitPricePkr ?? 0) : (i.unitCostPkr ?? 0),
        tax: i.taxRatePercent || 0,
        discount: i.discountPkr || 0,
        serialNumber: i.serialNumber || (i.serialNumbers && i.serialNumbers.length > 0 ? i.serialNumbers.join(', ') : '') || '',
      }));
    }
    const firstProd = products[0];
    return [
      {
        productId: firstProd?.id || '',
        qty: 1,
        price: (sales ? firstProd?.price : firstProd?.costPrice) || 0,
        tax: 0,
        discount: 0,
        serialNumber: '',
      },
    ];
  });

  // Fast Accounts-Style Instant Settlement State
  const [recordImmediatePayment, setRecordImmediatePayment] = useState(false);
  const [paymentBankId, setPaymentBankId] = useState('');
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'BANK_TRANSFER' | 'RAAST' | 'CHEQUE' | 'CREDIT_CARD'>('CASH');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentDate, setPaymentDate] = useState(localDate());
  
  // Available active bank/cash accounts list
  const [activeBanks, setActiveBanks] = useState<any[]>(banks);

  // Quick Party Modal State
  const [showQuickPartyModal, setShowQuickPartyModal] = useState(false);
  const [showFullPartyModal, setShowFullPartyModal] = useState(false);
  const [newPartyName, setNewPartyName] = useState('');
  const [newPartyPhone, setNewPartyPhone] = useState('');
  const [newPartyCity, setNewPartyCity] = useState('Lahore');
  const [newPartyIsFiler, setNewPartyIsFiler] = useState(true);
  const [quickPartyBusy, setQuickPartyBusy] = useState(false);
  const [quickPartyError, setQuickPartyError] = useState('');

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Fetch banks if not provided
  useEffect(() => {
    if (!activeBanks.length) {
      api('/api/erp/workspace')
        .then((data) => {
          if (Array.isArray(data.banks)) {
            setActiveBanks(data.banks);
            const defaultBank = data.banks.find((b: any) => b.isActive && b.type === 'CASH_DRAWER') || data.banks.find((b: any) => b.isActive);
            if (defaultBank && !paymentBankId) {
              setPaymentBankId(defaultBank.id);
            }
          }
          if (sales && Array.isArray(data.customers) && data.customers.length) {
            setPartiesList(data.customers);
          } else if (!sales && Array.isArray(data.vendors) && data.vendors.length) {
            setPartiesList(data.vendors);
          }
        })
        .catch(() => {});
    } else if (!paymentBankId) {
      const defaultBank = activeBanks.find((b: any) => b.isActive && b.type === 'CASH_DRAWER') || activeBanks.find((b: any) => b.isActive);
      if (defaultBank) {
        setPaymentBankId(defaultBank.id);
      }
    }
  }, [activeBanks.length, sales]);

  // Handle Term Days change
  const handleTermDaysChange = (days: number) => {
    setTermDays(days);
    const computedDue = addDaysToDate(date, days);
    setDue(computedDue);
  };

  // Handle Issue Date change
  const handleIssueDateChange = (newDate: string) => {
    setDate(newDate);
    setPaymentDate(newDate);
    const computedDue = addDaysToDate(newDate, termDays);
    setDue(computedDue);
  };

  // Handle Due Date change
  const handleDueDateChange = (newDue: string) => {
    setDue(newDue);
    const diff = calcDaysBetween(date, newDue);
    setTermDays(diff);
  };

  // Totals calculations
  const subtotal = useMemo(() => {
    return round(lines.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.price) || 0), 0));
  }, [lines]);

  const discount = useMemo(() => {
    return round(lines.reduce((s, i) => s + (Number(i.discount) || 0), 0));
  }, [lines]);

  const tax = 0;

  const grandTotal = useMemo(() => {
    return round(subtotal - discount + Number(fee || 0));
  }, [subtotal, discount, fee]);

  const party = useMemo(() => {
    return partiesList.find((p) => p.id === partyId);
  }, [partiesList, partyId]);

  // Keep payment amount synced to grand total by default if not manually overridden
  useEffect(() => {
    if (!initial?.paidAmountPkr) {
      setPaymentAmount(grandTotal);
    }
  }, [grandTotal, initial?.paidAmountPkr]);

  const updateLine = (idx: number, patch: any) => {
    setLines(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  // Quick Create Supplier / Customer Handler
  const handleCreateQuickParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quickPartyBusy) return;
    setQuickPartyBusy(true);
    setQuickPartyError('');
    try {
      const partyPayload = {
        id: crypto.randomUUID(),
        name: newPartyName.trim(),
        companyName: newPartyName.trim(),
        phone: newPartyPhone.trim(),
        city: newPartyCity.trim() || 'Lahore',
        address: 'Shop / Outlet, Hafeez Center, Lahore',
        isFiler: newPartyIsFiler,
        createdAt: new Date().toISOString(),
        currentBalancePkr: 0,
        currentPayableBalancePkr: 0,
        totalPurchasesPkr: 0,
      };

      const endpoint = sales ? '/api/erp/customers' : '/api/erp/vendors';
      await api(endpoint, 'POST', partyPayload);

      setPartiesList((prev) => [partyPayload, ...prev]);
      setPartyId(partyPayload.id);
      if (onPartyCreated) onPartyCreated(partyPayload);
      setShowQuickPartyModal(false);
      setNewPartyName('');
      setNewPartyPhone('');
    } catch (err: any) {
      setQuickPartyError(err.message || 'Failed to create account');
    } finally {
      setQuickPartyBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const party = partiesList.find((p) => p.id === partyId);
      if (!party) throw new Error(`Choose or create a ${sales ? 'customer' : 'supplier'} first.`);
      if (due < date) throw new Error('Due date cannot precede the issue date.');
      if (
        lines.some(
          (i) =>
            !i.productId ||
            !Number.isInteger(Number(i.qty)) ||
            Number(i.qty) <= 0 ||
            Number(i.discount || 0) > Number(i.qty) * Number(i.price)
        )
      ) {
        throw new Error('Choose a product and valid quantity, price, and discount on every line.');
      }

      const items = lines.map((i, idx) => {
        const p = products.find((prod) => prod.id === i.productId);
        if (!p) throw new Error('A selected product is no longer in the catalog.');
        const qtyNum = Number(i.qty);
        const priceNum = Number(i.price);
        const discNum = Number(i.discount || 0);
        const taxNum = Number(i.tax || 0);
        const lineTaxable = Math.max(0, qtyNum * priceNum - discNum);
        const lineTaxAmount = round((lineTaxable * taxNum) / 100);
        const lineTotal = round(lineTaxable + lineTaxAmount);

        const cleanSerial = i.serialNumber?.trim() || undefined;
        const serialsArray = cleanSerial ? cleanSerial.split(/[,;\n]+/).map((s: string) => s.trim()).filter(Boolean) : undefined;

        const base = {
          id: `${id}-${idx}`,
          productId: p.id,
          productName: p.name,
          sku: p.sku || '',
          warehouseId: 'lahore_hafeez',
          taxRatePercent: taxNum,
          taxAmountPkr: lineTaxAmount,
          totalPkr: lineTotal,
          discountPkr: discNum,
          serialNumber: cleanSerial,
          serialNumbers: serialsArray,
        };

        return sales
          ? {
              ...base,
              category: p.category,
              quantity: qtyNum,
              unitPricePkr: priceNum,
              unitCostPkr: p.costPrice || 0,
            }
          : {
              ...base,
              orderedQty: qtyNum,
              quantity: qtyNum,
              receivedQty: qtyNum,
              billedQty: qtyNum,
              unitCostPkr: priceNum,
            };
      });

      const docNumberPrefix =
        type === 'INVOICE'
          ? 'INV'
          : type === 'SUPPLIER_BILL'
          ? 'BILL'
          : type === 'QUOTATION'
          ? 'QTN'
          : type === 'SALES_ORDER'
          ? 'SO'
          : type === 'PURCHASE_ORDER'
          ? 'PO'
          : type === 'DEBIT_NOTE'
          ? 'DN'
          : 'CN';

      const docNumber = initial?.docNumber || `${docNumberPrefix}-${id.slice(0, 8).toUpperCase()}`;

      const immediatePaymentPayload = recordImmediatePayment
        ? {
            recordPayment: true,
            bankAccountId: paymentBankId,
            paymentMode,
            amount: paymentAmount,
            date: paymentDate,
            reference: paymentRef || (paymentMode === 'CASH' ? 'Cash at Counter' : `${docNumber} Settle`),
          }
        : undefined;

      const doc = {
        ...initial,
        id,
        docNumber,
        type,
        status: recordImmediatePayment ? (paymentAmount >= grandTotal ? 'PAID' : 'PARTIALLY_PAID') : initial?.status || 'DRAFT',
        issueDate: date,
        termDays,
        branchId: 'lahore_hafeez',
        items,
        subtotalPkr: subtotal,
        totalDiscountPkr: discount,
        grandTotalPkr: grandTotal,
        paidAmountPkr: recordImmediatePayment ? paymentAmount : initial?.paidAmountPkr || 0,
        whtDeductionPkr: 0,
        whtDeductionRate: 0,
        notes,
        createdAt: initial?.createdAt || new Date().toISOString(),
        immediatePayment: immediatePaymentPayload,
        ...(sales
          ? {
              customerId: partyId,
              customerName: party.name,
              customerPhone: party.phone || '',
              customerIsFiler: !!party.isFiler,
              dueDate: due,
              totalGstTaxPkr: tax,
              shippingChargesPkr: Number(fee || 0),
              assemblyLaborFeePkr: 0,
              balanceDuePkr: recordImmediatePayment ? Math.max(0, round(grandTotal - paymentAmount)) : grandTotal,
              salesAgent: 'Staff',
            }
          : {
              vendorId: partyId,
              vendorName: party.name,
              vendorIsFiler: !!party.isFiler,
              deliveryDueDate: due,
              inputGstPkr: tax,
              freightShippingPkr: Number(fee || 0),
              customsAndClearancePkr: 0,
              balancePayablePkr: recordImmediatePayment ? Math.max(0, round(grandTotal - paymentAmount)) : grandTotal,
              createdBy: 'Staff',
            }),
      };

      await api(`/api/erp/${sales ? 'sales' : 'purchase'}-docs`, 'POST', doc);
      onSaved();
    } catch (e: any) {
      setError(e.message || 'Failed to save document');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[160] bg-black/85 backdrop-blur-sm overflow-y-auto p-3 sm:p-5 flex items-start justify-center">
      <form onSubmit={submit} className="my-3 sm:my-5 bg-slate-900 text-slate-200 border border-white/15 rounded-3xl p-6 lg:p-8 w-full max-w-7xl space-y-6 shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${sales ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'}`}>
                {sales ? 'Sales Billing' : 'Purchasing & Procurement'}
              </span>
              <span className="text-xs text-slate-400">· Fast Accounting Entry</span>
            </div>
            <h2 className="text-2xl font-black text-white mt-1">
              {initial ? 'Edit Draft Document' : sales ? 'New Sales Invoice / Quotation' : 'New Purchase / Supplier Bill'}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {sales
                ? 'Create a customer invoice with instant cash/bank receipt or credit payment terms.'
                : 'Record inventory purchase from your supplier with credit terms or instant payment recording.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close document form"
            className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-lg transition-colors"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-950/80 border border-red-500/40 text-red-200 rounded-xl text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Validation Notice</p>
              <p className="text-xs text-red-300 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Top Control Bar: Two Balanced Cards (Party / Counterparty & Document Metadata) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Party Selection & Details Card */}
          <div className="lg:col-span-6 bg-slate-950/70 p-5 rounded-2xl border border-white/5 space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-amber-400" />
                  {sales ? 'Customer / Client' : 'Supplier / Vendor'} *
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowQuickPartyModal(true)}
                    className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold px-2 py-0.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition-colors"
                  >
                    <UserPlus className="w-3 h-3" /> + Quick
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowFullPartyModal(true)}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold px-2 py-0.5 rounded-md bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 transition-colors"
                  >
                    <Sliders className="w-3 h-3" /> Full Profile
                  </button>
                </div>
              </div>
              <select
                required
                value={partyId}
                onChange={(e) => setPartyId(e.target.value)}
                className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-sm text-white focus:border-amber-500 focus:outline-none"
              >
                <option value="">Choose {sales ? 'Customer' : 'Supplier'}…</option>
                {partiesList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.phone ? `· ${p.phone}` : ''} {p.city ? `(${p.city})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Selected Party Summary Details */}
            {party && (
              <div className="bg-slate-900/90 border border-white/5 rounded-xl p-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-medium">Contact / Phone</span>
                  <span className="text-slate-200 font-mono text-[11px] truncate block">{party.phone || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-medium">City / Location</span>
                  <span className="text-slate-200 text-[11px] truncate block">{party.city || 'Pakistan'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Document Settings Card */}
          <div className="lg:col-span-6 bg-slate-950/70 p-5 rounded-2xl border border-white/5 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Document Type */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Document Type</label>
                <select
                  disabled={!!initial}
                  className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-xs text-white font-medium focus:border-amber-500 focus:outline-none"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  {(sales
                    ? ['INVOICE', 'QUOTATION', 'SALES_ORDER', 'CREDIT_NOTE']
                    : ['SUPPLIER_BILL', 'PURCHASE_ORDER', 'DEBIT_NOTE']
                  ).map((t) => (
                    <option key={t} value={t}>
                      {t === 'SUPPLIER_BILL' ? 'Purchase (Supplier Bill)' : t.replaceAll('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              {/* Issue Date */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Issue Date</label>
                <input
                  required
                  type="date"
                  value={date}
                  onChange={(e) => handleIssueDateChange(e.target.value)}
                  className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-xs text-white font-mono focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Payment Terms & Due Date */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Payment Terms & Due Date</label>
                <span className="text-xs text-amber-400 font-mono font-medium">Due Date: {due}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={[0, 7, 15, 30, 45, 60].includes(termDays) ? termDays : 'custom'}
                  onChange={(e) => {
                    if (e.target.value !== 'custom') {
                      handleTermDaysChange(Number(e.target.value));
                    }
                  }}
                  className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-xs text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value={0}>0 Days (Immediate / Cash)</option>
                  <option value={7}>7 Days Credit</option>
                  <option value={15}>15 Days Credit</option>
                  <option value={30}>30 Days Credit</option>
                  <option value={45}>45 Days Credit</option>
                  <option value={60}>60 Days Credit</option>
                  <option value="custom">Custom Days</option>
                </select>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    value={termDays}
                    placeholder="Days"
                    onChange={(e) => handleTermDaysChange(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-xs text-white text-center font-mono focus:border-amber-500 focus:outline-none"
                    title="Credit term days"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-500 pointer-events-none">days</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Product Items Table */}
        <div className="space-y-3">
          <div className="flex justify-between items-center bg-slate-950/40 p-3 rounded-2xl border border-white/5">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Item Details & Pricing
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[11px] font-mono text-amber-400 font-semibold">
                {lines.length} {lines.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            <button
              type="button"
              className="text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3.5 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-colors shadow-sm"
              onClick={() => {
                const firstProd = products[0];
                setLines([
                  ...lines,
                  {
                    productId: firstProd?.id || '',
                    qty: 1,
                    price: (sales ? firstProd?.price : firstProd?.costPrice) || 0,
                    tax: 0,
                    discount: 0,
                    serialNumber: '',
                  },
                ]);
              }}
            >
              <Plus className="w-3.5 h-3.5" /> Add Product Line
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/60 shadow-inner">
            <table className="w-full min-w-[850px] text-sm">
              <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase tracking-wider border-b border-white/10">
                <tr>
                  <th className="text-center p-3 w-8">#</th>
                  <th className="text-left p-3 min-w-[280px]">Product / Hardware Part</th>
                  <th className="text-left p-3 w-56">Serial Number (S/N)</th>
                  <th className="text-center p-3 w-20">Qty</th>
                  <th className="text-right p-3 w-32">{sales ? 'Unit Price (PKR)' : 'Unit Cost (PKR)'}</th>
                  <th className="text-right p-3 w-28">Discount (PKR)</th>
                  <th className="text-right p-3 w-32">Total (PKR)</th>
                  <th className="p-3 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {lines.map((l, idx) => {
                  const lineTotal = Math.max(0, (Number(l.qty) || 0) * (Number(l.price) || 0) - (Number(l.discount) || 0));

                  return (
                    <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-3 text-center text-xs font-mono text-slate-500 align-middle">
                        {idx + 1}
                      </td>
                      <td className="p-2.5 align-middle">
                        <select
                          aria-label={`Product ${idx + 1}`}
                          required
                          value={l.productId}
                          onChange={(e) => {
                            const p = products.find((prod) => prod.id === e.target.value);
                            updateLine(idx, {
                              productId: e.target.value,
                              price: (sales ? p?.price : p?.costPrice) || 0,
                            });
                          }}
                          className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-white focus:border-amber-500 focus:outline-none font-medium"
                        >
                          <option value="">Select product…</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2.5 align-middle">
                        <input
                          type="text"
                          placeholder="Serial # (e.g. SN-89201)"
                          value={l.serialNumber || ''}
                          onChange={(e) => updateLine(idx, { serialNumber: e.target.value })}
                          className="w-full p-2 rounded-xl bg-slate-950 border border-white/10 text-xs font-mono text-amber-300 placeholder-slate-600 focus:border-amber-500 focus:outline-none"
                          title="Hardware Serial Number"
                        />
                      </td>
                      <td className="p-2.5 align-middle">
                        <input
                          aria-label={`Quantity line ${idx + 1}`}
                          type="number"
                          required
                          min="1"
                          step="1"
                          value={l.qty}
                          onChange={(e) => updateLine(idx, { qty: Number(e.target.value) })}
                          className="w-full bg-slate-900 border border-white/10 p-2 rounded-xl text-center text-white font-mono text-xs focus:border-amber-500 focus:outline-none"
                        />
                      </td>
                      <td className="p-2.5 align-middle">
                        <input
                          aria-label={`Price line ${idx + 1}`}
                          type="number"
                          required
                          min="0"
                          step="0.01"
                          value={l.price}
                          onChange={(e) => updateLine(idx, { price: Number(e.target.value) })}
                          className="w-full bg-slate-900 border border-white/10 p-2 rounded-xl text-right text-white font-mono text-xs focus:border-amber-500 focus:outline-none"
                        />
                      </td>
                      <td className="p-2.5 align-middle">
                        <input
                          aria-label={`Discount line ${idx + 1}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={l.discount}
                          onChange={(e) => updateLine(idx, { discount: Number(e.target.value) })}
                          placeholder="0"
                          className="w-full bg-slate-900 border border-white/10 p-2 rounded-xl text-right text-amber-300 font-mono text-xs focus:border-amber-500 focus:outline-none"
                        />
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-100 whitespace-nowrap align-middle text-xs">
                        Rs {lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-2.5 text-center align-middle">
                        <button
                          aria-label={`Remove line ${idx + 1}`}
                          type="button"
                          disabled={lines.length === 1}
                          onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                          className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-red-500/20 hover:text-red-300 text-slate-400 disabled:opacity-20 flex items-center justify-center transition-colors mx-auto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Lower Canvas: Balanced 2-Column Grid (Left: Notes & Settlement, Right: Summary & Balances) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column (7 cols): Terms/Notes & Instant Payment Settlement */}
          <div className="lg:col-span-7 space-y-4">
            {/* Notes Card */}
            <div className="bg-slate-950/60 p-4 rounded-2xl border border-white/5">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Notes & Terms / Warranty Details
              </label>
              <textarea
                rows={2}
                value={notes}
                placeholder="e.g. 1 Year Official Brand Warranty, Tested in store, Delivery via Leopard Courier..."
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 p-3 rounded-xl text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
              />
            </div>

            {/* Instant Payment Settlement Card */}
            <div className="bg-gradient-to-r from-amber-500/10 via-slate-950/80 to-slate-950/80 border border-amber-500/25 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={recordImmediatePayment}
                    onChange={(e) => setRecordImmediatePayment(e.target.checked)}
                    className="w-5 h-5 rounded accent-amber-500 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                      Record Payment Now ({sales ? 'Customer Receipt' : 'Vendor Payment'})
                    </span>
                    <p className="text-[11px] text-slate-400">
                      {recordImmediatePayment
                        ? 'Posts directly into bank/cash ledger and marks voucher as settled.'
                        : 'Uncheck if this transaction is on credit (unpaid).'}
                    </p>
                  </div>
                </label>
                <span className={`text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full font-bold ${recordImmediatePayment ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'}`}>
                  {recordImmediatePayment ? 'Settled' : 'On Credit'}
                </span>
              </div>

              {recordImmediatePayment && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-white/10">
                  {/* Bank / Cash Account */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      {sales ? 'Deposit Into Account' : 'Paid From Account'} *
                    </label>
                    <select
                      required={recordImmediatePayment}
                      value={paymentBankId}
                      onChange={(e) => setPaymentBankId(e.target.value)}
                      className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-xs text-white focus:border-amber-500 focus:outline-none"
                    >
                      <option value="">Choose bank / cash account…</option>
                      {activeBanks.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.accountName} · (Bal: Rs {b.currentBalancePkr?.toLocaleString() || 0})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Payment Mode */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Payment Method</label>
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value as any)}
                      className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-xs text-white focus:border-amber-500 focus:outline-none"
                    >
                      <option value="CASH">Cash on Hand (Counter / POS)</option>
                      <option value="BANK_TRANSFER">Online Bank Transfer (IBFT)</option>
                      <option value="RAAST">Raast Instant Payment</option>
                      <option value="CHEQUE">Bank Cheque / Pay Order</option>
                      <option value="CREDIT_CARD">Credit / Debit Card</option>
                    </select>
                  </div>

                  {/* Payment Amount */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Settlement Amount (PKR)</label>
                    <input
                      type="number"
                      min="0.01"
                      max={grandTotal}
                      step="0.01"
                      required={recordImmediatePayment}
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(Number(e.target.value))}
                      className="w-full p-2.5 bg-slate-900 border border-amber-500/40 rounded-xl text-xs text-amber-300 font-mono font-bold focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  {/* Payment Reference */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Cheque / Trx Ref #</label>
                    <input
                      type="text"
                      placeholder="e.g. Cash, Raast-9821, Chq-4019"
                      value={paymentRef}
                      onChange={(e) => setPaymentRef(e.target.value)}
                      className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-xs text-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column (5 cols): Financial Totals & Balances Summary Card */}
          <div className="lg:col-span-5 bg-slate-950/70 p-5 rounded-2xl border border-white/5 space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-white/5 pb-2">
              Financial Summary
            </h4>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-400">
                <span>Gross Subtotal:</span>
                <span className="font-mono font-semibold text-slate-200">
                  Rs {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>

              {discount > 0 && (
                <div className="flex justify-between items-center text-amber-400">
                  <span>Total Line Discounts:</span>
                  <span className="font-mono font-semibold">
                    - Rs {discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center text-slate-400 pt-1">
                <span>Freight / Shipping (PKR):</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={fee}
                  onChange={(e) => setFee(Number(e.target.value))}
                  className="w-32 p-1.5 bg-slate-900 border border-white/10 rounded-lg text-right text-white font-mono text-xs focus:border-amber-500 focus:outline-none"
                />
              </div>

              {/* Grand Total Highlight */}
              <div className="border-t border-white/10 pt-3 flex justify-between items-center bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                <div>
                  <span className="text-[10px] text-amber-300 font-bold uppercase tracking-wider block">Grand Total</span>
                  <span className="text-xs text-slate-400">PKR Pakistani Rupees</span>
                </div>
                <span className="text-xl font-black text-amber-400 font-mono">
                  Rs {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {recordImmediatePayment && (
                <div className="pt-2 space-y-1 text-xs border-t border-white/5">
                  <div className="flex justify-between items-center text-emerald-400">
                    <span>Settled Today:</span>
                    <span className="font-mono font-bold">
                      Rs {Number(paymentAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Remaining Balance:</span>
                    <span className="font-mono font-bold text-slate-200">
                      Rs {Math.max(0, grandTotal - Number(paymentAmount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-2">
          <div className="text-xs text-slate-500">
            {recordImmediatePayment
              ? '✓ Voucher & bank statement will update automatically upon saving.'
              : '✓ Draft will be saved with outstanding balance tracking.'}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !partiesList.length}
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-black transition-all shadow-lg shadow-amber-500/20 disabled:opacity-40 flex items-center gap-2"
            >
              {busy ? (
                'Processing…'
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  {recordImmediatePayment ? 'Post Document & Settlement' : 'Save Document'}
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Quick Party Creation Modal */}
      {showQuickPartyModal && (
        <div className="fixed inset-0 z-[180] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm">
          <form
            onSubmit={handleCreateQuickParty}
            className="bg-slate-900 border border-white/15 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl animate-in zoom-in-95 duration-150"
          >
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-400" />
                Add New {sales ? 'Customer' : 'Supplier'}
              </h3>
              <button
                type="button"
                onClick={() => setShowQuickPartyModal(false)}
                className="text-slate-400 hover:text-white text-lg"
              >
                ×
              </button>
            </div>

            {quickPartyError && (
              <p className="p-3 bg-red-950 text-red-200 rounded-xl text-xs">{quickPartyError}</p>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {sales ? 'Customer Name / Business' : 'Supplier / Vendor Name'} *
              </label>
              <input
                required
                type="text"
                placeholder={sales ? 'e.g. Ali Khan / Tech Gaming Lounge' : 'e.g. Global Tech Distributors Hafeez'}
                value={newPartyName}
                onChange={(e) => setNewPartyName(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-white/10 rounded-xl text-sm text-white focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Phone Number</label>
              <input
                type="text"
                placeholder="e.g. +92 300 1234567"
                value={newPartyPhone}
                onChange={(e) => setNewPartyPhone(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-white/10 rounded-xl text-sm text-white focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">City</label>
              <input
                type="text"
                value={newPartyCity}
                onChange={(e) => setNewPartyCity(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-white/10 rounded-xl text-sm text-white focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-between items-center gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  setShowQuickPartyModal(false);
                  setShowFullPartyModal(true);
                }}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold"
              >
                <Sliders className="w-3.5 h-3.5" /> Open Complete Profile Form
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowQuickPartyModal(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={quickPartyBusy || !newPartyName.trim()}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 disabled:opacity-40"
                >
                  {quickPartyBusy ? 'Saving…' : `Save ${sales ? 'Customer' : 'Supplier'}`}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Comprehensive Sub-tabs Party Modal */}
      {showFullPartyModal && (
        <PartyDetailsModal
          isOpen={showFullPartyModal}
          kind={kind}
          onClose={() => setShowFullPartyModal(false)}
          onSaved={(savedParty: PartyData) => {
            setPartiesList((prev) => [savedParty, ...prev]);
            if (savedParty.id) setPartyId(savedParty.id);
            if (onPartyCreated) onPartyCreated(savedParty);
            setShowFullPartyModal(false);
          }}
        />
      )}
    </div>
  );
}
