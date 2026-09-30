export function money(amount: number): number {
  if (typeof amount !== 'number' || isNaN(amount)) return 0;
  return Math.round(amount * 100) / 100;
}

export function validateVoucher(voucher: any): void {
  if (!voucher || typeof voucher !== 'object') {
    throw new Error('Voucher payload is required');
  }
  if (!voucher.voucherNumber) {
    throw new Error('Voucher number is required');
  }
  if (!voucher.date) {
    throw new Error('Voucher date is required');
  }
  if (typeof voucher.amountPkr !== 'number' || voucher.amountPkr <= 0) {
    throw new Error('Voucher amount must be positive');
  }
  if (!voucher.bankAccountId) {
    throw new Error('Bank account is required');
  }
}

export function applyVoucherChange(
  bankAccounts: any[],
  previousVoucher?: any,
  nextVoucher?: any
): any[] {
  const accounts = (bankAccounts || []).map((b) => ({ ...b }));

  const modifyBalance = (bankId: string, delta: number) => {
    const acc = accounts.find((a) => a.id === bankId);
    if (acc) {
      acc.currentBalancePkr = money((acc.currentBalancePkr || 0) + delta);
    }
  };

  // Reverse impact of previous voucher
  if (previousVoucher && previousVoucher.bankAccountId && typeof previousVoucher.amountPkr === 'number') {
    const amt = previousVoucher.amountPkr;
    const isOutflow = ['CPV', 'BPV', 'PAYMENT', 'EXPENSE'].includes(previousVoucher.type) || previousVoucher.entryKind === 'TRANSFER' || previousVoucher.entryKind === 'EXPENSE';
    if (isOutflow) {
      modifyBalance(previousVoucher.bankAccountId, amt); // add back
      if (previousVoucher.transferToBankId) {
        modifyBalance(previousVoucher.transferToBankId, -amt); // take from dest
      }
    } else {
      modifyBalance(previousVoucher.bankAccountId, -amt); // subtract back
    }
  }

  // Apply impact of next voucher
  if (nextVoucher && nextVoucher.bankAccountId && typeof nextVoucher.amountPkr === 'number') {
    const amt = nextVoucher.amountPkr;
    const isOutflow = ['CPV', 'BPV', 'PAYMENT', 'EXPENSE'].includes(nextVoucher.type) || nextVoucher.entryKind === 'TRANSFER' || nextVoucher.entryKind === 'EXPENSE';
    if (isOutflow) {
      modifyBalance(nextVoucher.bankAccountId, -amt); // deduct
      if (nextVoucher.transferToBankId) {
        modifyBalance(nextVoucher.transferToBankId, amt); // credit dest
      }
    } else {
      modifyBalance(nextVoucher.bankAccountId, amt); // add
    }
  }

  return accounts;
}

export function applySalesCustomerChange(
  customers: any[],
  previousDoc?: any,
  nextDoc?: any
): any[] {
  const list = (customers || []).map((c) => ({ ...c }));

  const updateCustomerReceivable = (customerId: string, delta: number) => {
    const cust = list.find((c) => c.id === customerId);
    if (cust) {
      const prevBal = cust.totalReceivablesPkr ?? cust.currentBalancePkr ?? 0;
      const nextBal = money(prevBal + delta);
      cust.totalReceivablesPkr = nextBal;
      cust.currentBalancePkr = nextBal;
    }
  };

  if (previousDoc && previousDoc.customerId && !['DRAFT', 'CANCELLED', 'REJECTED'].includes(previousDoc.status)) {
    const prevUnpaid = money((previousDoc.grandTotalPkr || 0) - (previousDoc.paidAmountPkr || 0));
    updateCustomerReceivable(previousDoc.customerId, -prevUnpaid);
  }

  if (nextDoc && nextDoc.customerId && !['DRAFT', 'CANCELLED', 'REJECTED'].includes(nextDoc.status)) {
    const nextUnpaid = money((nextDoc.grandTotalPkr || 0) - (nextDoc.paidAmountPkr || 0));
    updateCustomerReceivable(nextDoc.customerId, nextUnpaid);
  }

  return list;
}

export function isPostedSale(doc: any): boolean {
  if (!doc) return false;
  return !['DRAFT', 'CANCELLED', 'REJECTED', 'VOID'].includes(doc.status);
}

export function receivableAging(salesDocs: any[], asOfDate?: string) {
  const target = asOfDate ? new Date(asOfDate).getTime() : Date.now();
  let notDue = 0;
  let current = 0;
  let days30 = 0;
  let days60 = 0;
  let days90Plus = 0;
  let total = 0;
  const rows: any[] = [];

  for (const doc of salesDocs || []) {
    if (!isPostedSale(doc)) continue;
    const unpaid = money((doc.grandTotalPkr || 0) - (doc.paidAmountPkr || 0));
    if (unpaid <= 0) continue;

    const docDueDate = doc.dueDate ? new Date(doc.dueDate).getTime() : new Date(doc.issueDate || doc.createdAt).getTime();
    const diffDays = Math.floor((target - docDueDate) / (1000 * 60 * 60 * 24));

    total += unpaid;
    if (diffDays <= 0) notDue += unpaid;
    else if (diffDays <= 30) current += unpaid;
    else if (diffDays <= 60) days30 += unpaid;
    else if (diffDays <= 90) days60 += unpaid;
    else days90Plus += unpaid;

    rows.push({
      id: doc.id,
      docNumber: doc.docNumber || doc.id,
      customerName: doc.customerName || 'Customer',
      dueDate: doc.dueDate || doc.issueDate || 'N/A',
      daysOverdue: Math.max(0, diffDays),
      balanceDuePkr: unpaid,
    });
  }

  const buckets = [money(notDue), money(current), money(days30), money(days60), money(days90Plus)];

  return {
    notDue: money(notDue),
    current: money(current),
    days30: money(days30),
    days60: money(days60),
    days90Plus: money(days90Plus),
    total: money(total),
    buckets,
    rows,
  };
}

export function salesProfit(salesDocs: any[]) {
  let grossRevenue = 0;
  let salesReturns = 0;
  let cogs = 0;

  for (const doc of salesDocs || []) {
    if (!isPostedSale(doc)) continue;
    if (doc.type === 'CREDIT_NOTE') {
      salesReturns += (doc.grandTotalPkr || 0);
    } else {
      grossRevenue += (doc.grandTotalPkr || 0);
      if (Array.isArray(doc.items)) {
        for (const item of doc.items) {
          const cost = item.costPricePkr || (item.unitPricePkr * 0.75);
          cogs += cost * (item.quantity || 1);
        }
      }
    }
  }

  const netRevenue = money(grossRevenue - salesReturns);
  return {
    grossRevenue: money(grossRevenue),
    salesReturns: money(salesReturns),
    netRevenue,
    cogs: money(cogs),
  };
}

export function csvText(rows: (string | number | boolean | null | undefined)[][]): string {
  return (rows || [])
    .map((row) =>
      row
        .map((cell) => {
          const str = cell === null || cell === undefined ? '' : String(cell);
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(',')
    )
    .join('\n');
}
