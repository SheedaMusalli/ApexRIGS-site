import React, { useState, useMemo } from 'react';
import { X, Check, CreditCard, Layers, Plus, Trash2, ArrowRight, Building2, CheckCircle2, AlertCircle } from 'lucide-react';
import { api, localDate } from './SourceDocumentForm';

const money = (n: number) => `PKR ${Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export interface BatchPaymentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  documents: any[];
  banks: any[];
  customers: any[];
  vendors: any[];
  onBatchProcessed: () => void;
}

export function BatchPaymentsModal({
  isOpen,
  onClose,
  documents = [],
  banks = [],
  customers = [],
  vendors = [],
  onBatchProcessed,
}: BatchPaymentsModalProps) {
  const [activeTab, setActiveTab] = useState<'settle_docs' | 'manual_grid'>('settle_docs');
  const [filterType, setFilterType] = useState<'ALL' | 'INVOICE' | 'SUPPLIER_BILL'>('ALL');
  
  // Mode 1: Settle Outstanding Documents
  const [selectedDocIds, setSelectedDocIds] = useState<Record<string, boolean>>({});
  const [commonBankId, setCommonBankId] = useState(() => banks.find((b) => b.isActive)?.id || '');
  const [commonMode, setCommonMode] = useState<'BANK_TRANSFER' | 'CASH' | 'RAAST' | 'CHEQUE' | 'CREDIT_CARD'>('BANK_TRANSFER');
  const [commonDate, setCommonDate] = useState(localDate());
  const [commonRefPrefix, setCommonRefPrefix] = useState('BATCH-PAY');

  // Mode 2: Multi-Row Batch Journal
  const [manualRows, setManualRows] = useState<any[]>([
    {
      id: crypto.randomUUID(),
      kind: 'purchases',
      partyId: vendors[0]?.id || '',
      documentId: '',
      bankAccountId: banks[0]?.id || '',
      amount: '',
      date: localDate(),
      paymentMode: 'BANK_TRANSFER',
      reference: 'Chq-001',
    },
  ]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [successResult, setSuccessResult] = useState<any>(null);

  // Outstanding documents list
  const outstandingDocs = useMemo(() => {
    return documents.filter((d) => {
      if (['DRAFT', 'CANCELLED', 'REJECTED'].includes(d.status)) return false;
      const due = Number(d.balanceDuePkr ?? d.balancePayablePkr ?? 0);
      if (due <= 0) return false;
      if (filterType === 'ALL') return ['INVOICE', 'SUPPLIER_BILL'].includes(d.type);
      return d.type === filterType;
    });
  }, [documents, filterType]);

  // Selected documents summary
  const selectedDocs = useMemo(() => {
    return outstandingDocs.filter((d) => selectedDocIds[d.id]);
  }, [outstandingDocs, selectedDocIds]);

  const selectedTotal = useMemo(() => {
    return selectedDocs.reduce((s, d) => s + Number(d.balanceDuePkr ?? d.balancePayablePkr ?? 0), 0);
  }, [selectedDocs]);

  const toggleSelectAll = () => {
    if (selectedDocs.length === outstandingDocs.length && outstandingDocs.length > 0) {
      setSelectedDocIds({});
    } else {
      const next: Record<string, boolean> = {};
      outstandingDocs.forEach((d) => {
        next[d.id] = true;
      });
      setSelectedDocIds(next);
    }
  };

  const toggleDoc = (docId: string) => {
    setSelectedDocIds((prev) => ({
      ...prev,
      [docId]: !prev[docId],
    }));
  };

  // Submit Batch Settlement for selected documents
  const handleProcessDocBatch = async () => {
    if (!selectedDocs.length) {
      setError('Select at least one document to settle in batch.');
      return;
    }
    if (!commonBankId) {
      setError('Choose a bank or cash account for the batch settlements.');
      return;
    }

    setBusy(true);
    setError('');
    setSuccessResult(null);

    try {
      const items = selectedDocs.map((d, index) => {
        const isSales = d.kind === 'sales' || d.type === 'INVOICE';
        const balance = Number(d.balanceDuePkr ?? d.balancePayablePkr ?? 0);
        return {
          id: crypto.randomUUID(),
          kind: isSales ? 'sales' : 'purchases',
          documentId: d.id,
          bankAccountId: commonBankId,
          amount: balance,
          date: commonDate,
          paymentMode: commonMode,
          reference: `${commonRefPrefix}-${index + 1} (${d.docNumber})`,
          narration: `Batch settlement for ${d.docNumber} (${d.customerName || d.vendorName || ''})`,
        };
      });

      const res = await api('/api/erp/batch-payments', 'POST', { items });
      setSuccessResult({
        count: res.count,
        total: selectedTotal,
        items,
      });
      setSelectedDocIds({});
      onBatchProcessed();
    } catch (err: any) {
      setError(err.message || 'Failed to process batch payments');
    } finally {
      setBusy(false);
    }
  };

  // Submit Manual Multi-Row Batch
  const handleProcessManualBatch = async () => {
    const validRows = manualRows.filter((r) => Number(r.amount) > 0 && r.bankAccountId);
    if (!validRows.length) {
      setError('Add at least one valid payment row with amount and bank account.');
      return;
    }

    setBusy(true);
    setError('');
    setSuccessResult(null);

    try {
      const items = validRows.map((r) => ({
        id: crypto.randomUUID(),
        kind: r.kind,
        documentId: r.documentId || undefined,
        partyId: r.partyId || undefined,
        bankAccountId: r.bankAccountId,
        amount: Number(r.amount),
        date: r.date || localDate(),
        paymentMode: r.paymentMode,
        reference: r.reference || 'Batch Entry',
        narration: `Batch ${r.kind === 'sales' ? 'receipt' : 'payment'} entry`,
      }));

      const res = await api('/api/erp/batch-payments', 'POST', { items });
      const batchTotal = validRows.reduce((s, r) => s + Number(r.amount), 0);
      setSuccessResult({
        count: res.count,
        total: batchTotal,
        items,
      });
      setManualRows([
        {
          id: crypto.randomUUID(),
          kind: 'purchases',
          partyId: vendors[0]?.id || '',
          documentId: '',
          bankAccountId: banks[0]?.id || '',
          amount: '',
          date: localDate(),
          paymentMode: 'BANK_TRANSFER',
          reference: '',
        },
      ]);
      onBatchProcessed();
    } catch (err: any) {
      setError(err.message || 'Failed to post batch entries');
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[160] bg-black/85 backdrop-blur-sm overflow-y-auto p-4 flex items-start justify-center">
      <div className="my-6 bg-slate-900 text-slate-200 border border-white/15 rounded-3xl p-6 lg:p-8 w-full max-w-6xl space-y-6 shadow-2xl animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Treasury & Settlements
              </span>
              <span className="text-xs text-slate-400">· Fast Batch Processing</span>
            </div>
            <h2 className="text-2xl font-black text-white mt-1">Batch Payment & Settlement Center</h2>
            <p className="text-xs text-slate-400 mt-1">
              Settle multiple outstanding supplier bills or customer invoices in a single transaction, or record multi-entry payment logs.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close batch payments"
            className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-lg transition-colors"
          >
            ×
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-white/10 pb-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('settle_docs');
              setSuccessResult(null);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'settle_docs'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            Batch Settle Unpaid Documents ({outstandingDocs.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('manual_grid');
              setSuccessResult(null);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'manual_grid'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Layers className="w-4 h-4" />
            Multi-Row Batch Journal Entry
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-950/80 border border-red-500/40 text-red-200 rounded-xl text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Notice</p>
              <p className="text-xs text-red-300 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {successResult && (
          <div className="p-5 bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 rounded-2xl text-sm space-y-2">
            <div className="flex items-center gap-2 font-bold text-base text-emerald-300">
              <Check className="w-5 h-5 text-emerald-400" />
              Batch Successfully Processed ({successResult.count} Settlements)
            </div>
            <p className="text-xs text-slate-300">
              Total Settled: <span className="font-bold text-white">{money(successResult.total)}</span> across selected bank/cash accounts. All corresponding ledger records and document balances have been updated.
            </p>
          </div>
        )}

        {/* MODE 1: Batch Settle Outstanding Documents */}
        {activeTab === 'settle_docs' && (
          <div className="space-y-5">
            {/* Filter & Common Settlement Controls */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-slate-950/70 p-4 rounded-2xl border border-white/5 items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Filter Document Type</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                  className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-xs text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="ALL">All Outstanding ({outstandingDocs.length})</option>
                  <option value="SUPPLIER_BILL">Supplier Bills (Payables)</option>
                  <option value="INVOICE">Customer Invoices (Receivables)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Payment Account</label>
                <select
                  value={commonBankId}
                  onChange={(e) => setCommonBankId(e.target.value)}
                  className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-xs text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="">Choose bank / cash…</option>
                  {banks.filter((b) => b.isActive).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.accountName} (Bal: Rs {b.currentBalancePkr?.toLocaleString() || 0})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Payment Method</label>
                <select
                  value={commonMode}
                  onChange={(e) => setCommonMode(e.target.value as any)}
                  className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-xs text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="BANK_TRANSFER">Online Bank Transfer (IBFT)</option>
                  <option value="CASH">Cash on Hand</option>
                  <option value="RAAST">Raast Instant Payment</option>
                  <option value="CHEQUE">Bank Cheque</option>
                  <option value="CREDIT_CARD">Credit Card</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Payment Date</label>
                <input
                  type="date"
                  value={commonDate}
                  onChange={(e) => setCommonDate(e.target.value)}
                  className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Ref Prefix</label>
                <input
                  type="text"
                  value={commonRefPrefix}
                  onChange={(e) => setCommonRefPrefix(e.target.value)}
                  className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Document Selection Table */}
            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/40">
              <table className="w-full min-w-[700px] text-sm">
                <thead className="bg-slate-950 text-slate-400 text-xs uppercase tracking-wider border-b border-white/10">
                  <tr>
                    <th className="p-3 text-center w-12">
                      <input
                        type="checkbox"
                        checked={outstandingDocs.length > 0 && selectedDocs.length === outstandingDocs.length}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                        title="Select all"
                      />
                    </th>
                    <th className="text-left p-3">Document Number</th>
                    <th className="text-left p-3">Party (Supplier / Customer)</th>
                    <th className="text-left p-3">Issue Date</th>
                    <th className="text-right p-3">Grand Total</th>
                    <th className="text-right p-3">Outstanding Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {outstandingDocs.map((doc) => {
                    const isSelected = !!selectedDocIds[doc.id];
                    const balance = Number(doc.balanceDuePkr ?? doc.balancePayablePkr ?? 0);
                    const isBill = doc.type === 'SUPPLIER_BILL';

                    return (
                      <tr
                        key={doc.id}
                        onClick={() => toggleDoc(doc.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-amber-500/10' : 'hover:bg-white/[0.02]'
                        }`}
                      >
                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleDoc(doc.id)}
                            className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                          />
                        </td>
                        <td className="p-3 font-semibold text-white">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold mr-2 ${isBill ? 'bg-blue-500/20 text-blue-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                            {isBill ? 'Bill' : 'Invoice'}
                          </span>
                          {doc.docNumber}
                        </td>
                        <td className="p-3 text-slate-300">{doc.customerName || doc.vendorName || '—'}</td>
                        <td className="p-3 text-xs text-slate-400">{doc.issueDate}</td>
                        <td className="p-3 text-right text-slate-400">{money(doc.grandTotalPkr)}</td>
                        <td className="p-3 text-right font-bold text-amber-400">{money(balance)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {!outstandingDocs.length && (
                <div className="p-12 text-center text-slate-400 space-y-2">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400 opacity-60" />
                  <p className="font-semibold">No Outstanding Documents</p>
                  <p className="text-xs text-slate-500">All supplier bills and customer invoices are fully settled.</p>
                </div>
              )}
            </div>

            {/* Bottom Settle Action */}
            <div className="flex flex-wrap justify-between items-center bg-slate-950 p-4 rounded-2xl border border-white/10 gap-4">
              <div>
                <span className="text-xs text-slate-400">Selected for Batch Payment:</span>
                <p className="text-lg font-bold text-white">
                  {selectedDocs.length} Document{selectedDocs.length === 1 ? '' : 's'} · Total: <span className="text-amber-400">{money(selectedTotal)}</span>
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={busy || selectedDocs.length === 0}
                  onClick={handleProcessDocBatch}
                  className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-lg shadow-amber-500/20 disabled:opacity-40 flex items-center gap-2"
                >
                  {busy ? 'Processing Batch…' : `Pay Selected (${selectedDocs.length})`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODE 2: Multi-Row Batch Journal */}
        {activeTab === 'manual_grid' && (
          <div className="space-y-5">
            <div className="flex justify-between items-center">
              <p className="text-xs text-slate-400">
                Log multiple outgoing supplier payouts or customer receipts in a continuous entry grid.
              </p>
              <button
                type="button"
                onClick={() =>
                  setManualRows([
                    ...manualRows,
                    {
                      id: crypto.randomUUID(),
                      kind: 'purchases',
                      partyId: vendors[0]?.id || '',
                      documentId: '',
                      bankAccountId: banks[0]?.id || '',
                      amount: '',
                      date: localDate(),
                      paymentMode: 'BANK_TRANSFER',
                      reference: '',
                    },
                  ])
                }
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Row
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/40">
              <table className="w-full min-w-[850px] text-sm">
                <thead className="bg-slate-950 text-slate-400 text-xs uppercase tracking-wider border-b border-white/10">
                  <tr>
                    <th className="text-left p-3 w-32">Type</th>
                    <th className="text-left p-3 min-w-44">Party</th>
                    <th className="text-left p-3 min-w-44">Bank Account</th>
                    <th className="text-right p-3 w-32">Amount (PKR)</th>
                    <th className="text-left p-3 w-36">Method</th>
                    <th className="text-left p-3 w-32">Reference</th>
                    <th className="p-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {manualRows.map((row, idx) => (
                    <tr key={row.id}>
                      <td className="p-2">
                        <select
                          value={row.kind}
                          onChange={(e) => {
                            const newKind = e.target.value;
                            const newPartyId = newKind === 'sales' ? customers[0]?.id || '' : vendors[0]?.id || '';
                            setManualRows(
                              manualRows.map((r, i) => (i === idx ? { ...r, kind: newKind, partyId: newPartyId } : r))
                            );
                          }}
                          className="w-full p-2 bg-slate-900 border border-white/10 rounded-xl text-xs text-white"
                        >
                          <option value="purchases">Pay Supplier</option>
                          <option value="sales">Receive Customer</option>
                        </select>
                      </td>
                      <td className="p-2">
                        <select
                          value={row.partyId}
                          onChange={(e) =>
                            setManualRows(manualRows.map((r, i) => (i === idx ? { ...r, partyId: e.target.value } : r)))
                          }
                          className="w-full p-2 bg-slate-900 border border-white/10 rounded-xl text-xs text-white"
                        >
                          {(row.kind === 'sales' ? customers : vendors).map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <select
                          value={row.bankAccountId}
                          onChange={(e) =>
                            setManualRows(
                              manualRows.map((r, i) => (i === idx ? { ...r, bankAccountId: e.target.value } : r))
                            )
                          }
                          className="w-full p-2 bg-slate-900 border border-white/10 rounded-xl text-xs text-white"
                        >
                          {banks.filter((b) => b.isActive).map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.accountName}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          placeholder="Amount"
                          value={row.amount}
                          onChange={(e) =>
                            setManualRows(manualRows.map((r, i) => (i === idx ? { ...r, amount: e.target.value } : r)))
                          }
                          className="w-full p-2 bg-slate-900 border border-white/10 rounded-xl text-right text-xs text-amber-300 font-bold"
                        />
                      </td>
                      <td className="p-2">
                        <select
                          value={row.paymentMode}
                          onChange={(e) =>
                            setManualRows(
                              manualRows.map((r, i) => (i === idx ? { ...r, paymentMode: e.target.value } : r))
                            )
                          }
                          className="w-full p-2 bg-slate-900 border border-white/10 rounded-xl text-xs text-white"
                        >
                          <option value="BANK_TRANSFER">Bank IBFT</option>
                          <option value="CASH">Cash</option>
                          <option value="RAAST">Raast</option>
                          <option value="CHEQUE">Cheque</option>
                        </select>
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          placeholder="Ref #"
                          value={row.reference}
                          onChange={(e) =>
                            setManualRows(manualRows.map((r, i) => (i === idx ? { ...r, reference: e.target.value } : r)))
                          }
                          className="w-full p-2 bg-slate-900 border border-white/10 rounded-xl text-xs text-white"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          disabled={manualRows.length === 1}
                          onClick={() => setManualRows(manualRows.filter((_, i) => i !== idx))}
                          className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-red-500/20 hover:text-red-300 text-slate-400 disabled:opacity-20 flex items-center justify-center"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleProcessManualBatch}
                className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-lg shadow-amber-500/20 flex items-center gap-2"
              >
                {busy ? 'Posting Batch…' : `Post ${manualRows.length} Payment Entries`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
