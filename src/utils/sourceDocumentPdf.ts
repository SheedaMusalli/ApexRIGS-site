import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatPkr } from './formatters';

export function downloadSourceDocument(doc: any) {
  const pdf = new jsPDF();
  const title = doc.docNumber || 'Source Document';

  pdf.setFontSize(18);
  pdf.text('ApexRig Enterprise ERP', 14, 20);

  pdf.setFontSize(12);
  pdf.text(`Document: ${title} (${doc.type || 'DOCUMENT'})`, 14, 28);
  pdf.text(`Party: ${doc.customerName || doc.vendorName || 'N/A'}`, 14, 35);
  pdf.text(`Date: ${doc.issueDate || doc.createdAt || new Date().toISOString()}`, 14, 42);

  const items = Array.isArray(doc.items)
    ? doc.items.map((it: any) => [
        it.productName || it.sku || 'Item',
        String(it.quantity || 1),
        formatPkr(it.unitPricePkr || it.unitCostPkr || 0),
        formatPkr(it.totalPkr || 0),
      ])
    : [];

  if (items.length > 0) {
    autoTable(pdf, {
      startY: 48,
      head: [['Item Description', 'Qty', 'Unit Price', 'Total']],
      body: items,
      foot: [['Grand Total', '', '', formatPkr(doc.grandTotalPkr || 0)]],
    });
  }

  pdf.save(`${title}.pdf`);
}
