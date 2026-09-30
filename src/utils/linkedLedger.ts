export interface LinkedLedgerEntry {
  id: string;
  date: string;
  type: string;
  docNumber: string;
  narration: string;
  debit: number;
  credit: number;
  balance: number;
}

export function linkedLedger(
  salesDocs: any[] = [],
  purchaseDocs: any[] = [],
  vouchers: any[] = []
): LinkedLedgerEntry[] {
  const entries: LinkedLedgerEntry[] = [];
  let runningBalance = 0;

  for (const s of salesDocs) {
    if (['DRAFT', 'CANCELLED', 'REJECTED'].includes(s.status)) continue;
    runningBalance += (s.grandTotalPkr || 0);
    entries.push({
      id: s.id,
      date: s.issueDate || s.createdAt,
      type: s.type || 'SALES',
      docNumber: s.docNumber,
      narration: `Sale to ${s.customerName || 'Customer'}`,
      debit: s.grandTotalPkr || 0,
      credit: 0,
      balance: runningBalance,
    });
  }

  for (const p of purchaseDocs) {
    if (['DRAFT', 'CANCELLED', 'REJECTED'].includes(p.status)) continue;
    runningBalance -= (p.grandTotalPkr || 0);
    entries.push({
      id: p.id,
      date: p.issueDate || p.createdAt,
      type: p.type || 'PURCHASE',
      docNumber: p.docNumber,
      narration: `Purchase from ${p.vendorName || 'Vendor'}`,
      debit: 0,
      credit: p.grandTotalPkr || 0,
      balance: runningBalance,
    });
  }

  for (const v of vouchers) {
    const isCredit = ['CPV', 'BPV', 'EXPENSE', 'PAYMENT'].includes(v.type);
    const amount = v.amountPkr || 0;
    if (isCredit) {
      runningBalance -= amount;
      entries.push({
        id: v.id,
        date: v.date,
        type: v.type,
        docNumber: v.voucherNumber,
        narration: v.narration || v.partyName || 'Payment Voucher',
        debit: 0,
        credit: amount,
        balance: runningBalance,
      });
    } else {
      runningBalance += amount;
      entries.push({
        id: v.id,
        date: v.date,
        type: v.type,
        docNumber: v.voucherNumber,
        narration: v.narration || v.partyName || 'Receipt Voucher',
        debit: amount,
        credit: 0,
        balance: runningBalance,
      });
    }
  }

  entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return entries;
}
