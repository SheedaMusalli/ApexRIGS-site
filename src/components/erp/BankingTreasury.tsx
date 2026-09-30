import React, { useState, useMemo, useEffect } from 'react';
import {
  Landmark,
  FileCheck2,
  Receipt,
  Plus,
  Search,
  Printer,
  DollarSign,
  Wallet,
  Building,
  CheckCircle,
  Eye,
  CreditCard,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  Trash2
} from 'lucide-react';
import {
  BankAccount,
  FinancialVoucher,
  BankReconciliationRecord,
  BranchLocationId,
  VoucherType
} from '../../types/erp';
import { erpStorage } from '../../services/erpStorage';
import { formatPkr } from '../../utils/formatters';

interface BankingTreasuryProps {
  activeBranchId: BranchLocationId;
}

export const BankingTreasury: React.FC<BankingTreasuryProps> = ({ activeBranchId }) => {
  const [activeTab, setActiveTab] = useState<'accounts' | 'vouchers' | 'reconciliation'>('accounts');
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(() => erpStorage.getBankAccounts());
  const [vouchers, setVouchers] = useState<FinancialVoucher[]>(() => erpStorage.getVouchers());
  const [voucherSearch, setVoucherSearch] = useState('');
  const [voucherFilterType, setVoucherFilterType] = useState<string>('ALL');

  useEffect(() => {
    erpStorage.refreshTreasury().then(() => { setBankAccounts(erpStorage.getBankAccounts()); setVouchers(erpStorage.getVouchers()); }).catch(error => showToast(error.message));
  }, []);
  const [savingVoucher, setSavingVoucher] = useState(false);
  const removeVoucher = async (id: string) => {
    try {
      const updated = await erpStorage.deleteVoucher(id);
      setVouchers(updated); setBankAccounts(erpStorage.getBankAccounts());
      setSelectedVoucherForPrint(null); showToast('Voucher deleted and cash posting reversed.');
    } catch (error) { alert((error as Error).message); }
  };

  // Filtered Vouchers
  const filteredVouchers = useMemo(() => {
    return vouchers.filter((v) => {
      if (voucherFilterType !== 'ALL' && v.type !== voucherFilterType) return false;
      if (voucherSearch.trim()) {
        const q = voucherSearch.toLowerCase();
        return (
          v.voucherNumber.toLowerCase().includes(q) ||
          v.partyName.toLowerCase().includes(q) ||
          v.narration.toLowerCase().includes(q) ||
          (v.bankAccountName || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [vouchers, voucherFilterType, voucherSearch]);

  // Modal States
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [selectedVoucherForPrint, setSelectedVoucherForPrint] = useState<FinancialVoucher | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  // New Bank Account State
  const [newAccount, setNewAccount] = useState<Partial<BankAccount>>({
    accountName: '',
    bankName: 'Meezan Bank Ltd',
    accountNumber: '',
    iban: '',
    currency: 'PKR',
    type: 'BANK_CURRENT',
    branchName: '',
    openingBalancePkr: 0,
    currentBalancePkr: 0,
    glAccountCode: '1010',
  });

  // New Voucher State
  const [voucherType, setVoucherType] = useState<VoucherType>('BPV');
  const [selectedBankId, setSelectedBankId] = useState<string>(bankAccounts[0]?.id || '');
  const [partyName, setPartyName] = useState('');
  const [paymentMode, setPaymentMode] = useState<'ONLINE_TRANSFER' | 'RAAST' | 'CHEQUE' | 'CASH'>('ONLINE_TRANSFER');
  const [refNumber, setRefNumber] = useState('');
  const [voucherAmount, setVoucherAmount] = useState<number>(0);
  const [narration, setNarration] = useState('');

  const totalBankLiquidity = bankAccounts.reduce((acc, b) => acc + (b.currentBalancePkr || 0), 0);
  const usdAccounts = bankAccounts.filter((b) => b.currency === 'USD');
  const totalUsdLiquidity = usdAccounts.reduce((acc, b) => acc + (b.currentBalancePkr || 0), 0);

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccount.accountName?.trim()) {
      alert('Please provide an account name.');
      return;
    }
    const created: BankAccount = {
      id: 'acc-' + Date.now(),
      accountName: newAccount.accountName.trim(),
      bankName: newAccount.bankName || 'Bank',
      accountNumber: newAccount.accountNumber || 'N/A',
      iban: newAccount.iban || '',
      currency: newAccount.currency || 'PKR',
      type: newAccount.type || 'BANK_CURRENT',
      branchName: newAccount.branchName || 'Main Branch',
      openingBalancePkr: Number(newAccount.openingBalancePkr) || 0,
      currentBalancePkr: Number(newAccount.openingBalancePkr) || 0,
      reconciledBalancePkr: Number(newAccount.openingBalancePkr) || 0,
      glAccountCode: newAccount.glAccountCode || '1010',
      isActive: true,
    };
    const updated = erpStorage.saveBankAccount(created);
    setBankAccounts(updated);
    if (!selectedBankId) setSelectedBankId(created.id);
    setIsAccountModalOpen(false);
    setNewAccount({
      accountName: '',
      bankName: 'Meezan Bank Ltd',
      accountNumber: '',
      iban: '',
      currency: 'PKR',
      type: 'BANK_CURRENT',
      branchName: '',
      openingBalancePkr: 0,
      currentBalancePkr: 0,
      glAccountCode: '1010',
    });
  };

  const handleCreateVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingVoucher) return;
    if (!partyName || voucherAmount <= 0) {
      alert('Please fill party name and valid amount.');
      return;
    }

    const bank = bankAccounts.find((b) => b.id === selectedBankId);

    if (!bank || !bank.isActive || !Number.isFinite(voucherAmount)) { alert('Select an active cash or bank account and a valid amount.'); return; }
    const newVoucher: FinancialVoucher = {
      id: 'vouch-' + Date.now(),
      voucherNumber: `${voucherType}-2026-${String(vouchers.length + 101).padStart(4, '0')}`,
      type: voucherType,
      date: new Date().toISOString().split('T')[0],
      bankAccountId: selectedBankId,
      bankAccountName: bank ? bank.accountName : 'Cash Account',
      partyType: voucherType === 'BPV' || voucherType === 'CPV' ? 'VENDOR' : 'CUSTOMER',
      partyName,
      paymentMode,
      chequeOrRefNumber: refNumber || 'FT-' + Math.floor(100000 + Math.random() * 900000),
      narration,
      amountPkr: voucherAmount,
      netPaidOrReceivedPkr: voucherAmount,
      debitAccountCode: voucherType === 'BPV' || voucherType === 'CPV' ? '2010' : bank.glAccountCode,
      debitAccountName: voucherType === 'BPV' || voucherType === 'CPV' ? 'Accounts Payable' : bank?.accountName || 'Bank',
      creditAccountCode: voucherType === 'BPV' || voucherType === 'CPV' ? bank.glAccountCode : '1100',
      creditAccountName: voucherType === 'BPV' || voucherType === 'CPV' ? bank?.accountName || 'Bank' : 'Accounts Receivable',
      preparedBy: 'Financial Accountant',

      branchId: activeBranchId,
      createdAt: new Date().toISOString(),
    };

    let updated: FinancialVoucher[];
    setSavingVoucher(true);
    try { updated = await erpStorage.saveVoucher(newVoucher); } catch (error) { alert((error as Error).message); return; } finally { setSavingVoucher(false); }
    setVouchers(updated);
    setBankAccounts(erpStorage.getBankAccounts());
    setBankAccounts(erpStorage.getBankAccounts());
    setIsVoucherModalOpen(false);
    setSelectedVoucherForPrint(newVoucher);
  };

  return (
    <div className="space-y-6">
      {notification && (
        <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-semibold animate-in fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-emerald-500/20 rounded-2xl p-4 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Total Liquid Treasury</span>
            <Landmark className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-300 font-mono">
            {formatPkr(totalBankLiquidity)}
          </div>
          <div className="text-[11px] text-emerald-400/80 mt-1">Sum of all registered bank & cash accounts</div>
        </div>

        <div className="bg-slate-900/80 border border-blue-500/20 rounded-2xl p-4 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Active Bank & Cash Accounts</span>
            <Wallet className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-blue-300 font-mono">
            {bankAccounts.length} Accounts
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Operating bank A/Cs & cash drawers</div>
        </div>

        <div className="bg-slate-900/80 border border-amber-500/20 rounded-2xl p-4 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Posted Vouchers</span>
            <FileCheck2 className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-300 font-mono">{vouchers.length} Vouchers</div>
          <div className="text-[11px] text-amber-400/80 mt-1">BPV, BRV, CPV, CRV recorded</div>
        </div>

        <div className="bg-slate-900/80 border border-purple-500/20 rounded-2xl p-4 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Foreign Currency (USD)</span>
            <DollarSign className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-purple-300 font-mono">
            {totalUsdLiquidity > 0 ? `$${(totalUsdLiquidity / 283.5).toLocaleString()} USD` : '$0 USD'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {totalUsdLiquidity > 0 ? `${formatPkr(totalUsdLiquidity)} equivalent` : 'No foreign currency accounts'}
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-white/10">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('accounts')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'accounts'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Landmark className="w-3.5 h-3.5" />
            <span>Bank & Cash Accounts ({bankAccounts.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('vouchers')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'vouchers'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Financial Vouchers ({vouchers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('reconciliation')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'reconciliation'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Bank Reconciliation</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAccountModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 border border-white/10 transition-all shrink-0"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add Bank / Cash Account</span>
          </button>

          <button
            onClick={() => {
              if (bankAccounts.length === 0) {
                alert('Please create at least one Bank or Cash Account first.');
                setIsAccountModalOpen(true);
                return;
              }
              setIsVoucherModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all shrink-0"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Post New Voucher</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === 'accounts' ? (
        bankAccounts.length === 0 ? (
          <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              <Landmark className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">No Bank or Cash Accounts Registered</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                You currently have no bank accounts or cash drawers configured. Add your business accounts to start recording deposits, payments, and tracking live cash balances.
              </p>
            </div>
            <button
              onClick={() => setIsAccountModalOpen(true)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl inline-flex items-center gap-2 shadow-lg shadow-amber-500/20"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add Your First Bank / Cash Account</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {bankAccounts.map((acc) => (
              <div key={acc.id} className="bg-slate-900/90 border border-white/10 rounded-2xl p-5 shadow-xl space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-white text-sm">{acc.accountName}</h3>
                    <div className="text-[11px] text-slate-400">{acc.bankName} - {acc.branchName || 'Main'}</div>
                    <div className="text-[10px] font-mono text-slate-500 mt-1">A/C: {acc.accountNumber} {acc.iban ? `| IBAN: ${acc.iban}` : ''}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                      {acc.currency}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const updated = erpStorage.deleteBankAccount(acc.id);
                        setBankAccounts(updated);
                        showToast(`Account "${acc.accountName}" removed from treasury records.`);
                        window.dispatchEvent(new CustomEvent('apex:erp_updated'));
                      }}
                      className="p-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors"
                      title="Delete Bank Account"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-white/5 flex justify-between items-center">
                  <span className="text-slate-400 text-xs">Current Book Balance:</span>
                  <span className="text-lg font-black text-emerald-400 font-mono">
                    {acc.currency === 'USD' ? `$${(acc.currentBalancePkr / 283.5).toLocaleString()} USD` : formatPkr(acc.currentBalancePkr)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-[11px] text-slate-400 pt-1">
                  <span>GL Nominal Code: <span className="font-mono text-amber-300">{acc.glAccountCode}</span></span>
                  <button
                    onClick={() => {
                      setSelectedBankId(acc.id);
                      setIsVoucherModalOpen(true);
                    }}
                    className="text-amber-400 hover:text-amber-300 font-bold text-xs"
                  >
                    + Post Transaction
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : activeTab === 'vouchers' ? (
        /* VOUCHERS TABLE */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-900/60 p-3 rounded-2xl border border-white/10">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={voucherSearch}
                onChange={(e) => setVoucherSearch(e.target.value)}
                placeholder="Search vouchers by #, beneficiary party, bank, or narration..."
                className="w-full pl-9 pr-4 py-2 bg-slate-950/80 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
              />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <select
                value={voucherFilterType}
                onChange={(e) => setVoucherFilterType(e.target.value)}
                className="bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="ALL">All Voucher Types</option>
                <option value="BPV">BPV - Bank Payment</option>
                <option value="BRV">BRV - Bank Receipt</option>
                <option value="CPV">CPV - Cash Payment</option>
                <option value="CRV">CRV - Cash Receipt</option>
              </select>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] font-bold border-b border-white/10">
                  <tr>
                    <th className="py-3.5 px-4">Voucher # & Type</th>
                    <th className="py-3.5 px-4">Beneficiary / Party</th>
                    <th className="py-3.5 px-4">Bank / Cash Source</th>
                    <th className="py-3.5 px-4">Narration</th>
                    <th className="py-3.5 px-4 text-right">Amount (PKR)</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredVouchers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 italic">
                        No financial vouchers recorded yet. Click 'Post New Voucher' to record cash or bank disbursements.
                      </td>
                    </tr>
                  ) : (
                    filteredVouchers.map((v) => (
                      <tr key={v.id} className="hover:bg-white/[0.02]">
                        <td className="py-3 px-4 font-mono font-bold text-amber-400">
                          <div>{v.voucherNumber}</div>
                          <div className="text-[10px] text-slate-500">{v.date}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-white">{v.partyName}</div>
                          <div className="text-[10px] font-mono text-slate-400">{v.chequeOrRefNumber} ({v.paymentMode})</div>
                        </td>
                        <td className="py-3 px-4 text-slate-300">{v.bankAccountName}</td>
                        <td className="py-3 px-4 text-slate-400 max-w-xs truncate">{v.narration}</td>
                        <td className="py-3 px-4 text-right font-mono font-black text-white">
                          {formatPkr(v.netPaidOrReceivedPkr)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedVoucherForPrint(v)}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white"
                              title="View Voucher Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setSelectedVoucherForPrint(v)}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white"
                              title="Print Voucher"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void removeVoucher(v.id);
                              }}
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors"
                              title="Delete Voucher"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* BANK RECONCILIATION */
        <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-5 shadow-xl space-y-4 text-xs">
          <div className="flex items-center gap-2 border-b border-white/10 pb-3">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Bank Statement Reconciliation</h3>
              <p className="text-[11px] text-slate-400">Compare official bank statements with system cash books to resolve differences</p>
            </div>
          </div>

          {bankAccounts.length === 0 ? (
            <div className="py-8 text-center text-slate-500 italic">
              No bank accounts available for reconciliation. Please register your bank accounts first.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {bankAccounts.map((acc) => {
                const diff = (acc.reconciledBalancePkr || acc.currentBalancePkr) - acc.currentBalancePkr;
                return (
                  <div key={acc.id} className="bg-slate-950 p-4 rounded-xl border border-white/10 space-y-2">
                    <div className="font-bold text-white">{acc.accountName}</div>
                    <div className="text-slate-400">Statement Balance: {formatPkr(acc.reconciledBalancePkr || acc.currentBalancePkr)}</div>
                    <div className="text-slate-400">Ledger Balance: {formatPkr(acc.currentBalancePkr)}</div>
                    <div className={`font-bold font-mono ${diff === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      Difference: {formatPkr(diff)} {diff === 0 ? '(BALANCED)' : '(UNRECONCILED)'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL: ADD BANK ACCOUNT */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Landmark className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Add Bank / Cash Account</h3>
              </div>
              <button onClick={() => setIsAccountModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Account Title / Description *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Meezan Bank Corporate A/C / Store Cash Drawer"
                  value={newAccount.accountName}
                  onChange={(e) => setNewAccount({ ...newAccount, accountName: e.target.value })}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">Bank / Institution Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Meezan Bank / HBL / Cash Drawer"
                    value={newAccount.bankName}
                    onChange={(e) => setNewAccount({ ...newAccount, bankName: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Account Type</label>
                  <select
                    value={newAccount.type}
                    onChange={(e) => setNewAccount({ ...newAccount, type: e.target.value as any })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="BANK_CURRENT">Bank Current Account</option>
                    <option value="BANK_SAVINGS">Bank Savings Account</option>
                    <option value="CASH_DRAWER">Showroom Cash Drawer</option>
                    <option value="PETTY_CASH">Petty Cash Fund</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">Account Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 02100109928371"
                    value={newAccount.accountNumber}
                    onChange={(e) => setNewAccount({ ...newAccount, accountNumber: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Currency</label>
                  <select
                    value={newAccount.currency}
                    onChange={(e) => setNewAccount({ ...newAccount, currency: e.target.value as any })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="PKR">PKR (Pakistani Rupee)</option>
                    <option value="USD">USD (US Dollar)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">IBAN (Optional)</label>
                <input
                  type="text"
                  placeholder="PK56MEZN0002100109928371"
                  value={newAccount.iban}
                  onChange={(e) => setNewAccount({ ...newAccount, iban: e.target.value })}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">Opening Balance (PKR)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={newAccount.openingBalancePkr || ''}
                    onChange={(e) => setNewAccount({ ...newAccount, openingBalancePkr: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono font-bold text-amber-400"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">GL Account Code</label>
                  <input
                    type="text"
                    placeholder="1010"
                    value={newAccount.glAccountCode}
                    onChange={(e) => setNewAccount({ ...newAccount, glAccountCode: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsAccountModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-lg shadow-amber-500/20"
                >
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: POST VOUCHER */}
      {isVoucherModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Post Financial Voucher</h3>
              </div>
              <button onClick={() => setIsVoucherModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateVoucher} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">Voucher Type</label>
                  <select
                    value={voucherType}
                    onChange={(e) => setVoucherType(e.target.value as VoucherType)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white font-bold"
                  >
                    <option value="BPV">Bank Payment (BPV)</option>
                    <option value="BRV">Bank Receipt (BRV)</option>
                    <option value="CPV">Cash Payment (CPV)</option>
                    <option value="CRV">Cash Receipt (CRV)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Bank / Cash Account</label>
                  <select
                    value={selectedBankId}
                    onChange={(e) => setSelectedBankId(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white"
                  >
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.accountName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Party / Beneficiary Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Galaxy Tech Importers / Alpha Gaming"
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">Amount (PKR) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 500000"
                    value={voucherAmount || ''}
                    onChange={(e) => setVoucherAmount(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-lg font-bold text-amber-400"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Payment Mode</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as any)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="ONLINE_TRANSFER">Online Bank Transfer</option>
                    <option value="RAAST">Raast Instant ID</option>
                    <option value="CHEQUE">Cheque / Pay Order</option>
                    <option value="CASH">Cash Vault / Drawer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Cheque / Reference Number</label>
                <input
                  type="text"
                  placeholder="FT-992019 / Cheque #881920"
                  value={refNumber}
                  onChange={(e) => setRefNumber(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Narration / Purpose</label>
                <textarea
                  value={narration}
                  onChange={(e) => setNarration(e.target.value)}
                  rows={2}
                  placeholder="e.g. Payment for RTX 4090 batch invoice PO-2026-031"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsVoucherModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-lg shadow-amber-500/20"
                >
                  Post Voucher to GL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINT VOUCHER MODAL */}
      {selectedVoucherForPrint && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white uppercase">Voucher Slip #{selectedVoucherForPrint.voucherNumber}</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => window.print()} className="px-3 py-1.5 bg-amber-500 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1">
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Slip</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void removeVoucher(selectedVoucherForPrint.id);
                  }}
                  className="px-3 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 font-bold text-xs rounded-xl flex items-center gap-1 border border-rose-500/30 transition-all"
                  title="Delete Voucher Record"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
                <button onClick={() => setSelectedVoucherForPrint(null)} className="text-slate-400 hover:text-white px-2">✕</button>
              </div>
            </div>

            <div className="bg-white text-slate-950 p-6 rounded-2xl space-y-4 font-sans text-xs">
              <div className="flex justify-between border-b border-slate-300 pb-3">
                <div>
                  <h1 className="font-black text-base">APEXRIG FINANCIAL TREASURY</h1>
                  <p className="text-slate-600 text-[10px]">Hafeez Centre, Main Boulevard Gulberg, Lahore</p>
                </div>
                <div className="text-right">
                  <div className="font-black text-amber-600 uppercase text-sm">{selectedVoucherForPrint.type}</div>
                  <div className="font-mono font-bold">{selectedVoucherForPrint.voucherNumber}</div>
                  <div className="text-slate-500 text-[10px]">Date: {selectedVoucherForPrint.date}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-b border-slate-200 pb-3">
                <div>
                  <div className="text-slate-500 text-[10px] uppercase font-bold">Paid To / Received From:</div>
                  <div className="font-bold text-sm text-slate-900">{selectedVoucherForPrint.partyName}</div>
                  <div className="text-slate-600">Mode: {selectedVoucherForPrint.paymentMode}</div>
                </div>
                <div className="text-right">
                  <div className="text-slate-500 text-[10px] uppercase font-bold">Account / Source:</div>
                  <div className="font-bold text-slate-900">{selectedVoucherForPrint.bankAccountName}</div>
                  <div className="text-slate-600 font-mono">Ref: {selectedVoucherForPrint.chequeOrRefNumber}</div>
                </div>
              </div>

              <div className="p-3 bg-slate-100 rounded-xl space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-600">Narration / Accounting Remarks:</div>
                <div className="text-slate-900 font-medium">{selectedVoucherForPrint.narration}</div>
              </div>

              <div className="flex justify-between items-center pt-2">
                <div className="text-slate-600 text-[11px]">
                  Debit: <span className="font-mono font-bold text-slate-900">{selectedVoucherForPrint.debitAccountName}</span> | Credit: <span className="font-mono font-bold text-slate-900">{selectedVoucherForPrint.creditAccountName}</span>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase text-slate-500">Net Amount</div>
                  <div className="text-lg font-black text-amber-600 font-mono">
                    PKR {selectedVoucherForPrint.netPaidOrReceivedPkr.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-8 text-center text-[10px] text-slate-500 border-t border-slate-200">
                <div>Prepared By: ________________</div>
                <div>Checked By: ________________</div>
                <div>Approved By: ________________</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
