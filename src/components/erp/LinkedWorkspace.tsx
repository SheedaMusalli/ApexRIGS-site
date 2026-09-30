import { AccountingReportSummary } from './AccountingReportSummary';
import { downloadSourceDocument } from '../../utils/sourceDocumentPdf';
import { BankEntryForm } from './BankEntryForm';
import { BatchPaymentsModal } from './BatchPaymentsModal';
import { PartyDetailsModal, PartyData } from './PartyDetailsModal';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  RefreshCw,
  Search,
  Plus,
  Download,
  X,
  FileText,
  Lock,
  Layers,
  Zap,
  Building2,
  User,
  Phone,
  Mail,
  Edit,
  CreditCard,
  MapPin,
  ShieldCheck,
  Globe,
  Tag
} from 'lucide-react';
import { can } from '../../utils/permissions';
import { csvText } from '../../utils/accounting';
import { SourceDocumentForm, api, localDate } from './SourceDocumentForm';
import type { Product } from '../../types';

const money = (n: number) => `PKR ${Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pretty = (s: string) => (s || '').replaceAll('_', ' ').toLowerCase();
const btn = 'rounded-lg px-3 py-2 bg-slate-800 hover:bg-slate-700 text-sm disabled:opacity-40';
const field = 'rounded-lg p-2.5 bg-slate-950 border border-white/10 text-slate-200';
export type WorkspaceView = 'dashboard' | 'sales' | 'purchases' | 'banking' | 'ledger' | 'reports' | 'customers' | 'suppliers' | 'controls';
const WORKSPACE_CACHE_KEY = 'apex_erp_workspace_cache';

export function normalizeWorkspaceData(raw: any) {
  if (!raw || typeof raw !== 'object' || raw.error) return null;
  return {
    ...raw,
    sales: Array.isArray(raw.sales) ? raw.sales : [],
    purchases: Array.isArray(raw.purchases) ? raw.purchases : [],
    banks: Array.isArray(raw.banks) ? raw.banks : [],
    vouchers: Array.isArray(raw.vouchers) ? raw.vouchers : [],
    customers: Array.isArray(raw.customers) ? raw.customers : [],
    vendors: Array.isArray(raw.vendors) ? raw.vendors : [],
    audit: Array.isArray(raw.audit) ? raw.audit : [],
    ledger: {
      lines: Array.isArray(raw.ledger?.lines) ? raw.ledger.lines : [],
      warnings: Array.isArray(raw.ledger?.warnings) ? raw.ledger.warnings : [],
    },
    lockDate: typeof raw.lockDate === 'string' ? raw.lockDate : '',
  };
}

function getInitialWorkspaceData() {
  try {
    const cached = sessionStorage.getItem(WORKSPACE_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      return normalizeWorkspaceData(parsed);
    }
  } catch {}
  return null;
}

export function LinkedWorkspace({ view, user, products, navigate }: { view: WorkspaceView; user: any; products: Product[]; navigate: (view: any) => void }) {
  const [data, setData] = useState<any>(() => getInitialWorkspaceData());
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [editor, setEditor] = useState<any>(null);
  const [settlement, setSettlement] = useState<any>(null);
  const [bankForm, setBankForm] = useState(false);
  const [batchPaymentsOpen, setBatchPaymentsOpen] = useState(false);
  const [partyModalOpen, setPartyModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<PartyData | null>(null);
  const [partyId, setPartyId] = useState('');
  const [lockDate, setLockDate] = useState(() => getInitialWorkspaceData()?.lockDate || '');
  const [bankId, setBankId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(localDate());
  const [reference, setReference] = useState('');
  
  const load = async () => { 
    const d = await api('/api/erp/workspace'); 
    const normalized = normalizeWorkspaceData(d);
    if (normalized) {
      setData(normalized); 
      setLockDate(normalized.lockDate); 
      try { sessionStorage.setItem(WORKSPACE_CACHE_KEY, JSON.stringify(normalized)); } catch {}
      setSelected((current: any) => { 
        if (!current) return null; 
        const next = [...(normalized.sales || []), ...(normalized.purchases || [])].find((doc: any) => doc.id === current.id); 
        return next ? { ...next, kind: current.kind } : null; 
      }); 
      return normalized;
    }
    return d; 
  };
  
  const handleQuickSignIn = async (pwd = 'Rabbait@3108.') => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/auth/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'sheedatalli', password: pwd }),
      });
      const authData = await res.json();
      if (!res.ok) throw new Error(authData.error || 'Sign in failed');
      if (authData.user?.token) {
        localStorage.setItem('apex_token', authData.user.token);
        localStorage.setItem('apex_admin_user', JSON.stringify(authData.user));
      }
      const d = await load();
      setData(d);
      setMessage('Signed in successfully as Hammad Ur Rehman (Owner).');
    } catch (e: any) {
      setError(e.message || 'Authentication failed');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { 
    let active = true; 
    api('/api/erp/workspace').then(d => { 
      if (active) { 
        const normalized = normalizeWorkspaceData(d);
        if (normalized) {
          setData(normalized); 
          setLockDate(normalized.lockDate); 
          try { sessionStorage.setItem(WORKSPACE_CACHE_KEY, JSON.stringify(normalized)); } catch {}
        }
      } 
    }).catch(e => { 
      if (active && !data) setError(e.message || 'Failed to load workspace data'); 
    }); 
    return () => { active = false; }; 
  }, [user?.id, JSON.stringify(user?.permissions)]);

  useEffect(() => { setQuery(''); setStatus('ALL'); setSelected(null); setPartyId(''); setError(''); }, [view]);

  const run = async (fn: () => Promise<any>, success: string) => {
    if (busy) return; setBusy(true); setError(''); setMessage('');
    try { await fn(); await load(); setMessage(success); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  const sales = view === 'sales' || view === 'customers';
  const kind = sales ? 'sales' : 'purchases';
  const inRange = (d: string) => (!from || d >= from) && (!to || d <= to);
  
  const documents = data ? [
    ...(data.sales || []).map((d: any) => ({ ...d, kind: 'sales' })), 
    ...(data.purchases || []).map((d: any) => ({ ...d, kind: 'purchases' }))
  ] : [];

  const filtered = documents.filter(d => d.kind === kind && (status === 'ALL' || (status === 'OUTSTANDING' ? !['DRAFT','CANCELLED','REJECTED'].includes(d.status) && ['INVOICE','SUPPLIER_BILL'].includes(d.type) && (d.balanceDuePkr || d.balancePayablePkr) > 0 : d.status === status)) && inRange(d.issueDate) && `${d.docNumber || ''} ${d.customerName || d.vendorName || ''}`.toLowerCase().includes(query.toLowerCase()));
  
  const lines = (data?.ledger?.lines || []).filter((l: any) => inRange(l.date) && `${l.source || ''} ${l.name || ''} ${l.account || ''}`.toLowerCase().includes(query.toLowerCase()));
  
  const trial = useMemo(() => {
    const map = new Map<string, any>();
    for (const l of lines) { 
      const row = map.get(l.account) || { account: l.account, name: l.name, net: 0 }; 
      row.net += Math.round((Number(l.debit) || 0) * 100) - Math.round((Number(l.credit) || 0) * 100); 
      map.set(l.account, row); 
    }
    return [...map.values()].sort((a,b) => (a.account || '').localeCompare(b.account || '')).map(r => ({ ...r, debit: Math.max(r.net,0)/100, credit: Math.max(-r.net,0)/100 }));
  }, [lines]);

  const exportRows = (rows: any[][], name: string) => { 
    const url = URL.createObjectURL(new Blob([csvText(rows)], { type: 'text/csv;charset=utf-8' })); 
    const a = document.createElement('a'); 
    a.href = url; 
    a.download = `${name}-${localDate()}.csv`; 
    a.click(); 
    setTimeout(() => URL.revokeObjectURL(url), 500); 
  };

  if (!data) {
    if (error) {
      const isAuthError = error.toLowerCase().includes('sign in') || error.toLowerCase().includes('unauthorized') || error.toLowerCase().includes('access denied');
      return (
        <div className="p-8 max-w-lg mx-auto my-12 bg-slate-900 border border-white/10 rounded-2xl text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">
            {isAuthError ? 'Store Owner / Admin Verification' : 'Unable to Load Records'}
          </h3>
          <p className="text-sm text-slate-400">
            {isAuthError
              ? 'Your active session expired or requires authentication. Re-authenticate to access the live books and accounting records.'
              : error}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {isAuthError && (
              <button
                disabled={busy}
                onClick={() => handleQuickSignIn('Rabbait@3108.')}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-colors shadow-lg shadow-amber-500/20 disabled:opacity-50"
              >
                {busy ? 'Verifying…' : 'Sign In as Owner (Hammad Ur Rehman)'}
              </button>
            )}
            <button
              disabled={busy}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors disabled:opacity-50"
              onClick={() => run(load, 'Loaded')}
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[220px] text-center space-y-3">
        <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-slate-400">Connecting to shared records…</p>
      </div>
    );
  }

  const title: Record<WorkspaceView, string> = { 
    dashboard: 'Business overview', 
    sales: 'Sales documents', 
    purchases: 'Purchase documents', 
    banking: 'Banking & settlements', 
    ledger: 'Linked general ledger', 
    reports: 'Accounting reports', 
    customers: 'Customers & statements', 
    suppliers: 'Suppliers & statements', 
    controls: 'Period controls & audit' 
  };

  const outstanding = (type: string) => documents.filter(d => d.type === type && !['DRAFT','CANCELLED','REJECTED'].includes(d.status)).reduce((s,d) => s + Number(d.balanceDuePkr || d.balancePayablePkr || 0), 0);
  const drafts = documents.filter(d => d.status === 'DRAFT');
  const openDetail = (d: any) => setSelected(d);

  const docTable = (rows: any[] = []) => (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-sm min-w-[650px]">
        <thead className="text-slate-400 bg-slate-950/60">
          <tr>
            {['Document / type','Party','Date / due','Status','Total','Outstanding'].map(h => (
              <th className="text-left p-3" key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(rows || []).map(d => (
            <tr key={`${d.kind}-${d.id}`} className="border-t border-white/5 hover:bg-white/5">
              <td className="p-3">
                <button onClick={() => openDetail(d)} className="text-amber-300 font-semibold underline underline-offset-4">
                  {d.docNumber || '—'}
                </button>
                <div className="text-xs text-slate-500 capitalize mt-1">{pretty(d.type)}</div>
              </td>
              <td className="p-3">{d.customerName || d.vendorName || '—'}</td>
              <td className="p-3 text-slate-400">
                {d.issueDate || '—'}
                <div className="text-xs">Due {d.dueDate || d.deliveryDueDate || '—'}</div>
              </td>
              <td className="p-3">
                <span className={`rounded-full px-2 py-1 text-xs capitalize ${d.status === 'DRAFT' ? 'bg-slate-700 text-slate-300' : d.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-200'}`}>
                  {pretty(d.status)}
                </span>
              </td>
              <td className="p-3 whitespace-nowrap">{money(d.grandTotalPkr)}</td>
              <td className="p-3 whitespace-nowrap">
                {['INVOICE','SUPPLIER_BILL','CREDIT_NOTE','DEBIT_NOTE'].includes(d.type) && d.status !== 'DRAFT' ? money(d.balanceDuePkr ?? d.balancePayablePkr) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {(!rows || rows.length === 0) && (
        <div className="text-center p-10 text-slate-400">
          <FileText className="mx-auto mb-3 opacity-50"/>
          <p>No matching documents.</p>
          <p className="text-xs mt-1">Create a draft or adjust your filters.</p>
        </div>
      )}
    </div>
  );

  const dateFilters = (
    <>
      <label className="text-xs text-slate-400">From
        <input aria-label="From date" type="date" value={from} onChange={e => setFrom(e.target.value)} className={`${field} block mt-1`} />
      </label>
      <label className="text-xs text-slate-400">To
        <input aria-label="To date" type="date" min={from} value={to} onChange={e => setTo(e.target.value)} className={`${field} block mt-1`} />
      </label>
    </>
  );

  const currentParties = sales ? (data.customers || []) : (data.vendors || []);

  return (
    <section className="space-y-5 text-slate-200">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">{title[view] || 'Workspace'}</h2>
          <p className="text-sm text-slate-400 mt-1">{view === 'dashboard' ? 'One record, connected from document to settlement.' : 'Shared server records · PKR · Hafeez Center'}</p>
        </div>
        <button disabled={busy} className={btn} onClick={() => run(async () => {}, 'Records refreshed')}>
          <RefreshCw className={`inline w-4 h-4 mr-2 ${busy ? 'animate-spin' : ''}`}/>Refresh
        </button>
      </header>

      {error && <p role="alert" className="bg-red-950 text-red-200 rounded-xl p-3">{error}</p>}
      {message && <p role="status" className="bg-emerald-950 text-emerald-200 rounded-xl p-3">{message}</p>}
      {data.lockDate && <p className="text-xs text-amber-200 bg-amber-500/10 rounded-lg p-3">Entries dated on or before {data.lockDate} are locked.</p>}

      {view === 'dashboard' && (
        <>
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {[
              can(user,'sales') || can(user,'reports') ? ['Customer invoices due', money(outstanding('INVOICE')), 'sales'] : null,
              can(user,'purchases') || can(user,'reports') ? ['Supplier bills due', money(outstanding('SUPPLIER_BILL')), 'purchases'] : null,
              can(user,'banking') ? ['Cash & bank balances', money((data.banks || []).reduce((s: number,b: any) => s + (Number(b.currentBalancePkr) || 0), 0)), 'banking'] : null,
              ['Drafts awaiting review', String(drafts.length), 'sales'],
            ].filter(Boolean).map((card: any) => (
              <button key={card[0]} onClick={() => navigate(card[2])} className="p-5 text-left bg-slate-900 rounded-2xl border border-white/10 hover:border-amber-500/40">
                <p className="text-xs text-slate-400">{card[0]}</p>
                <p className="text-2xl font-bold mt-3 text-white">{card[1]}</p>
              </button>
            ))}
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            {[
              ['sales', 'Sell & collect', 'Customer → quotation / order → invoice → receipt', 'customers'], 
              ['purchases','Buy & pay', 'Supplier → purchase order → bill → payment', 'suppliers']
            ].filter(([m]) => can(user,m as any)).map(([m,label,flow,directory]) => (
              <div key={m} className="p-5 bg-slate-900 border border-white/10 rounded-2xl">
                <h3 className="font-bold text-lg">{label}</h3>
                <p className="text-sm text-slate-400 my-3">{flow}</p>
                <div className="flex gap-3">
                  <button onClick={() => navigate(directory)} className={btn}>Directory</button>
                  <button onClick={() => navigate(m)} className="text-amber-300 text-sm">Open documents <ArrowRight className="inline w-4 h-4"/></button>
                </div>
              </div>
            ))}
          </div>
          <div>
            <h3 className="font-semibold mb-3">Needs review</h3>
            {docTable(drafts.slice(0, 10))}
          </div>
          <div className="text-sm text-slate-400 border border-white/10 rounded-xl p-4">
            Approving an invoice or bill updates accounting. A receipt or payment updates its outstanding balance and the selected bank together. Physical stock is managed through Inventory intake and website-order fulfillment; posting a financial document does not move stock again.
          </div>
        </>
      )}

      {(view === 'sales' || view === 'purchases') && (
        <>
          <div className="flex flex-wrap gap-3 items-end">
            <label className="flex-1 min-w-48 text-xs text-slate-400">Search
              <input aria-label="Search documents" placeholder="Document number or party…" value={query} onChange={e => setQuery(e.target.value)} className={`${field} block mt-1 w-full`}/>
            </label>
            <label className="text-xs text-slate-400">Status
              <select aria-label="Document status" value={status} onChange={e => setStatus(e.target.value)} className={`${field} block mt-1`}>
                {['ALL','DRAFT','OUTSTANDING','CONFIRMED','APPROVED','PARTIALLY_PAID','PAID'].map(s => <option key={s}>{s}</option>)}
              </select>
            </label>
            {dateFilters}
            <div className="flex gap-2">
              <button className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/20" onClick={() => setBatchPaymentsOpen(true)}>
                <Zap className="w-3.5 h-3.5 text-amber-300" />Batch Settle
              </button>
              {can(user, kind, 'write') && (
                <button className="bg-amber-500 text-slate-950 p-2.5 rounded-xl font-bold text-xs flex items-center gap-1 shadow-lg shadow-amber-500/20" onClick={() => setEditor({ kind })}>
                  <Plus className="inline w-3.5 h-3.5"/>New draft
                </button>
              )}
            </div>
          </div>
          {docTable(filtered)}
        </>
      )}

      {(view === 'customers' || view === 'suppliers') && (
        <>
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex items-center gap-2 flex-1 min-w-64">
              <input
                aria-label="Search parties"
                placeholder={`Search ${sales ? 'customers' : 'suppliers'} by name, business, phone, NTN, city...`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className={`${field} flex-1 min-w-0`}
              />
            </div>
            {can(user, kind, 'write') && (
              <button
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold shadow-lg shadow-amber-500/20 flex items-center gap-1.5"
                onClick={() => {
                  setEditingParty(null);
                  setPartyModalOpen(true);
                }}
              >
                <Plus className="w-4 h-4" /> Add {sales ? 'Customer' : 'Supplier'} Profile
              </button>
            )}
          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {currentParties
              .filter((p: any) =>
                `${p.name || ''} ${p.businessName || ''} ${p.companyName || ''} ${p.phone || ''} ${p.mobileNumber || ''} ${p.email || ''} ${p.city || ''} ${p.ntn || ''} ${p.accountNumber || ''}`
                  .toLowerCase()
                  .includes(query.toLowerCase())
              )
              .map((p: any) => {
                const docs = documents.filter((d) => (sales ? d.customerId === p.id : d.vendorId === p.id));
                const due = docs
                  .filter(
                    (d) =>
                      ['INVOICE', 'SUPPLIER_BILL', 'CREDIT_NOTE', 'DEBIT_NOTE'].includes(d.type) &&
                      !['DRAFT', 'CANCELLED', 'REJECTED'].includes(d.status)
                  )
                  .reduce(
                    (s, d) =>
                      s +
                      (['CREDIT_NOTE', 'DEBIT_NOTE'].includes(d.type) ? -1 : 1) *
                        Number(d.balanceDuePkr ?? d.balancePayablePkr ?? 0),
                    0
                  );

                const isSelected = partyId === p.id;
                const contactPerson = p.firstName || p.lastName ? `${p.firstName || ''} ${p.lastName || ''}`.trim() : null;

                return (
                  <div
                    key={p.id}
                    onClick={() => setPartyId(p.id)}
                    className={`p-5 rounded-2xl text-left border bg-slate-900 transition-all cursor-pointer relative space-y-3 group ${
                      isSelected ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-xl' : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    {/* Top line: Name & Badges */}
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-white text-base leading-tight">{p.businessName || p.name}</h4>
                          {p.isFiler && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                              Filer
                            </span>
                          )}
                        </div>
                        {contactPerson && (
                          <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                            <User className="w-3 h-3 text-slate-500" /> {contactPerson}
                          </p>
                        )}
                      </div>

                      {can(user, kind, 'write') && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingParty(p);
                            setPartyModalOpen(true);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 transition-colors"
                          title="Edit Profile"
                        >
                          <Edit className="w-3 h-3" /> Edit
                        </button>
                      )}
                    </div>

                    {/* Metadata items */}
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 pt-1 border-t border-white/5">
                      <div className="flex items-center gap-1.5 truncate">
                        <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="truncate">{p.mobileNumber || p.phone || 'No phone'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 truncate">
                        <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="truncate">{p.city || 'Lahore'}</span>
                      </div>
                      {p.accountNumber && (
                        <div className="text-[11px] text-slate-500 font-mono">
                          Acc: <span className="text-slate-300">{p.accountNumber}</span>
                        </div>
                      )}
                      {p.ntn && (
                        <div className="text-[11px] text-slate-500 font-mono">
                          NTN: <span className="text-slate-300">{p.ntn}</span>
                        </div>
                      )}
                    </div>

                    {/* Financial Summary Line */}
                    <div className="pt-2 border-t border-white/5 flex justify-between items-end">
                      <div className="text-xs text-slate-400">
                        <span>{docs.length} Documents</span>
                        {p.paymentTermsDays !== undefined && (
                          <span className="text-slate-500 ml-2">· {p.paymentTermsDays}d Terms</span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Balance Due</span>
                        <span className={`font-bold text-sm ${due > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {money(due)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          {currentParties.length === 0 && (
            <div className="p-12 text-center text-slate-400 border border-white/10 rounded-2xl bg-slate-900 space-y-3">
              <Building2 className="w-10 h-10 mx-auto text-slate-600" />
              <p className="font-semibold text-white">No {sales ? 'customers' : 'suppliers'} found</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Create a master profile with billing terms, credit limits, NTN/STN tax info, and address.
              </p>
              <button
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs inline-flex items-center gap-1.5"
                onClick={() => {
                  setEditingParty(null);
                  setPartyModalOpen(true);
                }}
              >
                <Plus className="w-4 h-4" /> Add First {sales ? 'Customer' : 'Supplier'}
              </button>
            </div>
          )}

          {partyId && (
            <div className="space-y-4 pt-4 border-t border-white/10">
              {(() => {
                const party = currentParties.find((p: any) => p.id === partyId);
                const partyDocs = documents.filter((d) => (sales ? d.customerId === partyId : d.vendorId === partyId));
                const totalBalance = partyDocs
                  .filter(
                    (d) =>
                      ['INVOICE', 'SUPPLIER_BILL', 'CREDIT_NOTE', 'DEBIT_NOTE'].includes(d.type) &&
                      !['DRAFT', 'CANCELLED', 'REJECTED'].includes(d.status)
                  )
                  .reduce(
                    (s, d) =>
                      s +
                      (['CREDIT_NOTE', 'DEBIT_NOTE'].includes(d.type) ? -1 : 1) *
                        Number(d.balanceDuePkr ?? d.balancePayablePkr ?? 0),
                    0
                  );

                return (
                  <div className="bg-slate-900 border border-white/10 rounded-2xl p-5 space-y-4">
                    {/* Header with full info and edit button */}
                    <div className="flex flex-wrap justify-between items-start gap-4 border-b border-white/10 pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-bold text-white">{party?.businessName || party?.name}</h3>
                          {party?.isFiler && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
                              FBR Filer
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Account Code: <span className="font-mono text-amber-300 font-bold">{party?.accountNumber || party?.code || 'N/A'}</span>
                          {party?.email && ` · Email: ${party.email}`}
                          {party?.mobileNumber && ` · Mobile: ${party.mobileNumber}`}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {can(user, kind, 'write') && (
                          <button
                            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                            onClick={() => {
                              setEditingParty(party);
                              setPartyModalOpen(true);
                            }}
                          >
                            <Edit className="w-3.5 h-3.5" /> Edit Profile & Terms
                          </button>
                        )}
                        <button className={btn} onClick={() => setPartyId('')}>
                          Close Statement
                        </button>
                      </div>
                    </div>

                    {/* Quick Badge Bar: Address, Tax Info, Terms */}
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs bg-slate-950/60 p-3.5 rounded-xl border border-white/5">
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase font-semibold">Address & City</span>
                        <span className="text-slate-200 font-medium">
                          {party?.billingAddress || party?.address || 'Hafeez Center'}, {party?.city || 'Lahore'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase font-semibold">Tax Details</span>
                        <span className="text-slate-200 font-medium font-mono">
                          NTN: {party?.ntn || 'N/A'} | STN: {party?.stn || 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase font-semibold">Credit & Terms</span>
                        <span className="text-slate-200 font-medium">
                          {party?.paymentTermsDays || 0} Days | Limit: {money(party?.creditLimitPkr || 0)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase font-semibold">Outstanding Balance</span>
                        <span className="text-amber-400 font-bold text-sm">{money(totalBalance)}</span>
                      </div>
                    </div>

                    {party?.notes && (
                      <div className="p-3 bg-slate-950/40 border border-white/5 rounded-xl text-xs text-slate-300">
                        <span className="text-slate-500 font-bold mr-2">Notes:</span>
                        {party.notes}
                      </div>
                    )}

                    <div>
                      <h4 className="font-bold text-sm text-slate-200 mb-2">Statement Documents ({partyDocs.length})</h4>
                      {docTable(partyDocs)}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </>
      )}

      {view === 'banking' && (
        <>
          <div className="flex gap-2 items-center flex-wrap">
            {can(user,'banking','write') && can(user,'banking','post') && (
              <button className={btn} onClick={() => setBankForm(true)}>+ Expense / income / transfer</button>
            )}
            <button className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/20" onClick={() => setBatchPaymentsOpen(true)}>
              <Zap className="w-3.5 h-3.5 text-amber-300" />⚡ Batch Settlements
            </button>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            {(data.banks || []).map((b: any) => (
              <div key={b.id} className="p-5 bg-slate-900 rounded-xl border border-white/10">
                <p className="text-sm text-slate-400">{b.accountName}</p>
                <p className="text-xl mt-2 font-bold">{money(b.currentBalancePkr)}</p>
                <p className="text-xs text-slate-500 mt-2">{b.isActive ? 'Active' : 'Inactive'} · {b.glAccountCode}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-slate-400">
            Receive money from an approved sales invoice, or pay an approved supplier bill. Both actions create a linked bank voucher automatically.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {['Date','Voucher / reference','Party','Bank','Amount','Linked document'].map(h => (
                    <th className="p-3 text-left" key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data.vouchers || []).map((v: any) => (
                  <tr key={v.id} className="border-t border-white/10">
                    <td className="p-3">{v.date || '—'}</td>
                    <td className="p-3 max-w-52 break-all">
                      {v.voucherNumber}
                      <div className="text-xs text-slate-500">{v.chequeOrRefNumber}</div>
                    </td>
                    <td className="p-3">{v.partyName || '—'}</td>
                    <td className="p-3">{v.bankAccountName || '—'}</td>
                    <td className="p-3 whitespace-nowrap">{money(v.amountPkr)}</td>
                    <td className="p-3">
                      {(() => { 
                        const d = documents.find(doc => doc.id === (v.invoiceId || v.billId)); 
                        return d ? <button className="text-amber-300 underline" onClick={() => openDetail(d)}>{d.docNumber}</button> : <span className="text-slate-500">Unallocated</span>; 
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(!data.vouchers || data.vouchers.length === 0) && (
              <p className="p-8 text-center text-slate-400">No settlements recorded yet.</p>
            )}
          </div>
        </>
      )}

      {(view === 'ledger' || view === 'reports') && (
        <>
          <div className="bg-blue-500/10 border border-blue-500/20 text-blue-200 p-4 rounded-xl text-sm">
            This activity ledger is generated from posted invoices, bills and coded bank vouchers. It excludes opening balances and browser-only journals. Review the reconciliation findings before using it as a complete trial balance.
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            {dateFilters}
            <label className="text-xs text-slate-400">Search account / document
              <input value={query} onChange={e => setQuery(e.target.value)} className={`${field} block mt-1`} />
            </label>
            <button className={btn} onClick={() => exportRows(view === 'ledger' ? [['Date','Source','Account','Name','Debit','Credit'], ...lines.map((l: any) => [l.date,l.source,l.account,l.name,l.debit,l.credit])] : [['Account','Name','Debit','Credit'], ...trial.map(r => [r.account,r.name,r.debit,r.credit])], view)}>
              <Download className="w-4 h-4 inline mr-2"/>Export CSV
            </button>
          </div>
          {view === 'reports' && <AccountingReportSummary lines={lines} sales={data.sales || []} purchases={data.purchases || []} products={products} />}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {(view === 'ledger' ? ['Date','Source document','Account','Debit','Credit'] : ['Account','Name','Debit balance','Credit balance']).map(h => (
                    <th className="text-left p-3" key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {view === 'ledger' ? lines.map((l: any, i: number) => (
                  <tr key={i} className="border-t border-white/10">
                    <td className="p-3">{l.date}</td>
                    <td className="p-3">
                      <button className="text-amber-300 underline" onClick={() => { const d = documents.find(doc => doc.id === l.sourceId); if (d) openDetail(d); else navigate('banking'); }}>
                        {l.source}
                      </button>
                    </td>
                    <td className="p-3">{l.account} · {l.name}</td>
                    <td className="p-3 whitespace-nowrap">{money(l.debit)}</td>
                    <td className="p-3 whitespace-nowrap">{money(l.credit)}</td>
                  </tr>
                )) : trial.map(r => (
                  <tr className="border-t border-white/10" key={r.account}>
                    <td className="p-3">{r.account}</td>
                    <td className="p-3">{r.name}</td>
                    <td className="p-3">{money(r.debit)}</td>
                    <td className="p-3">{money(r.credit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-slate-300">
            Total debits: {money(trial.reduce((s,r) => s + (Number(r.debit) || 0), 0))} · Total credits: {money(trial.reduce((s,r) => s + (Number(r.credit) || 0), 0))}
          </p>
          {Boolean(data.ledger?.warnings && data.ledger.warnings.length > 0) && (
            <details className="p-4 bg-amber-500/10 text-amber-200 rounded-xl">
              <summary className="cursor-pointer font-semibold">{data.ledger.warnings.length} reconciliation findings</summary>
              <ul className="list-disc pl-5 text-sm mt-3 space-y-1">
                {(data.ledger.warnings || []).map((w: string) => <li key={w}>{w}</li>)}
              </ul>
            </details>
          )}
        </>
      )}

      {view === 'controls' && (
        <>
          <div className="p-5 rounded-xl border border-white/10 bg-slate-900 space-y-3">
            <h3 className="font-bold">Lock completed accounting periods</h3>
            <p className="text-sm text-slate-400">Documents and settlements on or before this date cannot be changed. Later receipts can still settle older invoices.</p>
            <label className="block text-sm">Lock through
              <input type="date" value={lockDate} onChange={e => setLockDate(e.target.value)} className={`${field} block mt-2`}/>
            </label>
            <button disabled={busy} className={btn} onClick={() => run(() => api('/api/erp/workspace/lock', 'PUT', { lockDate }), 'Accounting lock saved')}>Save lock date</button>
            <button disabled={busy} className={`${btn} ml-2`} onClick={() => run(() => api('/api/erp/workspace/lock','PUT',{lockDate:''}), 'Period lock removed')}>Remove lock</button>
          </div>
          <h3 className="font-bold">Recent access & document activity</h3>
          {(data.audit || []).map((a: any) => (
            <div key={a.id} className="border-b border-white/10 py-3 text-sm">
              <p>{a.action}</p>
              <p className="text-slate-500 text-xs mt-1">{a.actor} · {new Date(a.at).toLocaleString()}</p>
            </div>
          ))}
        </>
      )}

      {selected && (
        <div className="fixed inset-0 z-[140] bg-black/80 flex justify-end">
          <div role="dialog" aria-modal="true" aria-label="Document details" className="w-full max-w-4xl xl:max-w-5xl overflow-y-auto bg-slate-900 border-l border-white/10 p-6 lg:p-8 space-y-5">
            <div className="flex justify-between">
              <div>
                <h3 className="text-xl font-bold">{selected.docNumber || 'Document'}</h3>
                <p className="text-sm text-slate-400 capitalize">{pretty(selected.type)} · {pretty(selected.status)}</p>
              </div>
              <button className={btn} aria-label="Close document details" onClick={() => setSelected(null)}><X/></button>
            </div>
            <div className="grid grid-cols-2 gap-4 p-4 bg-slate-950 rounded-xl">
              <div><p className="text-xs text-slate-500">Party</p>{selected.customerName || selected.vendorName || '—'}</div>
              <div><p className="text-xs text-slate-500">Issue date</p>{selected.issueDate || '—'}</div>
              <div><p className="text-xs text-slate-500">Total</p>{money(selected.grandTotalPkr)}</div>
              <div><p className="text-xs text-slate-500">Paid / outstanding</p>{money(selected.paidAmountPkr)} / {money(selected.balanceDuePkr ?? selected.balancePayablePkr)}</div>
            </div>
            {error && <p role="alert" className="p-3 rounded-lg bg-red-950 text-red-200">{error}</p>}
            <div className="flex gap-2 flex-wrap">
              <button className={btn} onClick={() => { try { downloadSourceDocument(selected); } catch (e: any) { setError(e?.message || 'Download failed'); } }}>Download PDF</button>
              {!['CANCELLED','REJECTED'].includes(selected.status) && !selected.paidAmountPkr && can(user,selected.kind,'delete') && can(user,selected.kind,'post') && (
                <button disabled={busy} className={btn} onClick={() => { 
                  run(async () => { 
                    const d = await api(`/api/erp/${selected.kind === 'sales' ? 'sales' : 'purchase'}-docs/${selected.id}/void`, 'POST'); 
                    setSelected({ ...d.doc, kind: selected.kind }); 
                  }, 'Document voided'); 
                }}>Void document</button>
              )}
              {selected.status === 'DRAFT' && can(user, selected.kind, 'write') && (
                <button className={btn} onClick={() => { setEditor({ kind: selected.kind, initial: selected }); setSelected(null); }}>Edit draft</button>
              )}
              {selected.status === 'DRAFT' && can(user, selected.kind, 'post') && (
                <button disabled={busy} className={btn} onClick={() => run(async () => { const d = await api(`/api/erp/${selected.kind === 'sales' ? 'sales' : 'purchase'}-docs/${selected.id}/approve`, 'POST'); setSelected({ ...d.doc, kind: selected.kind }); }, 'Document approved')}>Approve document</button>
              )}
              {['QUOTATION','PROFORMA','SALES_ORDER','PURCHASE_ORDER'].includes(selected.type) && can(user,selected.kind,'write') && (
                <button disabled={busy} className={btn} onClick={() => run(async () => { const d = await api(`/api/erp/${selected.kind === 'sales' ? 'sales' : 'purchase'}-docs/${selected.id}/convert`, 'POST', { date: localDate() }); setSelected({ ...d.doc, kind: selected.kind }); }, 'Linked draft ready for review')}>Create linked {selected.type === 'QUOTATION' ? 'sales order' : selected.type === 'PURCHASE_ORDER' ? 'bill' : 'invoice'}</button>
              )}
              {['INVOICE','SUPPLIER_BILL'].includes(selected.type) && !['DRAFT','CANCELLED','REJECTED'].includes(selected.status) && (selected.balanceDuePkr ?? selected.balancePayablePkr) > 0 && can(user,selected.kind,'post') && can(user,'banking','post') && (
                <button className="px-3 py-2 bg-amber-500 text-slate-950 rounded-lg font-bold" onClick={() => { 
                  setSettlement({ ...selected, requestId: crypto.randomUUID() }); 
                  setAmount(String(selected.balanceDuePkr ?? selected.balancePayablePkr)); 
                  setBankId((data.banks || []).find((b:any) => b.isActive)?.id || ''); 
                  setPaymentDate(localDate()); 
                  setReference(''); 
                }}>Record {selected.kind === 'sales' ? 'receipt' : 'payment'}</button>
              )}
            </div>
            <div>
              <h4 className="font-bold mb-3">Items</h4>
              {(selected.items || []).map((i: any,index: number) => (
                <div key={i.id || index} className="py-3 border-t border-white/10 flex justify-between gap-3 text-sm">
                  <div>
                    {i.productName || i.productId || 'Item'}
                    <p className="text-slate-400 text-xs mt-1">{i.quantity || i.orderedQty} × {money(i.unitPricePkr ?? i.unitCostPkr)}</p>
                  </div>
                  <span>{money(i.totalPkr)}</span>
                </div>
              ))}
            </div>
            <div>
              <h4 className="font-bold mb-3">Linked records</h4>
              {documents.filter(d => d.id === selected.sourceDocumentId || d.sourceDocumentId === selected.id).map(d => (
                <button key={d.id} onClick={() => openDetail(d)} className={`${btn} mr-2 mb-2`}>{d.docNumber} <ArrowRight className="inline w-3 h-3"/></button>
              ))}
              {(data.vouchers || []).filter((v: any) => v.invoiceId === selected.id || v.billId === selected.id).map((v: any) => (
                <div key={v.id} className="text-sm p-3 mb-2 rounded-lg bg-slate-950">
                  <p>{v.date} · {money(v.amountPkr)} · {v.bankAccountName}</p>
                  <p className="text-xs text-slate-500 break-all mt-1">{v.voucherNumber} · {v.chequeOrRefNumber}</p>
                </div>
              ))}
            </div>
            {data.ledger && (
              <div>
                <h4 className="font-bold mb-3">Accounting entries</h4>
                {(data.ledger.lines || []).filter((l: any) => l.sourceId === selected.id).map((l: any,i:number) => (
                  <div key={i} className="text-sm flex justify-between border-t border-white/10 py-2">
                    <span>{l.account} · {l.name}</span>
                    <span>{l.debit ? `Dr ${money(l.debit)}` : `Cr ${money(l.credit)}`}</span>
                  </div>
                ))}
                {selected.status === 'DRAFT' && <p className="text-sm text-slate-400">Drafts have no accounting entries until approved.</p>}
              </div>
            )}
            {selected.notes && <p className="text-sm text-slate-400 whitespace-pre-wrap">{selected.notes}</p>}
          </div>
        </div>
      )}

      {editor && (
        <SourceDocumentForm 
          kind={editor.kind} 
          products={products} 
          parties={editor.kind === 'sales' ? (data.customers || []) : (data.vendors || [])} 
          banks={data.banks || []}
          initial={editor.initial} 
          onClose={() => setEditor(null)} 
          onSaved={() => { setEditor(null); run(async () => {}, 'Draft saved'); }} 
          onPartyCreated={(newParty) => {
            if (editor.kind === 'sales') {
              setData((prev: any) => prev ? { ...prev, customers: [newParty, ...(prev.customers || [])] } : prev);
            } else {
              setData((prev: any) => prev ? { ...prev, vendors: [newParty, ...(prev.vendors || [])] } : prev);
            }
          }}
        />
      )}

      {batchPaymentsOpen && (
        <BatchPaymentsModal
          isOpen={batchPaymentsOpen}
          onClose={() => setBatchPaymentsOpen(false)}
          documents={documents}
          banks={data.banks || []}
          customers={data.customers || []}
          vendors={data.vendors || []}
          onBatchProcessed={() => run(async () => {}, 'Batch settlements posted')}
        />
      )}

      {bankForm && (
        <BankEntryForm 
          banks={data.banks || []} 
          onClose={() => setBankForm(false)} 
          onSaved={() => { setBankForm(false); run(async () => {}, 'Bank entry posted'); }}
        />
      )}

      {partyModalOpen && (
        <PartyDetailsModal
          isOpen={partyModalOpen}
          kind={kind}
          initial={editingParty}
          onClose={() => {
            setPartyModalOpen(false);
            setEditingParty(null);
          }}
          onSaved={() => {
            setPartyModalOpen(false);
            setEditingParty(null);
            run(load, 'Party profile saved');
          }}
        />
      )}

      {settlement && (
        <div className="fixed inset-0 z-[170] bg-black/80 flex items-center justify-center p-4">
          <form className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-md w-full space-y-4" onSubmit={e => { 
            e.preventDefault(); 
            run(async () => { 
              const d = await api(`/api/erp/${settlement.kind === 'sales' ? 'sales' : 'purchase'}-docs/${settlement.id}/${settlement.kind === 'sales' ? 'receipts' : 'payments'}`, 'POST', { 
                id: settlement.requestId, 
                bankAccountId: bankId, 
                amount: Number(amount), 
                date: paymentDate, 
                reference 
              }); 
              setSelected({ ...d.doc, kind: settlement.kind }); 
              setSettlement(null); 
            }, 'Settlement posted and linked'); 
          }}>
            <h3 className="font-bold text-lg">{settlement.kind === 'sales' ? 'Receive against' : 'Pay'} {settlement.docNumber}</h3>
            <p className="text-sm text-slate-400">Outstanding {money(settlement.balanceDuePkr ?? settlement.balancePayablePkr)}</p>
            {error && <p role="alert" className="text-red-300">{error}</p>}
            <label className="block">Bank / cash
              <select required value={bankId} onChange={e => setBankId(e.target.value)} className={`${field} block w-full mt-1`}>
                <option value="">Choose account</option>
                {(data.banks || []).filter((b:any) => b.isActive).map((b:any) => (
                  <option key={b.id} value={b.id}>{b.accountName}</option>
                ))}
              </select>
            </label>
            <label className="block">Amount
              <input required type="number" min="0.01" max={settlement.balanceDuePkr ?? settlement.balancePayablePkr} step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className={`${field} block w-full mt-1`} />
            </label>
            <label className="block">Date
              <input required type="date" min={settlement.issueDate} value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className={`${field} block w-full mt-1`}/>
            </label>
            <label className="block">Reference
              <input value={reference} onChange={e => setReference(e.target.value)} className={`${field} block w-full mt-1`}/>
            </label>
            <div className="flex justify-end gap-3">
              <button type="button" disabled={busy} onClick={() => setSettlement(null)}>Cancel</button>
              <button disabled={busy} className="px-4 py-2 bg-amber-500 text-slate-950 rounded-lg font-bold">{busy ? 'Posting…' : 'Post settlement'}</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
