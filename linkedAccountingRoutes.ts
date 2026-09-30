import type { Express } from 'express';
import { can } from './src/utils/permissions';
import { linkedLedger } from './src/utils/linkedLedger';
import { applyVoucherChange, applySalesCustomerChange, money } from './src/utils/accounting';
import { validateDocument } from './src/utils/documentValidation';

export function registerLinkedAccounting(app: Express, db: any, save: () => void, actor: (req: any) => any) {
  const transaction = (res: any, action: () => any) => {
    const old = structuredClone(db.get());
    try { const result = action(); save(); return res.json(result); }
    catch (e: any) { db.set(old); return res.status(400).json({ error: e.message || 'Nothing was saved.' }); }
  };
  app.get('/api/erp/workspace', (req, res) => {
    try {
      const s = db.get(), user = actor(req), reports = can(user, 'reports');
      res.json({
        sales: can(user, 'sales') || reports ? (s.salesDocsDB || []) : [],
        purchases: can(user, 'purchases') || reports ? (s.purchaseDocsDB || []) : [],
        customers: can(user, 'sales') || reports ? (s.customersDB || []) : [],
        vendors: can(user, 'purchases') || reports ? (s.vendorsDB || []) : [],
        banks: can(user, 'banking') || reports ? (s.bankAccountsDB || []) : [],
        vouchers: (s.vouchersDB || []).filter((v: any) => can(user, 'banking') || reports || (v.invoiceId && can(user, 'sales')) || (v.billId && can(user, 'purchases'))),
        ledger: reports ? linkedLedger(s.salesDocsDB || [], s.purchaseDocsDB || [], s.vouchersDB || []) : null,
        lockDate: s.accountingControls?.lockDate || '',
        audit: user?.isOwner ? (s.accountingControls?.audit || []).slice(-100).reverse() : [],
      });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Error loading workspace' });
    }
  });
  app.post('/api/erp/treasury/entries', (req, res) => {
    if (!can(actor(req), 'banking', 'post')) return res.status(403).json({ error: 'Banking posting rights required.' });
    return transaction(res, () => {
      const s = db.get(), { id, type, amount, bankAccountId, targetBankId, date, narration, category } = req.body;
      if (typeof id !== 'string' || !id.trim()) throw new Error('Entry ID required.');
      const prior = s.vouchersDB.find((v: any) => v.id === id);
      if (prior) {
        if (prior.entryKind !== type || prior.amountPkr !== amount || prior.bankAccountId !== bankAccountId || prior.transferToBankId !== targetBankId) throw new Error('Entry ID already used.');
        return { success: true, voucher: prior };
      }
      if (!['EXPENSE','INCOME','TRANSFER'].includes(type)) throw new Error('Invalid entry type.');
      if (!validDate(date) || (s.accountingControls.lockDate && date <= s.accountingControls.lockDate)) throw new Error('Choose a valid date in an unlocked period.');
      if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0.01 || money(amount) !== amount) throw new Error('Enter a positive amount to two decimal places.');
      if (typeof narration !== 'string' || !narration.trim()) throw new Error('Description required.');
      const bank = s.bankAccountsDB.find((b: any) => b.id === bankAccountId && b.isActive);
      if (!bank) throw new Error('Choose an active bank.');
      const target = s.bankAccountsDB.find((b: any) => b.id === targetBankId && b.isActive);
      if (type === 'TRANSFER' && (!target || target.id === bank.id)) throw new Error('Choose a different active destination account.');
      const expenses: Record<string,string> = { '6000': 'General expenses', '6100': 'Rent', '6200': 'Salaries', '6300': 'Utilities', '6400': 'Bank charges' };
      if (type === 'EXPENSE' && !expenses[category]) throw new Error('Choose an expense category.');
      const voucher = { id, voucherNumber: `BNK-${id.slice(0,8).toUpperCase()}`, entryKind: type, type: type === 'INCOME' ? 'BRV' : 'BPV', date, narration, bankAccountId, bankAccountName: bank.accountName, transferToBankId: type === 'TRANSFER' ? targetBankId : undefined, amountPkr: amount, netPaidOrReceivedPkr: amount, debitAccountCode: type === 'INCOME' ? bank.glAccountCode : type === 'TRANSFER' ? target.glAccountCode : category, debitAccountName: type === 'INCOME' ? bank.accountName : type === 'TRANSFER' ? target.accountName : expenses[category], creditAccountCode: type === 'INCOME' ? '4200' : bank.glAccountCode, creditAccountName: type === 'INCOME' ? 'Other income' : bank.accountName, preparedBy: actor(req).fullName, createdAt: new Date().toISOString() };
      s.bankAccountsDB = applyVoucherChange(s.bankAccountsDB, undefined, voucher as any);
      s.vouchersDB.unshift(voucher); db.set(s); return { success: true, voucher };
    });
  });
  app.put('/api/erp/workspace/lock', (req, res) => {
    if (!actor(req).isOwner) return res.status(403).json({ error: 'Only the owner can change the accounting lock date.' });
    const date = req.body.lockDate;
    if (date !== '' && !validDate(date)) return res.status(400).json({ error: 'Enter a valid lock date.' });
    return transaction(res, () => {
      const s = db.get(); s.accountingControls.lockDate = date;
      s.accountingControls.audit.push({ id: crypto.randomUUID(), at: new Date().toISOString(), actor: actor(req).fullName, action: `Accounting lock changed to ${date || 'unlocked'}` });
      return { success: true };
    });
  });
  for (const kind of ['sales', 'purchase']) {
    const saveDocument = (req: any, res: any) => transaction(res, () => {
      const s = db.get(), docs = kind === 'sales' ? s.salesDocsDB : s.purchaseDocsDB;
      const doc = structuredClone(req.body), old = docs.find((d: any) => d.id === (req.params.id || doc.id));
      const invalid = validateDocument(doc, kind === 'sales' ? 'sales' : 'purchase');
      if (invalid) throw new Error(invalid);
      const parties = kind === 'sales' ? s.customersDB : s.vendorsDB;
      const partyKey = kind === 'sales' ? 'customerId' : 'vendorId';
      if ((!old || old[partyKey] !== doc[partyKey]) && !parties.some((p: any) => p.id === doc[partyKey])) throw new Error('Choose an existing customer or supplier account.');
      const states = kind === 'sales' ? ['DRAFT','SENT','CONFIRMED','DELIVERED','PARTIALLY_PAID','PAID','CANCELLED','REFUNDED'] : ['DRAFT','SUBMITTED','APPROVED','RECEIVED','BILLED','PARTIALLY_PAID','PAID','REJECTED'];
      if (!states.includes(doc.status) || !validDate(doc.issueDate)) throw new Error('Invalid document status or issue date.');
      let subtotal = 0, discount = 0, tax = 0;
      for (const i of doc.items) {
        const qty = kind === 'sales' ? i.quantity : (i.orderedQty !== undefined ? i.orderedQty : i.quantity);
        const price = kind === 'sales' ? i.unitPricePkr : i.unitCostPkr;
        const disc = Number(i.discountPkr || 0), rate = Number(i.taxRatePercent || 0);
        if (!Number.isFinite(rate) || rate < 0 || rate > 100 || (i.unitCostPkr !== undefined && (!Number.isFinite(i.unitCostPkr) || i.unitCostPkr < 0))) throw new Error('Invalid tax rate or cost.');
        subtotal += money(qty * price); discount += money(disc); tax += money((qty * price - disc) * rate / 100);
      }
      const extra = kind === 'sales' ? ['shippingChargesPkr','assemblyLaborFeePkr'] : ['freightShippingPkr','customsAndClearancePkr'];
      for (const key of [...extra, 'whtDeductionPkr']) if (!Number.isFinite(Number(doc[key] || 0)) || Number(doc[key] || 0) < 0) throw new Error('Charges and withholding must be nonnegative numbers.');
      const total = money(subtotal - discount + tax + extra.reduce((sum, k) => sum + Number(doc[k] || 0),0) - Number(doc.whtDeductionPkr || 0));
      if (Math.abs(doc.subtotalPkr - subtotal) > 0.01 || Math.abs(doc.grandTotalPkr - total) > 0.01) throw new Error('Document totals must match its line quantities, prices, discounts, taxes and charges.');
      doc[kind === 'sales' ? 'totalGstTaxPkr' : 'inputGstPkr'] = money(tax);
      doc.totalDiscountPkr = money(discount);
      if (req.params.id && (!old || old.id !== doc.id)) throw new Error('Document identity cannot be changed.');
      if (docs.some((d: any) => d.id !== doc.id && d.docNumber === doc.docNumber)) throw new Error('Document number already exists.');
      
      const immediatePayment = req.body.immediatePayment;
      if (immediatePayment && immediatePayment.recordPayment) {
        const payAmount = Number(immediatePayment.amount);
        if (!Number.isFinite(payAmount) || payAmount <= 0 || payAmount > total) throw new Error('Immediate payment amount must be positive and cannot exceed the grand total.');
        const bank = s.bankAccountsDB.find((b: any) => b.id === immediatePayment.bankAccountId && b.isActive);
        if (!bank) throw new Error('Choose an active bank or cash account for immediate payment.');
        
        doc.status = payAmount === total ? 'PAID' : 'PARTIALLY_PAID';
        doc.paidAmountPkr = money(payAmount);
        if (kind === 'sales') {
          doc.balanceDuePkr = money(total - payAmount);
        } else {
          doc.balancePayablePkr = money(total - payAmount);
        }

        const voucherId = immediatePayment.id || crypto.randomUUID();
        const voucher = {
          id: voucherId,
          ...(kind === 'sales' ? { invoiceId: doc.id } : { billId: doc.id }),
          voucherNumber: `${kind === 'sales' ? 'RCPT' : 'PAY'}-${voucherId.slice(0, 8).toUpperCase()}`,
          type: bank.type === 'CASH_DRAWER' ? (kind === 'sales' ? 'CRV' : 'CPV') : (kind === 'sales' ? 'BRV' : 'BPV'),
          date: immediatePayment.date || doc.issueDate,
          bankAccountId: bank.id,
          bankAccountName: bank.accountName,
          partyType: kind === 'sales' ? 'CUSTOMER' : 'VENDOR',
          partyId: kind === 'sales' ? doc.customerId : doc.vendorId,
          partyName: kind === 'sales' ? doc.customerName : doc.vendorName,
          amountPkr: payAmount,
          netPaidOrReceivedPkr: payAmount,
          debitAccountCode: kind === 'sales' ? bank.glAccountCode : '2000',
          debitAccountName: kind === 'sales' ? bank.accountName : 'Accounts payable',
          creditAccountCode: kind === 'sales' ? '1100' : bank.glAccountCode,
          creditAccountName: kind === 'sales' ? 'Accounts Receivable' : bank.accountName,
          chequeOrRefNumber: immediatePayment.reference || doc.docNumber,
          narration: `Immediate payment against ${doc.docNumber}`,
          preparedBy: actor(req).fullName,
          branchId: doc.branchId || 'lahore_hafeez',
          createdAt: new Date().toISOString()
        };
        s.bankAccountsDB = applyVoucherChange(s.bankAccountsDB, undefined, voucher as any);
        s.vouchersDB.unshift(voucher);
      } else {
        if (doc.paidAmountPkr !== (old?.paidAmountPkr || 0)) throw new Error('Use a linked receipt or supplier payment to change the paid amount.');
      }

      if (old?.sourceDocumentId !== doc.sourceDocumentId) throw new Error('Use the document conversion action to create source links.');
      if (old && old.type !== doc.type) throw new Error('Use conversion to change document type.');
      if (kind === 'sales') s.customersDB = applySalesCustomerChange(s.customersDB, old, doc);
      else updateVendor(s.vendorsDB, old, doc);
      if (old) docs[docs.indexOf(old)] = doc; else docs.unshift(doc);
      s.accountingControls.audit.push({ id: crypto.randomUUID(), at: new Date().toISOString(), actor: actor(req).fullName, action: `${old ? 'Updated' : 'Created'} ${doc.docNumber}${immediatePayment?.recordPayment ? ' with immediate payment' : ''}` });
      db.set(s); return { success: true, doc };
    });
    app.post(`/api/erp/${kind}-docs`, saveDocument);
    app.put(`/api/erp/${kind}-docs/:id`, saveDocument);
    app.post(`/api/erp/${kind}-docs/:id/void`, (req, res) => {
      if (!can(actor(req), kind === 'sales' ? 'sales' : 'purchases', 'post') || !can(actor(req), kind === 'sales' ? 'sales' : 'purchases', 'delete')) return res.status(403).json({ error: 'Posting and deletion rights are required to void a document.' });
      return transaction(res, () => {
        const s = db.get(), docs = kind === 'sales' ? s.salesDocsDB : s.purchaseDocsDB;
        const doc = docs.find((d: any) => d.id === req.params.id);
        if (!doc) throw new Error('Document not found.');
        if ((s.ordersDB || []).some((o: any) => o.id === doc.id || o.orderNumber === doc.docNumber)) throw new Error('Use the website order cancellation workflow to keep stock and order status together.');
        if (doc.paidAmountPkr || s.vouchersDB.some((v: any) => v.invoiceId === doc.id || v.billId === doc.id)) throw new Error('A settled document cannot be voided. Use a reviewed credit/refund workflow.');
        if (docs.some((d: any) => d.sourceDocumentId === doc.id)) throw new Error('This document has a linked successor. Void the successor first and keep this source record.');
        if (['CANCELLED','REJECTED'].includes(doc.status)) return { success: true, doc };
        const old = structuredClone(doc); doc.status = kind === 'sales' ? 'CANCELLED' : 'REJECTED';
        if (kind === 'sales') s.customersDB = applySalesCustomerChange(s.customersDB, old, doc); else updateVendor(s.vendorsDB, old, doc);
        s.accountingControls.audit.push({ id: crypto.randomUUID(), at: new Date().toISOString(), actor: actor(req).fullName, action: `Voided ${doc.docNumber}` });
        db.set(s); return { success: true, doc };
      });
    });
    app.post(`/api/erp/${kind}-docs/:id/convert`, (req, res) => transaction(res, () => {
      const s = db.get(), docs = kind === 'sales' ? s.salesDocsDB : s.purchaseDocsDB;
      const source = docs.find((d: any) => d.id === req.params.id);
      const mapping: Record<string, string> = { QUOTATION: 'SALES_ORDER', PROFORMA: 'INVOICE', SALES_ORDER: 'INVOICE', PURCHASE_ORDER: 'SUPPLIER_BILL' };
      if (!source || !mapping[source.type]) throw new Error('Choose a quotation, proforma, sales order or purchase order.');
      if (['CANCELLED', 'REJECTED'].includes(source.status)) throw new Error('Cancelled documents cannot be converted.');
      const existing = docs.find((d: any) => d.sourceDocumentId === source.id);
      if (existing) return { success: true, doc: existing };
      const date = req.body.date;
      if (!validDate(date)) throw new Error('A valid conversion date is required.');
      const type = mapping[source.type];
      const id = crypto.randomUUID();
      const doc = { ...structuredClone(source), id, docNumber: `${type === 'INVOICE' ? 'INV' : type === 'SALES_ORDER' ? 'SO' : 'BILL'}-${id.slice(0, 8).toUpperCase()}`, type, status: 'DRAFT', sourceDocumentId: source.id, sourceDocumentNumber: source.docNumber, issueDate: date, paidAmountPkr: 0, createdAt: new Date().toISOString(), createdBy: actor(req).id };
      delete doc.paymentDetails; delete doc.paymentReference; delete doc.editHistory;
      doc[kind === 'sales' ? 'balanceDuePkr' : 'balancePayablePkr'] = doc.grandTotalPkr;
      if (kind === 'purchase') doc.poReference = source.docNumber;
      docs.unshift(doc);
      s.accountingControls.audit.push({ id, at: new Date().toISOString(), actor: actor(req).fullName, action: `${source.docNumber} → ${doc.docNumber} (draft)` });
      return { success: true, doc };
    }));
    app.post(`/api/erp/${kind}-docs/:id/approve`, (req, res) => transaction(res, () => {
      const s = db.get(), docs = kind === 'sales' ? s.salesDocsDB : s.purchaseDocsDB;
      const doc = docs.find((d: any) => d.id === req.params.id);
      if (!doc || doc.status !== 'DRAFT') throw new Error('Only draft documents can be approved.');
      if (s.accountingControls.lockDate && doc.issueDate <= s.accountingControls.lockDate) throw new Error('This accounting period is locked.');
      if (doc.paidAmountPkr) throw new Error('Post the document unpaid, then allocate a receipt or payment.');
      const previous = structuredClone(doc);
      doc.status = kind === 'sales' ? 'CONFIRMED' : 'APPROVED';
      if (kind === 'sales') s.customersDB = applySalesCustomerChange(s.customersDB, previous, doc);
      else updateVendor(s.vendorsDB, undefined, doc);
      s.accountingControls.audit.push({ id: crypto.randomUUID(), at: new Date().toISOString(), actor: actor(req).fullName, action: `Approved ${doc.docNumber}` });
      db.set(s); return { success: true, doc };
    }));
  }
  app.post('/api/erp/purchase-docs/:id/payments', (req, res) => transaction(res, () => {
    const s = db.get(), doc = s.purchaseDocsDB.find((d: any) => d.id === req.params.id);
    const { id, amount, bankAccountId, date, reference } = req.body;
    if (!doc) throw new Error('Supplier bill not found.');
    if (typeof id !== 'string' || !id.trim()) throw new Error('Payment ID required.');
    const prior = s.vouchersDB.find((v: any) => v.id === id);
    if (prior) {
      if (prior.billId !== doc.id || prior.amountPkr !== amount || prior.bankAccountId !== bankAccountId) throw new Error('Payment ID is already used.');
      return { success: true, doc, voucher: prior };
    }
    if (doc.type !== 'SUPPLIER_BILL' || ['DRAFT', 'REJECTED'].includes(doc.status)) throw new Error('Only approved supplier bills accept payments.');
    if (!validDate(date) || date < doc.issueDate) throw new Error('Payment date must be on or after the bill date.');
    if (s.accountingControls.lockDate && date <= s.accountingControls.lockDate) throw new Error('This accounting period is locked.');
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0.01 || money(amount) !== amount || amount > doc.balancePayablePkr) throw new Error('Amount must be positive, to two decimal places, and no greater than the bill balance.');
    const bank = s.bankAccountsDB.find((b: any) => b.id === bankAccountId && b.isActive);
    if (!bank) throw new Error('Choose an active bank or cash account.');
    const voucher = { id, billId: doc.id, voucherNumber: `PAY-${id}`, type: bank.type === 'CASH_DRAWER' ? 'CPV' : 'BPV', date, bankAccountId, bankAccountName: bank.accountName, partyType: 'VENDOR', partyId: doc.vendorId, partyName: doc.vendorName, amountPkr: amount, netPaidOrReceivedPkr: amount, debitAccountCode: '2000', debitAccountName: 'Accounts payable', creditAccountCode: bank.glAccountCode, creditAccountName: bank.accountName, chequeOrRefNumber: reference || doc.docNumber, narration: `Payment against ${doc.docNumber}`, preparedBy: actor(req).fullName, branchId: doc.branchId, createdAt: new Date().toISOString() };
    s.bankAccountsDB = applyVoucherChange(s.bankAccountsDB, undefined, voucher as any);
    s.vouchersDB.unshift(voucher);
    const previous = structuredClone(doc);
    doc.paidAmountPkr = money(doc.paidAmountPkr + amount); doc.balancePayablePkr = money(doc.grandTotalPkr - doc.paidAmountPkr);
    doc.status = doc.balancePayablePkr === 0 ? 'PAID' : 'PARTIALLY_PAID';
    updateVendor(s.vendorsDB, previous, doc); db.set(s);
    return { success: true, doc, voucher };
  }));
  app.post('/api/erp/batch-payments', (req, res) => {
    if (!can(actor(req), 'banking', 'post')) return res.status(403).json({ error: 'Banking posting rights required for batch payments.' });
    return transaction(res, () => {
      const s = db.get();
      const { items } = req.body;
      if (!Array.isArray(items) || items.length === 0) throw new Error('At least one payment item is required in the batch.');
      
      const results: any[] = [];
      for (const item of items) {
        const { id = crypto.randomUUID(), kind, documentId, bankAccountId, amount, date, reference, narration } = item;
        const payDate = date || new Date().toISOString().slice(0, 10);
        if (!validDate(payDate)) throw new Error(`Invalid date format for batch payment.`);
        if (s.accountingControls.lockDate && payDate <= s.accountingControls.lockDate) throw new Error(`Date ${payDate} falls into a locked period.`);
        const numAmount = Number(amount);
        if (!Number.isFinite(numAmount) || numAmount < 0.01) throw new Error(`Invalid payment amount: ${amount}`);
        const bank = s.bankAccountsDB.find((b: any) => b.id === bankAccountId && b.isActive);
        if (!bank) throw new Error(`Bank account not found or inactive.`);

        if (kind === 'sales' && documentId) {
          const doc = s.salesDocsDB.find((d: any) => d.id === documentId || d.docNumber === documentId);
          if (!doc) throw new Error(`Invoice ${documentId} not found.`);
          if (doc.type !== 'INVOICE' || ['DRAFT', 'CANCELLED', 'REFUNDED'].includes(doc.status)) throw new Error(`Invoice ${doc.docNumber} cannot accept payments.`);
          if (numAmount > (doc.balanceDuePkr || 0)) throw new Error(`Amount PKR ${numAmount} exceeds invoice ${doc.docNumber} balance.`);

          const voucher = {
            id, invoiceId: doc.id, voucherNumber: `RCPT-${id.slice(0, 8).toUpperCase()}`,
            type: bank.type === 'CASH_DRAWER' ? 'CRV' : 'BRV',
            date: payDate, bankAccountId, bankAccountName: bank.accountName, partyType: 'CUSTOMER',
            partyId: doc.customerId, partyName: doc.customerName,
            paymentMode: bank.type === 'CASH_DRAWER' ? 'CASH' : 'ONLINE_TRANSFER',
            chequeOrRefNumber: reference || doc.docNumber, narration: narration || `Batch receipt against ${doc.docNumber}`,
            amountPkr: money(numAmount), netPaidOrReceivedPkr: money(numAmount),
            debitAccountCode: bank.glAccountCode, debitAccountName: bank.accountName,
            creditAccountCode: '1100', creditAccountName: 'Accounts Receivable',
            preparedBy: actor(req).fullName, branchId: doc.branchId || 'lahore_hafeez', createdAt: new Date().toISOString()
          };
          s.bankAccountsDB = applyVoucherChange(s.bankAccountsDB, undefined, voucher as any);
          s.vouchersDB.unshift(voucher);
          const oldDoc = structuredClone(doc);
          doc.paidAmountPkr = money((doc.paidAmountPkr || 0) + numAmount);
          doc.balanceDuePkr = money(doc.grandTotalPkr - doc.paidAmountPkr);
          doc.status = doc.balanceDuePkr === 0 ? 'PAID' : 'PARTIALLY_PAID';
          s.customersDB = applySalesCustomerChange(s.customersDB, oldDoc, doc);
          results.push({ documentId: doc.id, docNumber: doc.docNumber, voucherId: voucher.id, amount: numAmount });
        } else if (kind === 'purchases' && documentId) {
          const doc = s.purchaseDocsDB.find((d: any) => d.id === documentId || d.docNumber === documentId);
          if (!doc) throw new Error(`Supplier bill ${documentId} not found.`);
          if (doc.type !== 'SUPPLIER_BILL' || ['DRAFT', 'REJECTED'].includes(doc.status)) throw new Error(`Bill ${doc.docNumber} cannot accept payments.`);
          if (numAmount > (doc.balancePayablePkr || 0)) throw new Error(`Amount PKR ${numAmount} exceeds bill ${doc.docNumber} balance.`);

          const voucher = {
            id, billId: doc.id, voucherNumber: `PAY-${id.slice(0, 8).toUpperCase()}`,
            type: bank.type === 'CASH_DRAWER' ? 'CPV' : 'BPV',
            date: payDate, bankAccountId, bankAccountName: bank.accountName, partyType: 'VENDOR',
            partyId: doc.vendorId, partyName: doc.vendorName,
            amountPkr: money(numAmount), netPaidOrReceivedPkr: money(numAmount),
            debitAccountCode: '2000', debitAccountName: 'Accounts payable',
            creditAccountCode: bank.glAccountCode, creditAccountName: bank.accountName,
            chequeOrRefNumber: reference || doc.docNumber, narration: narration || `Batch payment against ${doc.docNumber}`,
            preparedBy: actor(req).fullName, branchId: doc.branchId || 'lahore_hafeez', createdAt: new Date().toISOString()
          };
          s.bankAccountsDB = applyVoucherChange(s.bankAccountsDB, undefined, voucher as any);
          s.vouchersDB.unshift(voucher);
          const oldDoc = structuredClone(doc);
          doc.paidAmountPkr = money((doc.paidAmountPkr || 0) + numAmount);
          doc.balancePayablePkr = money(doc.grandTotalPkr - doc.paidAmountPkr);
          doc.status = doc.balancePayablePkr === 0 ? 'PAID' : 'PARTIALLY_PAID';
          updateVendor(s.vendorsDB, oldDoc, doc);
          results.push({ documentId: doc.id, docNumber: doc.docNumber, voucherId: voucher.id, amount: numAmount });
        }
      }
      s.accountingControls.audit.push({ id: crypto.randomUUID(), at: new Date().toISOString(), actor: actor(req).fullName, action: `Processed batch payments (${results.length} settlements)` });
      db.set(s);
      return { success: true, count: results.length, settlements: results };
    });
  });
}
export const validDate = (date: any) => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
export function updateVendor(vendors: any[], old?: any, next?: any) {
  const effect = (d: any, id: string, key: string) => d && d.vendorId === id && ['SUPPLIER_BILL', 'DEBIT_NOTE'].includes(d.type) && !['DRAFT', 'REJECTED'].includes(d.status) ? (d.type === 'DEBIT_NOTE' ? -1 : 1) * Number(d[key] || 0) : 0;
  for (const v of vendors) {
    v.currentPayableBalancePkr = money(Number(v.currentPayableBalancePkr || 0) - effect(old, v.id, 'balancePayablePkr') + effect(next, v.id, 'balancePayablePkr'));
    v.totalPurchasesPkr = money(Number(v.totalPurchasesPkr || 0) - effect(old, v.id, 'grandTotalPkr') + effect(next, v.id, 'grandTotalPkr'));
  }
}
