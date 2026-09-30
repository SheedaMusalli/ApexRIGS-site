export function validateDocument(doc: any, kind: 'sales' | 'purchase'): string | null {
  if (!doc || typeof doc !== 'object') {
    return 'Invalid document payload';
  }

  if (!doc.id || typeof doc.id !== 'string') {
    return 'Document ID is required';
  }

  if (!doc.docNumber || typeof doc.docNumber !== 'string') {
    return 'Document number is required';
  }

  if (!doc.issueDate) {
    return 'Document issue date is required';
  }

  if (!doc.type) {
    return 'Document type is required';
  }

  if (kind === 'sales' && !doc.customerId && !doc.customerName) {
    return 'Customer is required for sales documents';
  }

  if (kind === 'purchase' && !doc.vendorId && !doc.vendorName) {
    return 'Vendor is required for purchase documents';
  }

  if (typeof doc.grandTotalPkr !== 'number' || isNaN(doc.grandTotalPkr) || doc.grandTotalPkr < 0) {
    return 'Grand total must be a valid non-negative number';
  }

  if (doc.paidAmountPkr !== undefined && (typeof doc.paidAmountPkr !== 'number' || doc.paidAmountPkr < 0)) {
    return 'Paid amount must be a non-negative number';
  }

  if (doc.paidAmountPkr !== undefined && doc.paidAmountPkr > doc.grandTotalPkr) {
    return 'Paid amount cannot exceed grand total';
  }

  if (!Array.isArray(doc.items) || doc.items.length === 0) {
    return 'Document must contain at least one line item';
  }

  for (const item of doc.items) {
    if (!item.productName && !item.productId) {
      return 'Each line item must have a product identifier or name';
    }
    const qty = item.quantity !== undefined ? item.quantity : item.orderedQty;
    if (typeof qty !== 'number' || qty <= 0) {
      return 'Line item quantity must be greater than zero';
    }
  }

  return null;
}
