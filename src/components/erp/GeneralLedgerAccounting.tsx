import React, { useState, useMemo, useEffect } from 'react';
import {
  FolderTree,
  Building,
  CheckCircle,
  Plus,
  Search,
  Scale,
  Trash2,
  Wallet,
  Landmark,
  Coins,
  ArrowUpDown,
  AlertTriangle,
  FileSpreadsheet,
  Edit3,
  RefreshCw,
  Info
} from 'lucide-react';
import {
  ChartOfAccountItem,
  BankAccount,
  BranchLocationId,
  AccountClassification,
  BankAccountType
} from '../../types/erp';
import { erpStorage } from '../../services/erpStorage';
import { formatPkr } from '../../utils/formatters';

interface GeneralLedgerProps {
  activeBranchId: BranchLocationId;
}

export const GeneralLedgerAccounting: React.FC<GeneralLedgerProps> = ({ activeBranchId }) => {
  // Navigation Tabs: only Chart of Accounts and Manual Cash & Bank Tracking
  const [activeTab, setActiveTab] = useState<'coa' | 'cash_bank'>('coa');

  // Chart of Accounts State
  const [coaList, setCoaList] = useState<ChartOfAccountItem[]>(() => erpStorage.getChartOfAccounts());
  const [coaSearch, setCoaSearch] = useState('');
  const [classificationFilter, setClassificationFilter] = useState<'ALL' | AccountClassification>('ALL');

  // Bank & Cash Drawers State
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(() => erpStorage.getBankAccounts());
  const [bankSearch, setBankSearch] = useState('');

  // Notification Toast
  const [notification, setNotification] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  // Sync with erpStorage updates
  useEffect(() => {
    const handleErpUpdate = () => {
      setCoaList(erpStorage.getChartOfAccounts());
      setBankAccounts(erpStorage.getBankAccounts());
    };
    window.addEventListener('apex:erp_updated', handleErpUpdate);
    return () => window.removeEventListener('apex:erp_updated', handleErpUpdate);
  }, []);

  // Filtered Chart of Accounts
  const filteredCoa = useMemo(() => {
    return coaList.filter((item) => {
      if (classificationFilter !== 'ALL' && item.classification !== classificationFilter) return false;
      if (coaSearch.trim()) {
        const q = coaSearch.toLowerCase();
        return item.code.toLowerCase().includes(q) || item.name.toLowerCase().includes(q);
      }
      return true;
    });
  }, [coaList, classificationFilter, coaSearch]);

  // Filtered Bank Accounts
  const filteredBankAccounts = useMemo(() => {
    return bankAccounts.filter((acc) => {
      if (bankSearch.trim()) {
        const q = bankSearch.toLowerCase();
        return (
          acc.accountName.toLowerCase().includes(q) ||
          acc.bankName.toLowerCase().includes(q) ||
          acc.accountNumber.toLowerCase().includes(q) ||
          acc.glAccountCode.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [bankAccounts, bankSearch]);

  // Liquidity Aggregates
  const totalLiquidityPkr = useMemo(() => {
    return bankAccounts.reduce((sum, acc) => sum + (acc.currentBalancePkr || 0), 0);
  }, [bankAccounts]);

  const cashInHandPkr = useMemo(() => {
    return bankAccounts
      .filter((a) => a.type === 'CASH_DRAWER' || a.type === 'PETTY_CASH')
      .reduce((sum, acc) => sum + (acc.currentBalancePkr || 0), 0);
  }, [bankAccounts]);

  const bankDepositsPkr = useMemo(() => {
    return bankAccounts
      .filter((a) => a.type === 'BANK_CURRENT' || a.type === 'BANK_SAVINGS' || a.type === 'DIGITAL_WALLET')
      .reduce((sum, acc) => sum + (acc.currentBalancePkr || 0), 0);
  }, [bankAccounts]);

  // --------------------------------------------------------------------------
  // MODAL STATES
  // --------------------------------------------------------------------------

  // 1. Add COA Nominal Account Modal
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [newAccCode, setNewAccCode] = useState('');
  const [newAccName, setNewAccName] = useState('');
  const [newAccClass, setNewAccClass] = useState<AccountClassification>('ASSET');
  const [newAccIsGroup, setNewAccIsGroup] = useState(false);
  const [newAccParentCode, setNewAccParentCode] = useState('');
  const [newAccOpeningBal, setNewAccOpeningBal] = useState<number>(0);
  const [newAccDesc, setNewAccDesc] = useState('');

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccCode.trim() || !newAccName.trim()) {
      showToast('Account Code and Account Name are required.');
      return;
    }

    if (coaList.some(a => a.code === newAccCode.trim())) { showToast('Account code already exists.'); return; }
    const debitNormal = ['ASSET', 'EXPENSE', 'COGS'].includes(newAccClass);
    const openingDebit = debitNormal ? newAccOpeningBal : -newAccOpeningBal;
    const newItem: ChartOfAccountItem = {
      code: newAccCode.trim(),
      name: newAccName.trim(),
      classification: newAccClass,
      isGroup: newAccIsGroup,
      parentCode: newAccParentCode.trim() || undefined,
      currentDebitBalancePkr: Math.max(0, openingDebit),
      currentCreditBalancePkr: Math.max(0, -openingDebit),
      netBalancePkr: newAccOpeningBal,
      description: newAccDesc.trim() || undefined,
    };

    const updated = erpStorage.saveChartOfAccount(newItem);
    setCoaList(updated);
    setIsAddAccountModalOpen(false);
    setNewAccCode('');
    setNewAccName('');
    setNewAccOpeningBal(0);
    setNewAccDesc('');
    showToast(`Added Account ${newItem.code} - ${newItem.name}`);
    window.dispatchEvent(new CustomEvent('apex:erp_updated'));
  };

  // 2. Adjust COA Account Balance Modal
  const [adjustingAccount, setAdjustingAccount] = useState<ChartOfAccountItem | null>(null);
  const [adjustedNetBalance, setAdjustedNetBalance] = useState<number>(0);
  const [adjustAccountReason, setAdjustAccountReason] = useState('');

  const handleOpenAdjustAccount = (acc: ChartOfAccountItem) => {
    setAdjustingAccount(acc);
    setAdjustedNetBalance(acc.netBalancePkr || 0);
    setAdjustAccountReason('');
  };

  const handleSaveAdjustAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingAccount) return;

    const reason = adjustAccountReason.trim() || 'Manual balance adjustment';
    const updated = erpStorage.adjustChartOfAccountBalance(adjustingAccount.code, adjustedNetBalance, reason);
    setCoaList(updated);
    setBankAccounts(erpStorage.getBankAccounts());
    setAdjustingAccount(null);
    showToast(`Updated balance for ${adjustingAccount.code} to ${formatPkr(adjustedNetBalance)}`);
    window.dispatchEvent(new CustomEvent('apex:erp_updated'));
  };

  // 3. Add Bank Account or Cash Drawer Modal
  const [isAddBankModalOpen, setIsAddBankModalOpen] = useState(false);
  const [newBankName, setNewBankName] = useState('');
  const [newAccountTitle, setNewAccountTitle] = useState('');
  const [newAccountNumber, setNewAccountNumber] = useState('');
  const [newBankIban, setNewBankIban] = useState('');
  const [newBankType, setNewBankType] = useState<BankAccountType>('BANK_CURRENT');
  const [newBankGlCode, setNewBankGlCode] = useState('1010');
  const [newBankInitialBal, setNewBankInitialBal] = useState<number>(0);

  const handleCreateBankAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountTitle.trim() || !newAccountNumber.trim()) {
      showToast('Account Title and Account Number are required.');
      return;
    }

    const newAccount: BankAccount = {
      id: 'bank-' + Date.now(),
      accountName: newAccountTitle.trim(),
      bankName: newBankName.trim() || (newBankType === 'CASH_DRAWER' ? 'Store Counter Drawer' : 'Commercial Bank'),
      accountNumber: newAccountNumber.trim(),
      iban: newBankIban.trim() || undefined,
      currency: 'PKR',
      type: newBankType,
      branchName: 'Hafeez Center Lahore (LHR-01)',
      openingBalancePkr: newBankInitialBal,
      currentBalancePkr: newBankInitialBal,
      reconciledBalancePkr: newBankInitialBal,
      glAccountCode: newBankGlCode.trim() || '1010',
      isActive: true,
    };

    const updated = erpStorage.saveBankAccount(newAccount);
    setBankAccounts(updated);
    setIsAddBankModalOpen(false);
    setNewBankName('');
    setNewAccountTitle('');
    setNewAccountNumber('');
    setNewBankIban('');
    setNewBankInitialBal(0);
    showToast(`Registered Account ${newAccount.accountName} (${formatPkr(newAccount.currentBalancePkr)})`);
    window.dispatchEvent(new CustomEvent('apex:erp_updated'));
  };

  // 4. Manual Cash/Bank Balance Adjustment Modal
  const [adjustingBank, setAdjustingBank] = useState<BankAccount | null>(null);
  const [newBankBalanceInput, setNewBankBalanceInput] = useState<number>(0);
  const [bankAdjustmentReason, setBankAdjustmentReason] = useState('');

  const handleOpenAdjustBank = (acc: BankAccount) => {
    setAdjustingBank(acc);
    setNewBankBalanceInput(acc.currentBalancePkr || 0);
    setBankAdjustmentReason('');
  };

  const handleSaveAdjustBank = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingBank) return;

    const reason = bankAdjustmentReason.trim() || 'Manual physical cash count / bank statement reconciliation';
    const updated = erpStorage.adjustBankAccountBalance(adjustingBank.id, newBankBalanceInput, reason);
    setBankAccounts(updated);
    setCoaList(erpStorage.getChartOfAccounts());
    setAdjustingBank(null);
    showToast(`Reconciled ${adjustingBank.accountName} to ${formatPkr(newBankBalanceInput)}`);
    window.dispatchEvent(new CustomEvent('apex:erp_updated'));
  };

  // 5. In-App Confirmation Modal for Deletion
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    actionLabel: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    actionLabel: 'Delete',
    onConfirm: () => {},
  });

  const handleDeleteAccountConfirm = (code: string, name: string) => {
    setConfirmModal({
      isOpen: true,
      title: `Delete Account ${code}`,
      message: `Are you sure you want to delete nominal account "${code} - ${name}" from the Chart of Accounts?`,
      actionLabel: 'Delete Account',
      onConfirm: () => {
        const updated = erpStorage.deleteChartOfAccount(code);
        setCoaList(updated);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        showToast(`Deleted Account ${code} - ${name}`);
        window.dispatchEvent(new CustomEvent('apex:erp_updated'));
      },
    });
  };

  const handleDeleteBankConfirm = (acc: BankAccount) => {
    setConfirmModal({
      isOpen: true,
      title: `Remove Account`,
      message: `Are you sure you want to remove bank/cash account "${acc.accountName}" (${acc.accountNumber})?`,
      actionLabel: 'Remove Account',
      onConfirm: () => {
        const updated = erpStorage.deleteBankAccount(acc.id);
        setBankAccounts(updated);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        showToast(`Removed account ${acc.accountName}`);
        window.dispatchEvent(new CustomEvent('apex:erp_updated'));
      },
    });
  };

  // Seeder button if empty
  const handleLoadStandardAccounts = () => {
    const defaultDrawers: BankAccount[] = [
      {
        id: 'acc-pos-counter-1',
        accountName: 'POS Cash Drawer #1 (Store Counter)',
        bankName: 'Retail POS Terminal 1',
        accountNumber: 'DRAWER-POS-01',
        currency: 'PKR',
        type: 'CASH_DRAWER',
        branchName: 'Hafeez Center Lahore (LHR-01)',
        openingBalancePkr: 50000,
        currentBalancePkr: 50000,
        reconciledBalancePkr: 50000,
        glAccountCode: '1001',
        isActive: true,
      },
      {
        id: 'acc-petty-cash',
        accountName: 'Store Petty Cash Fund (Office Float)',
        bankName: 'Petty Cash Safe',
        accountNumber: 'FLOAT-PETTY-01',
        currency: 'PKR',
        type: 'PETTY_CASH',
        branchName: 'Hafeez Center Lahore (LHR-01)',
        openingBalancePkr: 25000,
        currentBalancePkr: 25000,
        reconciledBalancePkr: 25000,
        glAccountCode: '1002',
        isActive: true,
      },
      {
        id: 'acc-meezan-ops',
        accountName: 'Meezan Bank Ltd (Operating Current A/C)',
        bankName: 'Meezan Bank Ltd',
        accountNumber: '01020304050607',
        iban: 'PK64MEZN0001020304050607',
        currency: 'PKR',
        type: 'BANK_CURRENT',
        branchName: 'Main Boulevard Gulberg III, Lahore',
        openingBalancePkr: 450000,
        currentBalancePkr: 450000,
        reconciledBalancePkr: 450000,
        glAccountCode: '1010',
        isActive: true,
      },
      {
        id: 'acc-alfalah-raast',
        accountName: 'Bank Alfalah / Raast Instant Settlement',
        bankName: 'Bank Alfalah Limited',
        accountNumber: '5501-992019-001',
        iban: 'PK42ALFH0055019920190001',
        currency: 'PKR',
        type: 'BANK_CURRENT',
        branchName: 'Gulberg Branch Lahore',
        openingBalancePkr: 180000,
        currentBalancePkr: 180000,
        reconciledBalancePkr: 180000,
        glAccountCode: '1011',
        isActive: true,
      },
    ];

    defaultDrawers.forEach((acc) => erpStorage.saveBankAccount(acc));
    setBankAccounts(erpStorage.getBankAccounts());
    showToast('Loaded standard retail cash drawers & commercial bank accounts.');
    window.dispatchEvent(new CustomEvent('apex:erp_updated'));
  };

  const getClassificationBadgeColor = (cls: AccountClassification) => {
    switch (cls) {
      case 'ASSET':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'LIABILITY':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'EQUITY':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'REVENUE':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
      case 'COGS':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'EXPENSE':
        return 'bg-slate-500/10 text-slate-300 border-slate-500/30';
      default:
        return 'bg-white/10 text-white border-white/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between gap-2 text-emerald-300 text-xs shadow-lg animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{notification}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-emerald-400/60 hover:text-emerald-300 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-emerald-500/30 rounded-2xl p-4 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Total Cash & Bank Liquidity</span>
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-300 font-mono">
            {formatPkr(totalLiquidityPkr)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Drawers & Commercial Banks Combined
          </div>
        </div>

        <div className="bg-slate-900/80 border border-amber-500/30 rounded-2xl p-4 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Store Cash In Hand</span>
            <Coins className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-300 font-mono">
            {formatPkr(cashInHandPkr)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            POS Drawers & Petty Cash Float
          </div>
        </div>

        <div className="bg-slate-900/80 border border-blue-500/30 rounded-2xl p-4 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Commercial Bank Deposits</span>
            <Landmark className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-blue-300 font-mono">
            {formatPkr(bankDepositsPkr)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Meezan, Alfalah & Raast Accounts
          </div>
        </div>

        <div className="bg-slate-900/80 border border-purple-500/30 rounded-2xl p-4 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Chart of Accounts</span>
            <FolderTree className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-purple-300 font-mono">
            {coaList.length} Nominal Heads
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Tiered 1000 - 6000 GL Structure
          </div>
        </div>
      </div>

      {/* Action & Tab Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-white/10">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('coa')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'coa'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <FolderTree className="w-4 h-4" />
            <span>Chart of Accounts (COA)</span>
          </button>

          <button
            onClick={() => setActiveTab('cash_bank')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'cash_bank'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>Manual Cash & Bank Balance Tracking</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'coa' ? (
            <button
              onClick={() => setIsAddAccountModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Add Nominal Account</span>
            </button>
          ) : (
            <button
              onClick={() => setIsAddBankModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Register Bank / Drawer</span>
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: CHART OF ACCOUNTS */}
      {activeTab === 'coa' && (
        <div className="space-y-4">
          {/* Filtering & Classification Pills */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-slate-900/40 p-3 rounded-2xl border border-white/5">
            <div className="flex items-center gap-2 w-full md:w-72 bg-slate-950 px-3 py-2 rounded-xl border border-white/10 text-xs">
              <Search className="w-4 h-4 text-slate-500 shrink-0" />
              <input
                type="text"
                placeholder="Search by code (e.g. 1010) or title..."
                value={coaSearch}
                onChange={(e) => setCoaSearch(e.target.value)}
                className="bg-transparent text-white outline-none w-full"
              />
              {coaSearch && (
                <button onClick={() => setCoaSearch('')} className="text-slate-500 hover:text-white">✕</button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto scrollbar-none pb-1 md:pb-0">
              {(['ALL', 'ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'COGS', 'EXPENSE'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setClassificationFilter(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    classificationFilter === cat
                      ? 'bg-white/15 text-white border border-white/20'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {cat === 'ALL' ? 'All Classes' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Accounts Table */}
          <div className="bg-slate-900/90 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300 font-mono">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] font-bold border-b border-white/10">
                  <tr>
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4 font-sans">Nominal Account Title</th>
                    <th className="py-3 px-4">Classification</th>
                    <th className="py-3 px-4">Account Type</th>
                    <th className="py-3 px-4 text-right">Debit Balance</th>
                    <th className="py-3 px-4 text-right">Credit Balance</th>
                    <th className="py-3 px-4 text-right">Net Balance (PKR)</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredCoa.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500 font-sans">
                        No nominal accounts match your search or filter.
                      </td>
                    </tr>
                  ) : (
                    filteredCoa.map((item) => (
                      <tr
                        key={item.code}
                        className={`hover:bg-white/[0.02] transition-colors ${
                          item.isGroup ? 'bg-white/[0.015] font-bold' : ''
                        }`}
                      >
                        <td className="py-3 px-4 text-amber-400 font-bold">{item.code}</td>
                        <td className="py-3 px-4 font-sans">
                          <div className={item.isGroup ? 'text-white font-bold' : 'text-slate-200'}>
                            {item.name}
                          </div>
                          {item.description && (
                            <div className="text-[10px] text-slate-500 mt-0.5">{item.description}</div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getClassificationBadgeColor(
                              item.classification
                            )}`}
                          >
                            {item.classification}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[11px] text-slate-400">
                          {item.isGroup ? (
                            <span className="text-amber-300 font-bold">Group Header</span>
                          ) : (
                            <span className="text-slate-400">Posting A/C</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right text-emerald-400">
                          {item.currentDebitBalancePkr ? formatPkr(item.currentDebitBalancePkr) : '0'}
                        </td>
                        <td className="py-3 px-4 text-right text-amber-400">
                          {item.currentCreditBalancePkr ? formatPkr(item.currentCreditBalancePkr) : '0'}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-white">
                          {formatPkr(item.netBalancePkr || 0)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenAdjustAccount(item)}
                              className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                              title={`Adjust net balance for ${item.name}`}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            {!item.isGroup && (
                              <button
                                type="button"
                                onClick={() => handleDeleteAccountConfirm(item.code, item.name)}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                                title={`Delete Account ${item.code}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
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
      )}

      {/* TAB 2: MANUAL CASH & BANK BALANCE TRACKING */}
      {activeTab === 'cash_bank' && (
        <div className="space-y-4">
          {/* Header & Quick Seeder if empty */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/40 p-3 rounded-2xl border border-white/5">
            <div className="flex items-center gap-2 w-full sm:w-80 bg-slate-950 px-3 py-2 rounded-xl border border-white/10 text-xs">
              <Search className="w-4 h-4 text-slate-500 shrink-0" />
              <input
                type="text"
                placeholder="Search drawer, bank name, account #..."
                value={bankSearch}
                onChange={(e) => setBankSearch(e.target.value)}
                className="bg-transparent text-white outline-none w-full"
              />
              {bankSearch && (
                <button onClick={() => setBankSearch('')} className="text-slate-500 hover:text-white">✕</button>
              )}
            </div>

            {bankAccounts.length === 0 && (
              <button
                onClick={handleLoadStandardAccounts}
                className="px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Load Standard Store Drawers & Bank Accounts</span>
              </button>
            )}
          </div>

          {/* Bank Accounts Grid / Cards */}
          {filteredBankAccounts.length === 0 ? (
            <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-10 text-center space-y-4">
              <Landmark className="w-12 h-12 text-slate-600 mx-auto" />
              <div className="text-sm font-bold text-white">No Cash Drawers or Bank Accounts Configured</div>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Configure your retail store POS cash drawers, petty cash float, and commercial bank accounts (Meezan, Alfalah, Raast) to track real-time liquidity and perform manual balance reconciliations.
              </p>
              <div className="flex justify-center gap-3 pt-2">
                <button
                  onClick={handleLoadStandardAccounts}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  Load Standard Store Accounts
                </button>
                <button
                  onClick={() => setIsAddBankModalOpen(true)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl text-xs cursor-pointer"
                >
                  Register Custom Account
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredBankAccounts.map((acc) => {
                const isCash = acc.type === 'CASH_DRAWER' || acc.type === 'PETTY_CASH';
                return (
                  <div
                    key={acc.id}
                    className={`bg-slate-900/90 border rounded-2xl p-5 shadow-xl space-y-4 transition-all ${
                      isCash ? 'border-amber-500/30 hover:border-amber-500/50' : 'border-blue-500/30 hover:border-blue-500/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            isCash
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                          }`}
                        >
                          {isCash ? <Coins className="w-5 h-5" /> : <Landmark className="w-5 h-5" />}
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-sm">{acc.accountName}</h4>
                          <p className="text-[11px] text-slate-400 font-mono">
                            {acc.bankName} | GL: <span className="text-amber-300 font-bold">{acc.glAccountCode}</span>
                          </p>
                        </div>
                      </div>

                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isCash
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        }`}
                      >
                        {acc.type.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950 p-3 rounded-xl border border-white/5">
                      <div>
                        <span className="text-slate-500 text-[10px] uppercase font-bold block">Account / Identifier</span>
                        <span className="font-mono text-slate-200 font-bold">{acc.accountNumber}</span>
                        {acc.iban && (
                          <div className="text-[9px] font-mono text-slate-400 truncate mt-0.5" title={acc.iban}>
                            IBAN: {acc.iban}
                          </div>
                        )}
                      </div>

                      <div className="text-right">
                        <span className="text-slate-500 text-[10px] uppercase font-bold block">Current Verified Balance</span>
                        <span className="font-mono text-base font-black text-emerald-400 block">
                          {formatPkr(acc.currentBalancePkr)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span>Active Liquidity Register</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenAdjustBank(acc)}
                          className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all cursor-pointer"
                        >
                          <Scale className="w-3.5 h-3.5" />
                          <span>Count & Adjust</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteBankConfirm(acc)}
                          className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/20 transition-colors cursor-pointer"
                          title={`Remove ${acc.accountName}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL: ADD NOMINAL ACCOUNT (COA) */}
      {/* --------------------------------------------------------------------- */}
      {isAddAccountModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-scale-in">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <FolderTree className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Add Nominal General Ledger Account
                </h3>
              </div>
              <button
                onClick={() => setIsAddAccountModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Nominal Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 1015, 5020"
                    value={newAccCode}
                    onChange={(e) => setNewAccCode(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Classification *</label>
                  <select
                    value={newAccClass}
                    onChange={(e) => setNewAccClass(e.target.value as AccountClassification)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="ASSET">ASSET (1000)</option>
                    <option value="LIABILITY">LIABILITY (2000)</option>
                    <option value="EQUITY">EQUITY (3000)</option>
                    <option value="REVENUE">REVENUE (4000)</option>
                    <option value="COGS">COGS (5000)</option>
                    <option value="EXPENSE">EXPENSE (6000)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Account Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Meezan Bank Current Account, Staff Allowances"
                  value={newAccName}
                  onChange={(e) => setNewAccName(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Parent Group Code (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. 1000"
                    value={newAccParentCode}
                    onChange={(e) => setNewAccParentCode(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Opening Balance (PKR)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={newAccOpeningBal}
                    onChange={(e) => setNewAccOpeningBal(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-emerald-400 font-mono text-right"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chkIsGroup"
                  checked={newAccIsGroup}
                  onChange={(e) => setNewAccIsGroup(e.target.checked)}
                  className="rounded border-white/10 bg-slate-950 text-amber-500"
                />
                <label htmlFor="chkIsGroup" className="text-slate-300">
                  Header Group Account (Non-posting parent classification)
                </label>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Remarks / Description</label>
                <input
                  type="text"
                  placeholder="Optional operational remarks"
                  value={newAccDesc}
                  onChange={(e) => setNewAccDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsAddAccountModalOpen(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                >
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL: ADJUST COA ACCOUNT NET BALANCE */}
      {/* --------------------------------------------------------------------- */}
      {adjustingAccount && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-scale-in">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Adjust Account Net Balance
                </h3>
              </div>
              <button
                onClick={() => setAdjustingAccount(null)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAdjustAccount} className="space-y-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-white/5 space-y-1">
                <div className="text-slate-400">Account:</div>
                <div className="font-bold text-white text-sm">
                  {adjustingAccount.code} - {adjustingAccount.name}
                </div>
                <div className="text-[11px] text-slate-400">
                  Current Net: <span className="font-mono text-emerald-400 font-bold">{formatPkr(adjustingAccount.netBalancePkr || 0)}</span>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">New Verified Net Balance (PKR) *</label>
                <input
                  type="number"
                  required
                  value={adjustedNetBalance}
                  onChange={(e) => setAdjustedNetBalance(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-emerald-400 font-mono text-right text-sm font-bold"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Audit Reason / Remarks *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Month-end physical audit reconciliation"
                  value={adjustAccountReason}
                  onChange={(e) => setAdjustAccountReason(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setAdjustingAccount(null)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  Save Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL: REGISTER CASH DRAWER OR BANK ACCOUNT */}
      {/* --------------------------------------------------------------------- */}
      {isAddBankModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-scale-in">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Landmark className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Register Bank Account or Cash Drawer
                </h3>
              </div>
              <button
                onClick={() => setIsAddBankModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBankAccount} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Account Category *</label>
                  <select
                    value={newBankType}
                    onChange={(e) => {
                      const t = e.target.value as BankAccountType;
                      setNewBankType(t);
                      if (t === 'CASH_DRAWER') setNewBankGlCode('1001');
                      else if (t === 'PETTY_CASH') setNewBankGlCode('1002');
                      else setNewBankGlCode('1010');
                    }}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="CASH_DRAWER">Cash Drawer (Counter Float)</option>
                    <option value="PETTY_CASH">Petty Cash Fund</option>
                    <option value="BANK_CURRENT">Bank Current Account</option>
                    <option value="BANK_SAVINGS">Bank Savings Account</option>
                    <option value="DIGITAL_WALLET">Digital Wallet (JazzCash / Nayapay / Raast)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Bank / Drawer Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Meezan Bank Ltd, Counter 1"
                    value={newBankName}
                    onChange={(e) => setNewBankName(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Account Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Hardware PK (Operating A/C)"
                  value={newAccountTitle}
                  onChange={(e) => setNewAccountTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Account / Raast / Drawer # *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 01020304050607 or DRAWER-01"
                    value={newAccountNumber}
                    onChange={(e) => setNewAccountNumber(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">IBAN (Optional)</label>
                  <input
                    type="text"
                    placeholder="PK64MEZN000..."
                    value={newBankIban}
                    onChange={(e) => setNewBankIban(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Linked GL Nominal Code *</label>
                  <select
                    value={newBankGlCode}
                    onChange={(e) => setNewBankGlCode(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                  >
                    {coaList
                      .filter((c) => !c.isGroup && c.classification === 'ASSET')
                      .map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} - {c.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Opening Balance (PKR)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={newBankInitialBal}
                    onChange={(e) => setNewBankInitialBal(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-emerald-400 font-mono text-right"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsAddBankModalOpen(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  Register Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL: MANUAL PHYSICAL CASH COUNT & BANK RECONCILIATION */}
      {/* --------------------------------------------------------------------- */}
      {adjustingBank && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-scale-in">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Physical Count / Balance Reconciliation
                </h3>
              </div>
              <button
                onClick={() => setAdjustingBank(null)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAdjustBank} className="space-y-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-white/5 space-y-1">
                <div className="text-slate-400">Account / Drawer:</div>
                <div className="font-bold text-white text-sm">{adjustingBank.accountName}</div>
                <div className="text-[11px] font-mono text-slate-400">
                  {adjustingBank.bankName} ({adjustingBank.accountNumber}) | GL: {adjustingBank.glAccountCode}
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-white/5">
                  <span className="text-slate-400">Recorded System Balance:</span>
                  <span className="font-mono font-bold text-white">
                    {formatPkr(adjustingBank.currentBalancePkr || 0)}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">
                  New Verified Count / Bank Statement Balance (PKR) *
                </label>
                <input
                  type="number"
                  required
                  value={newBankBalanceInput}
                  onChange={(e) => setNewBankBalanceInput(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-emerald-400 font-mono text-right text-base font-bold"
                />
              </div>

              {/* Variance Indicator */}
              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex justify-between items-center text-xs">
                <span className="text-slate-400">Reconciliation Variance:</span>
                {(() => {
                  const diff = newBankBalanceInput - (adjustingBank.currentBalancePkr || 0);
                  if (diff === 0) {
                    return <span className="text-emerald-400 font-mono font-bold">0 PKR (Balanced)</span>;
                  } else if (diff > 0) {
                    return (
                      <span className="text-emerald-400 font-mono font-bold">
                        +{formatPkr(diff)} (Surplus)
                      </span>
                    );
                  } else {
                    return (
                      <span className="text-rose-400 font-mono font-bold">
                        -{formatPkr(Math.abs(diff))} (Shortage)
                      </span>
                    );
                  }
                })()}
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Reconciliation Remarks / Audit Reason *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. End-of-shift register count, Monthly statement close"
                  value={bankAdjustmentReason}
                  onChange={(e) => setBankAdjustmentReason(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setAdjustingBank(null)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  Apply & Synchronize GL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* CONFIRMATION MODAL FOR DELETIONS */}
      {/* --------------------------------------------------------------------- */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-scale-in">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-white">{confirmModal.title}</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{confirmModal.message}</p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-colors cursor-pointer"
              >
                {confirmModal.actionLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
