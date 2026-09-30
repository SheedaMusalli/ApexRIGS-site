export type BranchLocationId = 'lahore_hafeez' | 'karachi_wh' | 'islamabad_wh' | string;

export interface Branch {
  id: BranchLocationId;
  name: string;
  code: string;
  city: string;
  address: string;
  phone: string;
  isHeadOffice?: boolean;
  gstNumber?: string;
  ntnNumber?: string;
  managerName?: string;
}

export interface Customer {
  id: string;
  code?: string;
  name: string;
  companyName?: string;
  email?: string;
  phone: string;
  whatsapp?: string;
  city: string;
  address: string;
  ntn?: string;
  ntnNumber?: string;
  taxNumber?: string;
  strnNumber?: string;
  isFiler?: boolean;
  priceTier?: string;
  creditLimit?: number;
  creditLimitPkr?: number;
  creditDaysAllowed?: number;
  currentBalance?: number;
  currentBalancePkr?: number;
  totalReceivablesPkr?: number;
  totalSalesPkr?: number;
  paymentTermsDays?: number;
  notes?: string;
  createdAt: string;
}

export interface Vendor {
  id: string;
  code?: string;
  name: string;
  companyName?: string;
  contactPerson?: string;
  email?: string;
  phone: string;
  city: string;
  address: string;
  ntn?: string;
  ntnNumber?: string;
  taxNumber?: string;
  strnNumber?: string;
  isFiler?: boolean;
  creditLimitPkr?: number;
  currentBalancePkr?: number;
  currentPayable?: number;
  currentPayableBalancePkr?: number;
  totalPayablesPkr?: number;
  totalPurchasesPkr?: number;
  paymentTerms?: string | number;
  paymentTermsDays?: number;
  bankDetails?: string;
  productCategoriesSupplied?: string[];
  notes?: string;
  createdAt: string;
}

export type SalesDocumentType = 'INVOICE' | 'TAX_INVOICE' | 'QUOTATION' | 'PROFORMA_INVOICE' | 'SALES_ORDER' | 'DELIVERY_CHALLAN' | 'CREDIT_NOTE' | string;
export type PurchaseDocType = 'SUPPLIER_BILL' | 'BILL' | 'PURCHASE_ORDER' | 'GOODS_RECEIPT_NOTE' | 'DEBIT_NOTE' | string;
export type DocumentPaymentMode = 'CASH' | 'BANK_TRANSFER' | 'RAAST' | 'CHEQUE' | 'CHECK' | 'CREDIT' | 'PAYMENT_GATEWAY' | string;

export interface SalesItemLine {
  id: string;
  productId: string;
  variantId?: string;
  productName: string;
  category?: string;
  sku: string;
  quantity: number;
  unitPricePkr: number;
  unitCostPkr?: number;
  costPricePkr?: number;
  discountPercent?: number;
  discountPkr?: number;
  taxPercent?: number;
  taxRatePercent?: number;
  taxAmountPkr?: number;
  totalPkr: number;
  warehouseId?: string;
  serialNumber?: string;
  serialNumbers?: string[];
}

export interface PurchaseItemLine {
  id: string;
  productId: string;
  variantId?: string;
  productName: string;
  sku: string;
  quantity?: number;
  orderedQty?: number;
  receivedQty?: number;
  billedQty?: number;
  unitCostPkr: number;
  landedCostPerUnitPkr?: number;
  batchNumber?: string;
  taxPercent?: number;
  taxRatePercent?: number;
  taxAmountPkr?: number;
  totalPkr: number;
  warehouseId?: string;
  serialNumber?: string;
  serialNumbers?: string[];
}

export interface SalesDocument {
  id: string;
  docNumber: string;
  type: SalesDocumentType;
  status: string;
  issueDate: string;
  dueDate?: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  customerNtn?: string;
  customerIsFiler?: boolean;
  branchId: BranchLocationId;
  items: SalesItemLine[];
  subtotalPkr: number;
  taxAmountPkr?: number;
  totalGstTaxPkr?: number;
  discountAmountPkr?: number;
  totalDiscountPkr?: number;
  assemblyLaborFeePkr?: number;
  whtDeductionRate?: number;
  whtDeductionPkr?: number;
  termDays?: number;
  shippingFeePkr?: number;
  shippingChargesPkr?: number;
  previousBalancePkr?: number;
  grandTotalPkr: number;
  paidAmountPkr: number;
  balanceReceivablePkr?: number;
  balanceDuePkr?: number;
  paymentMode?: DocumentPaymentMode;
  paymentMethod?: string;
  paymentReference?: string;
  paymentDetails?: any;
  notes?: string;
  terms?: string;
  sourceDocumentId?: string;
  sourceDocNumber?: string;
  salesPerson?: string;
  salesAgent?: string;
  createdBy?: string;
  createdByName?: string;
  createdByType?: string;
  editHistory?: any[];
  createdAt: string;
  updatedAt?: string;
}

export interface PurchaseDocument {
  id: string;
  docNumber: string;
  type: PurchaseDocType;
  status: string;
  issueDate: string;
  dueDate?: string;
  deliveryDueDate?: string;
  termDays?: number;
  whtDeductionRate?: number;
  vendorId: string;
  vendorName: string;
  vendorNtn?: string;
  vendorIsFiler?: boolean;
  branchId: BranchLocationId;
  items: PurchaseItemLine[];
  subtotalPkr: number;
  taxAmountPkr?: number;
  inputGstPkr?: number;
  whtDeductionPkr?: number;
  freightShippingPkr?: number;
  shippingFeePkr?: number;
  shippingChargesPkr?: number;
  customsAndClearancePkr?: number;
  previousBalancePkr?: number;
  grandTotalPkr: number;
  paidAmountPkr: number;
  balancePayablePkr: number;
  paymentMode?: DocumentPaymentMode;
  paymentDetails?: any;
  notes?: string;
  sourceDocumentId?: string;
  sourceDocNumber?: string;
  lcNumber?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CustomerReceipt {
  id: string;
  receiptNumber: string;
  customerId: string;
  customerName: string;
  invoiceId?: string;
  invoiceDocNumber?: string;
  date: string;
  amountPkr: number;
  bankAccountId: string;
  bankAccountName: string;
  paymentMode: DocumentPaymentMode;
  referenceNumber?: string;
  notes?: string;
  createdAt: string;
}

export interface LetterOfCredit {
  id: string;
  lcNumber: string;
  bankName: string;
  vendorId: string;
  vendorName: string;
  amountPkr: number;
  currency: string;
  exchangeRate: number;
  issueDate: string;
  expiryDate: string;
  status: string;
  notes?: string;
  createdAt: string;
}

export interface InterWarehouseTransfer {
  id: string;
  transferNumber: string;
  sourceBranchId: BranchLocationId;
  destinationBranchId: BranchLocationId;
  date: string;
  items: {
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
    serialNumbers?: string[];
  }[];
  status: string;
  notes?: string;
  createdAt: string;
}

export interface StockAdjustment {
  id: string;
  adjustmentNumber: string;
  branchId: BranchLocationId;
  date: string;
  reason: string;
  items: {
    productId: string;
    productName: string;
    sku: string;
    type: 'ADD' | 'SUBTRACT' | 'SET';
    quantity: number;
    unitCostPkr: number;
  }[];
  createdAt: string;
}

export interface BillOfMaterials {
  id: string;
  name: string;
  bomCode?: string;
  finishedProductName?: string;
  outputProductId: string;
  outputQuantity: number;
  components: {
    productId: string;
    quantity: number;
    unitCostPkr: number;
  }[];
  laborCostPkr: number;
  overheadCostPkr: number;
  totalCostPkr: number;
  createdAt: string;
}

export interface AssemblyOrder {
  id: string;
  orderNumber: string;
  bomId: string;
  outputProductId: string;
  quantity: number;
  branchId: BranchLocationId;
  status: string;
  createdAt: string;
}

export interface DisassemblyOrder {
  id: string;
  orderNumber: string;
  productId: string;
  quantity: number;
  branchId: BranchLocationId;
  status: string;
  createdAt: string;
}

export type BankAccountType = 'CASH_DRAWER' | 'BANK_CURRENT' | 'BANK_SAVINGS' | 'PETTY_CASH' | 'DIGITAL_WALLET';

export interface BankAccount {
  id: string;
  accountName: string;
  bankName: string;
  accountNumber: string;
  iban?: string;
  currency: string;
  type: BankAccountType;
  branchName?: string;
  openingBalancePkr: number;
  currentBalancePkr: number;
  reconciledBalancePkr: number;
  glAccountCode: string;
  isActive: boolean;
}

export type VoucherType = 'CPV' | 'CRV' | 'BPV' | 'BRV' | 'JV';

export interface FinancialVoucher {
  id: string;
  voucherNumber: string;
  type: VoucherType;
  entryKind?: string;
  date: string;
  bankAccountId?: string;
  bankAccountName?: string;
  transferToBankId?: string;
  partyType?: 'CUSTOMER' | 'VENDOR' | 'OTHER' | 'GENERAL_EXPENSE' | 'EMPLOYEE' | string;
  partyId?: string;
  partyName?: string;
  invoiceId?: string;
  billId?: string;
  amountPkr: number;
  netPaidOrReceivedPkr?: number;
  debitAccountCode?: string;
  debitAccountName?: string;
  creditAccountCode?: string;
  creditAccountName?: string;
  paymentMode?: string;
  chequeOrRefNumber?: string;
  narration?: string;
  preparedBy?: string;
  branchId?: BranchLocationId;
  createdAt: string;
}

export interface BankReconciliationRecord {
  id: string;
  bankAccountId: string;
  statementDate: string;
  statementBalancePkr: number;
  bookBalancePkr: number;
  differencePkr: number;
  status: 'RECONCILED' | 'UNRECONCILED';
  notes?: string;
  createdAt: string;
}

export type AccountClassification = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'COGS' | 'EXPENSE';

export interface ChartOfAccountItem {
  code: string;
  name: string;
  classification: AccountClassification;
  parentCode?: string;
  description?: string;
  isGroup: boolean;
  currentDebitBalancePkr: number;
  currentCreditBalancePkr: number;
  netBalancePkr: number;
}

export interface JournalEntry {
  id: string;
  entryNumber: string;
  date: string;
  narration: string;
  lines: {
    accountCode: string;
    accountName: string;
    debitPkr: number;
    creditPkr: number;
  }[];
  totalDebitPkr: number;
  totalCreditPkr: number;
  createdAt: string;
}

export interface FixedAsset {
  id: string;
  assetCode: string;
  name: string;
  assetName?: string;
  category: string;
  purchaseDate: string;
  purchaseCostPkr: number;
  accumulatedDepreciationPkr: number;
  currentBookValuePkr: number;
  depreciationRatePercent: number;
  location: string;
  status: 'ACTIVE' | 'DISPOSED' | 'MAINTENANCE';
  createdAt: string;
}

export interface AccountingPeriodLock {
  id: string;
  periodName: string;
  startDate: string;
  endDate: string;
  isLocked: boolean;
  lockedAt?: string;
  lockedBy?: string;
}

export interface TaxConfiguration {
  standardGstPercent: number;
  reducedGstPercent: number;
  serviceGstPercent: number;
  whtGoodsActiveFilerPercent: number;
  whtGoodsNonFilerPercent: number;
  whtServicesActiveFilerPercent: number;
  whtServicesNonFilerPercent: number;
  fedPercent: number;
  fbrNtnNumber: string;
  fbrStrnNumber: string;
  praRegistrationNumber: string;
  srbRegistrationNumber: string;
}

export interface DepartmentBudget {
  id: string;
  departmentName: string;
  fiscalYear: string;
  allocatedBudgetPkr: number;
  spentAmountPkr: number;
  remainingBudgetPkr: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp?: string;
  userEmail?: string;
  userName?: string;
  userRole?: string;
  module?: string;
  documentType?: string;
  documentNumber?: string;
  at?: string;
  actor?: string;
  action: string;
  details?: string;
}

export interface DocumentAttachment {
  id: string;
  documentId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  url: string;
  uploadedAt: string;
}
