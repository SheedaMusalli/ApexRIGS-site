import React, { useEffect, useState } from 'react';
import type { BankAccount, SalesDocument } from '../../types/erp';
import { erpStorage } from '../../services/erpStorage';

export function InvoiceReceiptModal({ invoice, onClose, onSaved }: { invoice: SalesDocument; onClose: () => void; onSaved: (invoice: SalesDocument) => void }) {
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [bankId, setBankId] = useState('');
  const [amount, setAmount] = useState(invoice.balanceDuePkr);
  const [reference, setReference] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [id] = useState(() => crypto.randomUUID());
  useEffect(() => { erpStorage.refreshTreasury().then(() => {
    const accounts = erpStorage.getBankAccounts().filter(a => a.isActive);
    setBanks(accounts); setBankId(accounts[0]?.id || '');
  }).catch(e => setError(e.message)); }, []);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (busy) return; setBusy(true); setError('');
    try {
      const response = await fetch(`/api/erp/sales-docs/${encodeURIComponent(invoice.id)}/receipts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, bankAccountId: bankId, amount, date, reference }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Receipt could not be saved.');
      await erpStorage.refreshTreasury();
      onSaved(data.doc);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return <div className="fixed inset-0 z-[150] bg-black/80 flex items-center justify-center p-4">
    <form onSubmit={submit} className="w-full max-w-md bg-slate-900 border border-white/20 rounded-2xl p-6 space-y-4 text-white">
      <h2 className="font-bold text-lg">Receive payment — {invoice.docNumber}</h2>
      <p className="text-sm text-slate-400">Outstanding: PKR {invoice.balanceDuePkr.toLocaleString()}</p>
      {error && <p role="alert" className="text-red-300">{error}</p>}
      <label className="block">Bank / cash account<select aria-label="Receipt bank account" required value={bankId} onChange={e => setBankId(e.target.value)} className="block w-full bg-slate-950 p-2 rounded">{banks.map(b => <option key={b.id} value={b.id}>{b.accountName}</option>)}</select></label>
      <label className="block">Amount (PKR)<input aria-label="Receipt amount" required type="number" min="0.01" step="0.01" max={invoice.balanceDuePkr} value={amount} onChange={e => setAmount(Number(e.target.value))} className="block w-full bg-slate-950 p-2 rounded" /></label>
      <label className="block">Date<input required type="date" value={date} onChange={e => setDate(e.target.value)} className="block w-full bg-slate-950 p-2 rounded" /></label>
      <label className="block">Reference<input value={reference} onChange={e => setReference(e.target.value)} className="block w-full bg-slate-950 p-2 rounded" /></label>
      <div className="flex justify-end gap-3"><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button disabled={busy || !bankId} className="bg-amber-500 text-slate-950 px-4 py-2 rounded font-bold">{busy ? 'Saving…' : 'Post receipt'}</button></div>
    </form>
  </div>;
}
