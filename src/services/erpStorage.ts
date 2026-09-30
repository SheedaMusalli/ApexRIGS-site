import {
  Branch,
  Customer,
  SalesDocument,
  CustomerReceipt,
  Vendor,
  PurchaseDocument,
  LetterOfCredit,
  InterWarehouseTransfer,
  StockAdjustment,
  BillOfMaterials,
  AssemblyOrder,
  DisassemblyOrder,
  BankAccount,
  FinancialVoucher,
  BankReconciliationRecord,
  ChartOfAccountItem,
  JournalEntry,
  FixedAsset,
  AccountingPeriodLock,
  TaxConfiguration,
  DepartmentBudget,
  AuditLogEntry,
  DocumentAttachment,
  BranchLocationId
} from '../types/erp';
import { Product } from '../types';
import { authFetch } from '../utils/apiClient';

// ============================================================================
// CLEAN PRODUCTION INITIALIZATION FOR APEX ENTERPRISE ERP
// ============================================================================

export const SEED_BRANCHES: Branch[] = [
  {
    id: 'lahore_hafeez',
    name: 'Apex Retail Store Outlet (Hafeez Center)',
    code: 'LHR-RETAIL',
    city: 'Lahore',
    address: 'Shop 12-A, 3rd Floor, Hafeez Center, Gulberg iii, Lahore',
    phone: '+447597030688',
    isHeadOffice: true,
    gstNumber: '03-00-9999-123-11',
    ntnNumber: '7829103-4',
    managerName: 'Hammad Ur Rehman',
  },
];

export const SEED_CUSTOMERS: Customer[] = [];

export const SEED_VENDORS: Vendor[] = [];

export const SEED_BANK_ACCOUNTS: BankAccount[] = [
  {
    id: 'bank-cash-in-hand',
    accountName: 'Cash in Hand',
    bankName: 'Cash in Hand (Counter / POS)',
    accountNumber: 'CASH-001',
    currency: 'PKR',
    type: 'CASH_DRAWER',
    branchName: 'Shop 12-A, Hafeez Center, Lahore',
    openingBalancePkr: 0,
    currentBalancePkr: 0,
    reconciledBalancePkr: 0,
    glAccountCode: '1001',
    isActive: true,
  },
  {
    id: 'bank-settlement',
    accountName: 'Settlement Account',
    bankName: 'Settlement (Card/Online Gateways)',
    accountNumber: 'SETTLE-001',
    currency: 'PKR',
    type: 'BANK_CURRENT',
    branchName: 'Lahore',
    openingBalancePkr: 0,
    currentBalancePkr: 0,
    reconciledBalancePkr: 0,
    glAccountCode: '1011',
    isActive: true,
  },
  {
    id: 'bank-ubl-01',
    accountName: 'Apex Hardware PK',
    bankName: 'UBL (United Bank Limited)',
    accountNumber: 'Account Number Pending',
    iban: '',
    currency: 'PKR',
    type: 'BANK_CURRENT',
    branchName: 'Lahore',
    openingBalancePkr: 0,
    currentBalancePkr: 0,
    reconciledBalancePkr: 0,
    glAccountCode: '1010',
    isActive: true,
  },
  {
    id: 'bank-petty-cash',
    accountName: 'Store Petty Cash',
    bankName: 'Office Drawer',
    accountNumber: 'PETTY-001',
    currency: 'PKR',
    type: 'CASH_DRAWER',
    branchName: 'Office',
    openingBalancePkr: 0,
    currentBalancePkr: 0,
    reconciledBalancePkr: 0,
    glAccountCode: '1002',
    isActive: true,
  }
];

export const SEED_CHART_OF_ACCOUNTS: ChartOfAccountItem[] = [
  // 1000 - ASSETS
  { code: '1000', name: 'CURRENT ASSETS', classification: 'ASSET', isGroup: true, currentDebitBalancePkr: 0, currentCreditBalancePkr: 0, netBalancePkr: 0 },
  { code: '1001', name: 'Cash in Hand (POS Drawers)', classification: 'ASSET', parentCode: '1000', isGroup: false, currentDebitBalancePkr: 0, currentCreditBalancePkr: 0, netBalancePkr: 0 },
  { code: '1002', name: 'Petty Cash Fund', classification: 'ASSET', parentCode: '1000', isGroup: false, currentDebitBalancePkr: 0, currentCreditBalancePkr: 0, netBalancePkr: 0 },
  { code: '1011', name: 'Settlement Accounts (Gateways)', classification: 'ASSET', parentCode: '1000', isGroup: false, currentDebitBalancePkr: 0, currentCreditBalancePkr: 0, netBalancePkr: 0 },
  { code: '1010', name: 'Bank Operating Accounts', classification: 'ASSET', parentCode: '1000', isGroup: false, currentDebitBalancePkr: 0, currentCreditBalancePkr: 0, netBalancePkr: 0 },
  { code: '1100', name: 'Accounts Receivable (Trade Debtors)', classification: 'ASSET', parentCode: '1000', isGroup: false, currentDebitBalancePkr: 0, currentCreditBalancePkr: 0, netBalancePkr: 0 },
  { code: '1200', name: 'Inventory Asset (Hardware & Components)', classification: 'ASSET', parentCode: '1000', isGroup: false, currentDebitBalancePkr: 0, currentCreditBalancePkr: 0, netBalancePkr: 0 },
  { code: '1300', name: 'Input GST / Sales Tax Refundable (FBR)', classification: 'ASSET', parentCode: '1000', isGroup: false, currentDebitBalancePkr: 0, currentCreditBalancePkr: 0, netBalancePkr: 0 },
  { code: '1310', name: 'Advance Income Tax & WHT Withheld by Clients', classification: 'ASSET', parentCode: '1000', isGroup: false, currentDebitBalancePkr: 0, currentCreditBalancePkr: 0, netBalancePkr: 0 },

  // NON-CURRENT ASSETS
  { code: '1500', name: 'PROPERTY, PLANT & EQUIPMENT (FIXED ASSETS)', classification: 'ASSET', isGroup: true, currentDebitBalancePkr: 0, currentCreditBalancePkr: 0, netBalancePkr: 0 },
  { code: '1510', name: 'Store Fixtures & Displays', classification: 'ASSET', parentCode: '1500', isGroup: false, currentDebitBalancePkr: 0, currentCreditBalancePkr: 0, netBalancePkr: 0 },
  { code: '1590', name: 'Less: Accumulated Depreciation', classification: 'ASSET', parentCode: '1500', isGroup: false, currentDebitBalancePkr: 0, currentCreditBalancePkr: 0, netBalancePkr: 0 },

  // 2000 - LIABILITIES
  { code: '2000', name: 'CURRENT LIABILITIES', classification: 'LIABILITY', isGroup: true, currentDebitBalancePkr: 0, currentCreditBalancePkr: 0, netBalancePkr: 0 },
  { code: '2010', name: 'Accounts Payable (Trade Creditors)', classification: 'LIABILITY', parentCode: '2000', isGroup: false, currentDebitBalancePkr: 0, currentCreditBalancePkr: 0, netBalancePkr: 0 },
  { code: '2020', name: 'Output Sales Tax (GST Payable to FBR)', classification: 'LIABILITY', parentCode: '2000', isGroup: false, currentDebitBalancePkr: 0, currentCreditBalancePkr: 0, netBalancePkr: 0 },
  { code: '2030', name: 'Withholding Tax (WHT Payable)', classification: 'LIABILITY', parentCode: '2000', isGroup: false, currentDebitBalancePkr: 0, currentCreditBalancePkr: 0, netBalancePkr: 0 },

  // 3000 - EQUITY
  { code: '3000', name: "OWNER'S EQUITY & RESERVES", classification: 'EQUITY', isGroup: true, currentDebitBalancePkr: 0, currentCreditBalancePkr: 0, netBalancePkr: 0 },
  { code: '3010', name: 'Paid-Up Share Capital / Owner Investment', classification: 'EQUITY', parentCode: '3000', isGroup: false, currentDebitBalancePkr: 0, currentCreditBalancePkr: 0, netBalancePkr: 0 },
  { code: '3020', name: 'Retained Earnings', classification: 'EQUITY', parentCode: '3000', isGroup: false, currentDebitBalancePkr: 0, currentCreditBalancePkr: 0, netBalancePkr: 0 },

  // 4000 - REVENUE
  { code: '4000', name: 'SALES REVENUE', classification: 'REVENUE', isGroup: true, currentDebitBalancePkr: 0, currentCreditBalancePkr: 0, netBalancePkr: 0 },
  { code: '4010', name: 'Retail Hardware Sales', classification: 'REVENUE', parentCode: '4000', isGroup: false, currentDebitBalancePkr: 0, currentCreditBalancePkr: 0, netBalancePkr: 0 },
  { code: '4020', name: 'Custom PC Assembly Revenue', classification: 'REVENUE', parentCode: '4000', isGroup: false, currentDebitBalancePkr: 0, currentCreditBalancePkr: 0, netBalancePkr: 0 },

  // 5000 - COST OF GOODS SOLD (COGS)
  { code: '5000', name: 'COST OF GOODS SOLD', classification: 'COGS', isGroup: true, currentDebitBalancePkr: 0, currentCreditBalancePkr: 0, netBalancePkr: 0 },
  { code: '5010', name: 'Cost of Hardware Sold', classification: 'COGS', parentCode: '5000', isGroup: false, currentDebitBalancePkr: 0, currentCreditBalancePkr: 0, netBalancePkr: 0 },
  { code: '5030', name: 'Freight & Courier Delivery Charges', classification: 'COGS', parentCode: '5000', isGroup: false, currentDebitBalancePkr: 0, currentCreditBalancePkr: 0, netBalancePkr: 0 },

  // 6000 - OPERATING EXPENSES
  { code: '6000', name: 'OPERATING & ADMINISTRATIVE EXPENSES', classification: 'EXPENSE', isGroup: true, currentDebitBalancePkr: 0, currentCreditBalancePkr: 0, netBalancePkr: 0 },
  { code: '6010', name: 'Rent & Maintenance', classification: 'EXPENSE', parentCode: '6000', isGroup: false, currentDebitBalancePkr: 0, currentCreditBalancePkr: 0, netBalancePkr: 0 },
  { code: '6020', name: 'Staff Salaries', classification: 'EXPENSE', parentCode: '6000', isGroup: false, currentDebitBalancePkr: 0, currentCreditBalancePkr: 0, netBalancePkr: 0 },
  { code: '6030', name: 'Electricity & Utilities', classification: 'EXPENSE', parentCode: '6000', isGroup: false, currentDebitBalancePkr: 0, currentCreditBalancePkr: 0, netBalancePkr: 0 },
  { code: '6040', name: 'Marketing & Digital Ads', classification: 'EXPENSE', parentCode: '6000', isGroup: false, currentDebitBalancePkr: 0, currentCreditBalancePkr: 0, netBalancePkr: 0 },
  { code: '6060', name: 'Bank Charges & Raast Fees', classification: 'EXPENSE', parentCode: '6000', isGroup: false, currentDebitBalancePkr: 0, currentCreditBalancePkr: 0, netBalancePkr: 0 },
];

export const SEED_TAX_CONFIG: TaxConfiguration = {
  standardGstPercent: 18,
  reducedGstPercent: 5,
  serviceGstPercent: 16,
  whtGoodsActiveFilerPercent: 4.5,
  whtGoodsNonFilerPercent: 9.0,
  whtServicesActiveFilerPercent: 1.5,
  whtServicesNonFilerPercent: 3.0,
  fedPercent: 0,
  fbrNtnNumber: '',
  fbrStrnNumber: '',
  praRegistrationNumber: '',
  srbRegistrationNumber: '',
};

export const SEED_FIXED_ASSETS: FixedAsset[] = [];

export const SEED_BOMS: BillOfMaterials[] = [];

export const SEED_SALES_DOCS: SalesDocument[] = [];

export const SEED_PURCHASE_DOCS: PurchaseDocument[] = [];

export const SEED_VOUCHERS: FinancialVoucher[] = [];

export const SEED_AUDIT_LOGS: AuditLogEntry[] = [];

// ============================================================================
// ERP LOCAL STORAGE CLIENT & REACTIVE CACHE ENGINE
// ============================================================================

const STORAGE_KEYS = {
  BRANCHES: 'apex_erp_branches_v3',
  CUSTOMERS: 'apex_erp_customers_v3',
  VENDORS: 'apex_erp_vendors_v3',
  BANK_ACCOUNTS: 'apex_erp_bank_accounts_v3',
  COA: 'apex_erp_chart_of_accounts_v3',
  TAX_CONFIG: 'apex_erp_tax_config_v3',
  FIXED_ASSETS: 'apex_erp_fixed_assets_v3',
  BOMS: 'apex_erp_boms_v3',
  SALES_DOCS: 'apex_erp_sales_docs_v3',
  PURCHASE_DOCS: 'apex_erp_purchase_docs_v3',
  VOUCHERS: 'apex_erp_vouchers_v3',
  AUDIT_LOGS: 'apex_erp_audit_logs_v3',
  ACTIVE_BRANCH: 'apex_erp_active_branch_v3',
  PERIOD_LOCK: 'apex_erp_period_lock_v3',
  TRANSFERS: 'apex_erp_transfers_v3',
  ADJUSTMENTS: 'apex_erp_adjustments_v3',
  ASSEMBLY_ORDERS: 'apex_erp_assembly_orders_v3',
  JOURNALS: 'apex_erp_journals_v3',
};

class ErpDataService {
  private get<T>(key: string, defaultValue: T): T {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) {
        localStorage.setItem(key, JSON.stringify(defaultValue));
        return defaultValue;
      }
      return JSON.parse(stored) as T;
    } catch {
      return defaultValue;
    }
  }

  private set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('apex:erp_updated', { detail: { key, value } }));
        try {
          const bc = new BroadcastChannel('apex_erp_channel');
          bc.postMessage({ type: 'erp_updated', key });
          bc.close();
        } catch {
          // ignore BroadcastChannel if not supported in iframe
        }
      }
    } catch (e) {
      throw new Error('Unable to save ERP data. Check browser storage space and try again.');
    }
  }

  // --- BRANCHES ---
  getBranches(): Branch[] {
    return this.get<Branch[]>(STORAGE_KEYS.BRANCHES, SEED_BRANCHES);
  }

  getActiveBranchId(): BranchLocationId {
    return this.get<BranchLocationId>(STORAGE_KEYS.ACTIVE_BRANCH, 'lahore_hafeez');
  }

  setActiveBranchId(branchId: BranchLocationId): void {
    this.set(STORAGE_KEYS.ACTIVE_BRANCH, branchId);
  }

  // --- CUSTOMERS ---
  getCustomers(): Customer[] {
    return this.get<Customer[]>(STORAGE_KEYS.CUSTOMERS, SEED_CUSTOMERS);
  }

  saveCustomer(customer: Customer, sync = true): Customer[] {
    if (sync) authFetch('/api/erp/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(customer) })
      .then(async response => { if (!response.ok) throw new Error((await response.json()).error || 'Customer could not be saved on the server.'); })
      .catch(error => window.dispatchEvent(new CustomEvent('apex:erp_sync_error', { detail: error.message })));
    const list = this.getCustomers();
    const idx = list.findIndex((c) => c.id === customer.id);
    if (idx >= 0) {
      list[idx] = customer;
    } else {
      list.unshift(customer);
    }
    this.set(STORAGE_KEYS.CUSTOMERS, list);
    this.logAction('SALES', 'CREATE', 'CUSTOMER', customer.id, `Saved customer record ${customer.name}`);
    return list;
  }

  deleteCustomer(customerId: string): Customer[] {
    const list = this.getCustomers().filter((c) => c.id !== customerId && c.name !== customerId);
    this.set(STORAGE_KEYS.CUSTOMERS, list);
    this.logAction('SALES', 'DELETE', 'CUSTOMER', customerId, `Deleted customer record`);
    fetch(`/api/erp/customers/${encodeURIComponent(customerId)}`, { method: 'DELETE' }).catch(() => {});
    return list;
  }

  // --- VENDORS ---
  getVendors(): Vendor[] {
    return this.get<Vendor[]>(STORAGE_KEYS.VENDORS, SEED_VENDORS);
  }

  saveVendor(vendor: Vendor): Vendor[] {
    const list = this.getVendors();
    const idx = list.findIndex((v) => v.id === vendor.id);
    if (idx >= 0) {
      list[idx] = vendor;
    } else {
      list.unshift(vendor);
    }
    this.set(STORAGE_KEYS.VENDORS, list);
    this.logAction('PURCHASES', 'CREATE', 'VENDOR', vendor.id, `Saved vendor ${vendor.name}`);
    return list;
  }

  deleteVendor(vendorId: string): Vendor[] {
    const list = this.getVendors().filter((v) => v.id !== vendorId && v.name !== vendorId);
    this.set(STORAGE_KEYS.VENDORS, list);
    this.logAction('PURCHASES', 'DELETE', 'VENDOR', vendorId, `Deleted vendor record`);
    fetch(`/api/erp/vendors/${encodeURIComponent(vendorId)}`, { method: 'DELETE' }).catch(() => {});
    return list;
  }

  // --- SALES DOCUMENTS ---
  getSalesDocuments(): SalesDocument[] {
    return this.get<SalesDocument[]>(STORAGE_KEYS.SALES_DOCS, SEED_SALES_DOCS);
  }

  getInvoices(): SalesDocument[] {
    return this.getSalesDocuments().filter((d) => d.type === 'INVOICE');
  }

  saveSalesDocument(doc: SalesDocument): SalesDocument[] {
    const list = this.getSalesDocuments();
    const idx = list.findIndex((d) => d.id === doc.id);
    if (idx >= 0) {
      list[idx] = { ...doc, updatedAt: new Date().toISOString() };
    } else {
      list.unshift(doc);
    }
    this.set(STORAGE_KEYS.SALES_DOCS, list);
    this.logAction('SALES', 'POST', doc.type, doc.docNumber, `Processed ${doc.type} for ${doc.customerName} Total PKR ${doc.grandTotalPkr.toLocaleString()}`);
    return list;
  }

  deleteSalesDocument(docId: string): SalesDocument[] {
    const list = this.getSalesDocuments().filter((d) => d.id !== docId && d.docNumber !== docId);
    this.set(STORAGE_KEYS.SALES_DOCS, list);
    this.logAction('SALES', 'DELETE', 'DOCUMENT', docId, `Deleted sales document`);
    fetch(`/api/erp/sales-docs/${encodeURIComponent(docId)}`, { method: 'DELETE' }).catch(() => {});
    return list;
  }

  // --- PURCHASES ---
  getPurchaseDocuments(): PurchaseDocument[] {
    return this.get<PurchaseDocument[]>(STORAGE_KEYS.PURCHASE_DOCS, SEED_PURCHASE_DOCS);
  }

  savePurchaseDocument(doc: PurchaseDocument): PurchaseDocument[] {
    const list = this.getPurchaseDocuments();
    const idx = list.findIndex((d) => d.id === doc.id);
    if (idx >= 0) {
      list[idx] = doc;
    } else {
      list.unshift(doc);
    }
    this.set(STORAGE_KEYS.PURCHASE_DOCS, list);
    this.logAction('PURCHASES', 'POST', doc.type, doc.docNumber, `Recorded ${doc.type} from ${doc.vendorName} Total PKR ${doc.grandTotalPkr.toLocaleString()}`);
    return list;
  }

  deletePurchaseDocument(docId: string): PurchaseDocument[] {
    const list = this.getPurchaseDocuments().filter((d) => d.id !== docId && d.docNumber !== docId);
    this.set(STORAGE_KEYS.PURCHASE_DOCS, list);
    this.logAction('PURCHASES', 'DELETE', 'DOCUMENT', docId, `Deleted purchase document`);
    fetch(`/api/erp/purchase-docs/${encodeURIComponent(docId)}`, { method: 'DELETE' }).catch(() => {});
    return list;
  }

  // --- BANK ACCOUNTS & VOUCHERS ---
  getBankAccounts(): BankAccount[] {
    const list = this.get<BankAccount[]>(STORAGE_KEYS.BANK_ACCOUNTS, SEED_BANK_ACCOUNTS);
    if (!list || list.length === 0) {
      this.set(STORAGE_KEYS.BANK_ACCOUNTS, SEED_BANK_ACCOUNTS);
      return SEED_BANK_ACCOUNTS;
    }
    
    const hasCash = list.some((a) => a.accountName.toLowerCase().includes('cash in hand'));
    const hasSettlement = list.some((a) => a.id === 'bank-settlement' || a.accountName.includes('Settlement'));
    
    let updated = false;
    if (!hasCash) {
      list.unshift(SEED_BANK_ACCOUNTS.find(b => b.id === 'bank-cash-in-hand') || SEED_BANK_ACCOUNTS[0]);
      updated = true;
    }
    if (!hasSettlement) {
      const settleAcc = SEED_BANK_ACCOUNTS.find(b => b.id === 'bank-settlement');
      if (settleAcc) list.push(settleAcc);
      updated = true;
    }
    
    if (updated) {
      this.set(STORAGE_KEYS.BANK_ACCOUNTS, list);
    }
    return list;

  }

  saveBankAccount(acc: BankAccount): BankAccount[] {
    const list = this.getBankAccounts();
    const idx = list.findIndex((a) => a.id === acc.id);
    if (idx >= 0) list[idx] = acc;
    else list.push(acc);
    this.set(STORAGE_KEYS.BANK_ACCOUNTS, list);
    this.logAction('TREASURY', 'CREATE', 'BANK_ACCOUNT', acc.accountName, `Saved bank/cash account ${acc.accountName}`);
    authFetch('/api/erp/bank-accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(acc),
    }).catch(() => {});
    return list;
  }

  deleteBankAccount(accId: string): BankAccount[] {
    const list = this.getBankAccounts().filter((a) => a.id !== accId && a.accountName !== accId);
    this.set(STORAGE_KEYS.BANK_ACCOUNTS, list);
    this.logAction('TREASURY', 'DELETE', 'BANK_ACCOUNT', accId, `Deleted bank/cash account`);
    authFetch(`/api/erp/bank-accounts/${encodeURIComponent(accId)}`, { method: 'DELETE' }).catch(() => {});
    return list;
  }

  adjustBankAccountBalance(accId: string, newBalancePkr: number, reason: string): BankAccount[] {
    const list = this.getBankAccounts();
    const idx = list.findIndex((a) => a.id === accId);
    if (idx >= 0) {
      const oldBal = list[idx].currentBalancePkr || 0;
      list[idx].currentBalancePkr = newBalancePkr;
      list[idx].reconciledBalancePkr = newBalancePkr;
      this.set(STORAGE_KEYS.BANK_ACCOUNTS, list);

      if (list[idx].glAccountCode) {
        const coa = this.getChartOfAccounts();
        const codeIdx = coa.findIndex((c) => c.code === list[idx].glAccountCode);
        if (codeIdx >= 0) {
          coa[codeIdx].netBalancePkr = newBalancePkr;
          coa[codeIdx].currentDebitBalancePkr = newBalancePkr >= 0 ? newBalancePkr : 0;
          coa[codeIdx].currentCreditBalancePkr = newBalancePkr < 0 ? Math.abs(newBalancePkr) : 0;
          this.set(STORAGE_KEYS.COA, coa);
        }
      }

      this.logAction(
        'TREASURY',
        'UPDATE',
        'BANK_BALANCE',
        list[idx].accountName,
        `Adjusted balance from PKR ${oldBal.toLocaleString()} to PKR ${newBalancePkr.toLocaleString()}. Reason: ${reason}`
      );
    }
    return list;
  }

  getVouchers(): FinancialVoucher[] {
    return this.get<FinancialVoucher[]>(STORAGE_KEYS.VOUCHERS, SEED_VOUCHERS);
  }

  async saveVoucher(voucher: FinancialVoucher): Promise<FinancialVoucher[]> {
    // Server confirms both the voucher and cash change before the UI reports success.
    const response = await authFetch('/api/erp/vouchers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(voucher),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Voucher could not be saved.');
    const list = result.vouchers as FinancialVoucher[];
    this.set(STORAGE_KEYS.VOUCHERS, list);
    this.set(STORAGE_KEYS.BANK_ACCOUNTS, result.bankAccounts);
    this.logAction('TREASURY', 'POST', 'VOUCHER', voucher.voucherNumber, `Posted ${voucher.type} PKR ${voucher.netPaidOrReceivedPkr}`);
    return list;
  }

  async deleteVoucher(voucherId: string): Promise<FinancialVoucher[]> {
    const response = await authFetch(`/api/erp/vouchers/${encodeURIComponent(voucherId)}`, { method: 'DELETE' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Voucher could not be deleted.');
    this.set(STORAGE_KEYS.VOUCHERS, result.vouchers);
    this.set(STORAGE_KEYS.BANK_ACCOUNTS, result.bankAccounts);
    this.logAction('TREASURY', 'DELETE', 'VOUCHER', voucherId, 'Deleted voucher and reversed cash posting.');
    return result.vouchers;
  }

  async refreshTreasury(): Promise<void> {
    const response = await authFetch('/api/erp/treasury');
    if (!response.ok) throw new Error('Could not load bank accounts and vouchers. Sign in and try again.');
    const data = await response.json();
    this.set(STORAGE_KEYS.BANK_ACCOUNTS, data.bankAccounts);
    this.set(STORAGE_KEYS.VOUCHERS, data.vouchers);
  }

  // --- CHART OF ACCOUNTS ---
  getChartOfAccounts(): ChartOfAccountItem[] {
    return this.get<ChartOfAccountItem[]>(STORAGE_KEYS.COA, SEED_CHART_OF_ACCOUNTS);
  }

  saveChartOfAccount(item: ChartOfAccountItem): ChartOfAccountItem[] {
    const list = this.getChartOfAccounts();
    const idx = list.findIndex((c) => c.code === item.code);
    if (idx >= 0) list[idx] = item;
    else list.push(item);
    list.sort((a, b) => a.code.localeCompare(b.code));
    this.set(STORAGE_KEYS.COA, list);
    return list;
  }

  deleteChartOfAccount(code: string): ChartOfAccountItem[] {
    const list = this.getChartOfAccounts().filter((c) => c.code !== code && c.name !== code);
    this.set(STORAGE_KEYS.COA, list);
    this.logAction('GENERAL_LEDGER', 'DELETE', 'ACCOUNT', code, `Deleted account ${code} from Chart of Accounts`);
    return list;
  }

  adjustChartOfAccountBalance(code: string, newNetBalancePkr: number, reason: string): ChartOfAccountItem[] {
    const list = this.getChartOfAccounts();
    const idx = list.findIndex((c) => c.code === code);
    if (idx >= 0) {
      const oldNet = list[idx].netBalancePkr || 0;
      list[idx].netBalancePkr = newNetBalancePkr;
      if (
        list[idx].classification === 'ASSET' ||
        list[idx].classification === 'EXPENSE' ||
        list[idx].classification === 'COGS'
      ) {
        list[idx].currentDebitBalancePkr = newNetBalancePkr >= 0 ? newNetBalancePkr : 0;
        list[idx].currentCreditBalancePkr = newNetBalancePkr < 0 ? Math.abs(newNetBalancePkr) : 0;
      } else {
        list[idx].currentCreditBalancePkr = newNetBalancePkr >= 0 ? newNetBalancePkr : 0;
        list[idx].currentDebitBalancePkr = newNetBalancePkr < 0 ? Math.abs(newNetBalancePkr) : 0;
      }
      this.set(STORAGE_KEYS.COA, list);

      const banks = this.getBankAccounts();
      const bIdx = banks.findIndex((b) => b.glAccountCode === code);
      if (bIdx >= 0) {
        banks[bIdx].currentBalancePkr = newNetBalancePkr;
        banks[bIdx].reconciledBalancePkr = newNetBalancePkr;
        this.set(STORAGE_KEYS.BANK_ACCOUNTS, banks);
      }

      this.logAction(
        'GENERAL_LEDGER',
        'UPDATE',
        'COA_BALANCE',
        code,
        `Adjusted balance for ${code} (${list[idx].name}) from PKR ${oldNet.toLocaleString()} to PKR ${newNetBalancePkr.toLocaleString()}. Reason: ${reason}`
      );
    }
    return list;
  }

  // --- JOURNALS ---
  getJournals(): JournalEntry[] {
    return this.get<JournalEntry[]>(STORAGE_KEYS.JOURNALS, []);
  }

  getJournalEntries(): JournalEntry[] {
    return this.getJournals();
  }

  saveJournal(jv: JournalEntry): JournalEntry[] {
    const list = this.getJournals();
    const idx = list.findIndex((j) => j.id === jv.id);
    if (idx >= 0) list[idx] = jv;
    else list.unshift(jv);
    this.set(STORAGE_KEYS.JOURNALS, list);
    this.logAction('GENERAL_LEDGER', 'POST', 'JOURNAL', jv.entryNumber, `Posted JV ${jv.entryNumber} PKR ${jv.totalDebitPkr.toLocaleString()}`);
    return list;
  }

  deleteJournal(journalId: string): JournalEntry[] {
    const list = this.getJournals().filter((j) => j.id !== journalId && j.entryNumber !== journalId);
    this.set(STORAGE_KEYS.JOURNALS, list);
    this.logAction('GENERAL_LEDGER', 'DELETE', 'JOURNAL', journalId, `Deleted journal entry ${journalId}`);
    return list;
  }

  // --- TAX CONFIG ---
  getTaxConfig(): TaxConfiguration {
    return this.get<TaxConfiguration>(STORAGE_KEYS.TAX_CONFIG, SEED_TAX_CONFIG);
  }

  saveTaxConfig(config: TaxConfiguration): void {
    this.set(STORAGE_KEYS.TAX_CONFIG, config);
    this.logAction('TAXATION', 'UPDATE', 'CONFIG', 'FBR_GST', 'Updated national/provincial tax rates');
  }

  // --- FIXED ASSETS ---
  getFixedAssets(): FixedAsset[] {
    return this.get<FixedAsset[]>(STORAGE_KEYS.FIXED_ASSETS, SEED_FIXED_ASSETS);
  }

  saveFixedAsset(asset: FixedAsset): FixedAsset[] {
    const list = this.getFixedAssets();
    const idx = list.findIndex((a) => a.id === asset.id);
    if (idx >= 0) list[idx] = asset;
    else list.push(asset);
    this.set(STORAGE_KEYS.FIXED_ASSETS, list);
    this.logAction('GENERAL_LEDGER', 'CREATE', 'ASSET', asset.assetCode, `Registered fixed asset ${asset.assetName}`);
    return list;
  }

  deleteFixedAsset(assetId: string): FixedAsset[] {
    const list = this.getFixedAssets().filter((a) => a.id !== assetId);
    this.set(STORAGE_KEYS.FIXED_ASSETS, list);
    this.logAction('GENERAL_LEDGER', 'DELETE', 'ASSET', assetId, `Deleted fixed asset`);
    return list;
  }

  // --- BILL OF MATERIALS (BOM) & PRODUCTION ---
  getBOMs(): BillOfMaterials[] {
    return this.get<BillOfMaterials[]>(STORAGE_KEYS.BOMS, SEED_BOMS);
  }

  saveBOM(bom: BillOfMaterials): BillOfMaterials[] {
    const list = this.getBOMs();
    const idx = list.findIndex((b) => b.id === bom.id);
    if (idx >= 0) list[idx] = bom;
    else list.push(bom);
    this.set(STORAGE_KEYS.BOMS, list);
    this.logAction('MANUFACTURING', 'CREATE', 'BOM', bom.bomCode, `Created BOM recipe ${bom.finishedProductName}`);
    return list;
  }

  deleteBOM(bomId: string): BillOfMaterials[] {
    const list = this.getBOMs().filter((b) => b.id !== bomId);
    this.set(STORAGE_KEYS.BOMS, list);
    this.logAction('MANUFACTURING', 'DELETE', 'BOM', bomId, `Deleted BOM recipe`);
    return list;
  }

  getAssemblyOrders(): AssemblyOrder[] {
    return this.get<AssemblyOrder[]>(STORAGE_KEYS.ASSEMBLY_ORDERS, []);
  }

  saveAssemblyOrder(order: AssemblyOrder): AssemblyOrder[] {
    const list = this.getAssemblyOrders();
    const idx = list.findIndex((o) => o.id === order.id);
    if (idx >= 0) list[idx] = order;
    else list.unshift(order);
    this.set(STORAGE_KEYS.ASSEMBLY_ORDERS, list);
    this.logAction('MANUFACTURING', 'CREATE', 'ASSEMBLY_ORDER', order.orderNumber, `Created Assembly Order ${order.orderNumber}`);
    return list;
  }

  getTransfers(): InterWarehouseTransfer[] {
    return this.get<InterWarehouseTransfer[]>(STORAGE_KEYS.TRANSFERS, []);
  }

  saveTransfer(trf: InterWarehouseTransfer): InterWarehouseTransfer[] {
    const list = this.getTransfers();
    const idx = list.findIndex((t) => t.id === trf.id);
    if (idx >= 0) list[idx] = trf;
    else list.unshift(trf);
    this.set(STORAGE_KEYS.TRANSFERS, list);
    this.logAction('INVENTORY', 'CREATE', 'TRANSFER', trf.transferNumber, `Dispatched transfer ${trf.transferNumber}`);
    return list;
  }

  // --- AUDIT LOGGING ---
  getAuditLogs(): AuditLogEntry[] {
    return this.get<AuditLogEntry[]>(STORAGE_KEYS.AUDIT_LOGS, SEED_AUDIT_LOGS);
  }

  logAction(
    module: AuditLogEntry['module'],
    action: AuditLogEntry['action'],
    documentType: string,
    documentNumber: string,
    details: string
  ): void {
    const logs = this.getAuditLogs();
    const newLog: AuditLogEntry = {
      id: 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      userEmail: 'admin@apexstore.pk',
      userName: 'Administrator',
      userRole: 'SUPER_ADMIN',
      module,
      action,
      documentType,
      documentNumber,
      details,
    };
    logs.unshift(newLog);
    if (logs.length > 500) logs.pop();
    this.set(STORAGE_KEYS.AUDIT_LOGS, logs);
  }

  clearAuditLogs(): void {
    this.set(STORAGE_KEYS.AUDIT_LOGS, []);
    this.logAction('SYSTEM', 'DELETE', 'AUDIT_TRAIL', 'ALL', 'Super Admin cleared system audit history');
  }

  // --- GOVERNANCE (TAX RETURNS & FINANCIAL REPORTS) ---
  getTaxFilingGovernance(): Record<string, any> {
    return this.get<Record<string, any>>('apex_erp_tax_governance_v3', {
      isCertifiedByOwner: false,
      certifiedBy: 'Hammad Ur Rehman (+447597030688)',
      isFiledIris: false,
      irisAckNumber: '',
      filedAt: '',
      notes: '',
    });
  }

  saveTaxFilingGovernance(update: Record<string, any>): Record<string, any> {
    const current = this.getTaxFilingGovernance();
    const merged = { ...current, ...update };
    this.set('apex_erp_tax_governance_v3', merged);
    this.logAction('TAXATION', 'UPDATE', 'TAX_GOVERNANCE', 'FBR_FILING', `Super Admin updated tax governance and filing approval`);
    return merged;
  }

  getFinancialGovernance(): Record<string, any> {
    return this.get<Record<string, any>>('apex_erp_financial_governance_v3', {
      isAuditCleared: false,
      isLockedBySuperAdmin: false,
      signedBy: 'Hammad Ur Rehman - Owner & Architect (+447597030688)',
      signedAt: '',
      auditBadgeIssued: false,
      periodLabel: 'FY 2025-2026',
    });
  }

  saveFinancialGovernance(update: Record<string, any>): Record<string, any> {
    const current = this.getFinancialGovernance();
    const merged = { ...current, ...update };
    this.set('apex_erp_financial_governance_v3', merged);
    this.logAction('GENERAL_LEDGER', 'UPDATE', 'FINANCIAL_GOVERNANCE', 'EXECUTIVE_AUDIT', `Super Admin issued financial statement audit certification`);
    return merged;
  }

  // --- WIPE ALL TRANSACTIONS & RUNTIME RECORDS (CLEAN SLATE) ---
  clearAllErpData(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.CUSTOMERS);
      localStorage.removeItem(STORAGE_KEYS.VENDORS);
      localStorage.removeItem(STORAGE_KEYS.BANK_ACCOUNTS);
      localStorage.removeItem(STORAGE_KEYS.FIXED_ASSETS);
      localStorage.removeItem(STORAGE_KEYS.BOMS);
      localStorage.removeItem(STORAGE_KEYS.SALES_DOCS);
      localStorage.removeItem(STORAGE_KEYS.PURCHASE_DOCS);
      localStorage.removeItem(STORAGE_KEYS.VOUCHERS);
      localStorage.removeItem(STORAGE_KEYS.AUDIT_LOGS);
      localStorage.removeItem(STORAGE_KEYS.TRANSFERS);
      localStorage.removeItem(STORAGE_KEYS.ADJUSTMENTS);
      localStorage.removeItem(STORAGE_KEYS.ASSEMBLY_ORDERS);
      localStorage.removeItem(STORAGE_KEYS.JOURNALS);
      // Reset COA balances to clean 0 balance
      this.set(
        STORAGE_KEYS.COA,
        SEED_CHART_OF_ACCOUNTS.map((a) => ({
          ...a,
          currentDebitBalancePkr: 0,
          currentCreditBalancePkr: 0,
          netBalancePkr: 0,
        }))
      );
    } catch {
      // ignore
    }
  }

  // --- FULL SNAPSHOT BACKUP & RESTORE ---
  getFullSnapshot(): Record<string, any> {
    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      branches: this.getBranches(),
      customers: this.getCustomers(),
      vendors: this.getVendors(),
      bankAccounts: this.getBankAccounts(),
      chartOfAccounts: this.getChartOfAccounts(),
      journalEntries: this.getJournalEntries(),
      salesDocuments: this.getSalesDocuments(),
      purchaseDocuments: this.getPurchaseDocuments(),
      boms: this.getBOMs(),
      assemblyOrders: this.getAssemblyOrders(),
      transfers: this.getTransfers(),
      vouchers: this.getVouchers(),
      auditLogs: this.getAuditLogs(),
    };
  }
}

export const erpStorage = new ErpDataService();
