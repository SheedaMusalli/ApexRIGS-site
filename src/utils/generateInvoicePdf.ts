import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Order, StoreSettings, PCBuildParts, Product } from '../types';
import { formatPkr } from './formatters';

/**
 * Generates an official, highly professional Bill of Sale & Tax Invoice PDF
 * Includes itemized specifications, individual component warranties,
 * logistics/carrier tracking numbers, and comprehensive warranty terms.
 */
export function generateOrderInvoicePdf(order: Order, settings?: StoreSettings) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const storeName = settings?.storeName || 'APEXRIG PC & COMPUTER HARDWARE';
  const tagline = settings?.tagline || "Pakistan's Premier Custom PC Builder & Tech Logistics Hub";
  const address = settings?.address || 'Hafeez Centre, Main Boulevard Gulberg III, Lahore, Pakistan';
  const phone = settings?.phone || settings?.whatsappNumber || '+92 300 1234567';
  const email = settings?.email || 'sales@apexrig.pk';
  const ntn = 'NTN: 8291402-7 (Registered)';

  // Colors
  const primaryColor: [number, number, number] = [15, 23, 42]; // Slate 900
  const accentColor: [number, number, number] = [79, 70, 229]; // Indigo 600
  const textDark: [number, number, number] = [30, 41, 59]; // Slate 800
  const textMuted: [number, number, number] = [100, 116, 139]; // Slate 500

  // 1. Top Header Brand Bar
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 26, 'F');

  // Decorative Accent Strip
  doc.setFillColor(...accentColor);
  doc.rect(0, 26, pageWidth, 2, 'F');

  // Brand Name & Tagline
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(storeName, 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(226, 232, 240);
  doc.text(tagline, 14, 18);

  // Top Right Header Label
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text('OFFICIAL TAX INVOICE', pageWidth - 14, 12, { align: 'right' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(199, 210, 254);
  doc.text('Original Customer Bill of Sale', pageWidth - 14, 18, { align: 'right' });

  // 2. Company & Order Meta Grid
  let curY = 35;

  // Left side: Company Details
  doc.setFontSize(8);
  doc.setTextColor(...textDark);
  doc.setFont('helvetica', 'bold');
  doc.text('STORE OUTLET & HEADQUARTERS:', 14, curY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textMuted);
  doc.text(address, 14, curY + 4);
  doc.text(`Phone: ${phone} | Email: ${email}`, 14, curY + 8);
  doc.text(ntn, 14, curY + 12);

  // Right side: Order Meta Box
  const metaBoxX = pageWidth - 80;
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.roundedRect(metaBoxX, curY - 2, 66, 25, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.setFontSize(9);
  doc.text(`INVOICE #: ${order.orderNumber}`, metaBoxX + 4, curY + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...textMuted);
  const orderDate = new Date(order.createdAt).toLocaleDateString('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  doc.text(`Date of Issue: ${orderDate}`, metaBoxX + 4, curY + 9);
  doc.text(`Payment: ${order.paymentMethod || 'Cash on Delivery'}`, metaBoxX + 4, curY + 14);
  doc.text(`Order Status: ${order.status.toUpperCase()}`, metaBoxX + 4, curY + 19);

  curY += 27;

  // 3. Customer Info & Logistics / Tracking Card
  const boxWidth = (pageWidth - 28 - 4) / 2;

  // Customer Box (Left)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, curY, boxWidth, 26, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...accentColor);
  doc.text('BILL TO & SHIP TO:', 18, curY + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...textDark);
  doc.text(order.customer?.fullName || 'Valued Customer', 18, curY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...textMuted);
  doc.text(`Phone: ${order.customer?.phone || 'N/A'}`, 18, curY + 15);
  doc.text(`Destination City: ${order.customer?.city || 'Pakistan'}`, 18, curY + 19);
  const cleanAddr = (order.customer?.address || 'Standard Delivery').slice(0, 48);
  doc.text(cleanAddr, 18, curY + 23);

  // Logistics & Tracking Box (Right)
  const rightBoxX = 14 + boxWidth + 4;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(rightBoxX, curY, boxWidth, 26, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...accentColor);
  doc.text('LOGISTICS & CARRIER TRACKING:', rightBoxX + 4, curY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...textMuted);
  doc.text('Courier Service:', rightBoxX + 4, curY + 10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textDark);
  doc.text(order.courierName || 'Leopards Courier / Cargo', rightBoxX + 32, curY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textMuted);
  doc.text('Tracking / CN #:', rightBoxX + 4, curY + 15);
  doc.setFont('helvetica', 'bold');
  if (order.trackingNumber) {
    doc.setTextColor(2, 132, 199); // Cyan
  } else {
    doc.setTextColor(100, 116, 139); // Gray
  }
  doc.text(order.trackingNumber ? order.trackingNumber : 'Assigned Upon Dispatch', rightBoxX + 32, curY + 15);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textMuted);
  doc.text('Live Tracking:', rightBoxX + 4, curY + 20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(5, 150, 105); // Emerald
  doc.text('apexrig.pk/track', rightBoxX + 32, curY + 20);

  curY += 30;

  // 4. Itemized Components Table
  const tableRows = (order.items || []).map((it: any, index: number) => {
    let title = it.name || it.productName || 'Hardware Component';
    if (it.variantColor && it.variantColor !== 'Standard') {
      title += ` (${it.variantColor})`;
    } else if (it.variantName && it.variantName !== 'Standard') {
      title += ` (${it.variantName})`;
    }

    const cat = it.category || 'Component';
    let warranty = it.warranty || it.product?.warranty || '1 Year Official Warranty';
    const snText = it.serialNumber || (it.serialNumbers && it.serialNumbers.length > 0 ? it.serialNumbers.join(', ') : '');
    if (snText) {
      title += `\nS/N: ${snText}`;
      warranty += `\n[S/N Verified]`;
    }
    const qty = it.quantity || 1;
    const unitPrice = it.price || it.unitPrice || 0;
    const lineTotal = unitPrice * qty;

    return [
      String(index + 1),
      title,
      cat,
      warranty,
      String(qty),
      formatPkr(unitPrice),
      formatPkr(lineTotal),
    ];
  });

  autoTable(doc, {
    startY: curY,
    head: [['#', 'Item Description & Specifications', 'Category', 'Warranty Coverage', 'Qty', 'Unit Price', 'Total']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'left',
      cellPadding: 2.5,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: textDark,
      cellPadding: 2.5,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 'auto', fontStyle: 'bold' },
      2: { cellWidth: 24 },
      3: { cellWidth: 32, textColor: [16, 149, 193] }, // Cyan highlight for warranty
      4: { cellWidth: 10, halign: 'center' },
      5: { cellWidth: 26, halign: 'right' },
      6: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14 },
    tableWidth: pageWidth - 28,
  });

  const lastTableY = (doc as any).lastAutoTable?.finalY || curY + 40;
  let summaryY = lastTableY + 4;

  // Check if we need a new page for summary and warranty
  if (summaryY + 70 > pageHeight) {
    doc.addPage();
    summaryY = 15;
  }

  // 5. Financial Summary Block
  const summaryBoxWidth = 75;
  const summaryBoxX = pageWidth - 14 - summaryBoxWidth;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(summaryBoxX, summaryY, summaryBoxWidth, 32, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textMuted);
  doc.text('Subtotal:', summaryBoxX + 4, summaryY + 6);
  doc.setTextColor(...textDark);
  doc.text(formatPkr(order.subtotal), summaryBoxX + summaryBoxWidth - 4, summaryY + 6, { align: 'right' });

  doc.setTextColor(...textMuted);
  doc.text('Shipping & Insurance:', summaryBoxX + 4, summaryY + 12);
  doc.setTextColor(...textDark);
  doc.text(order.shippingFee === 0 ? 'FREE' : formatPkr(order.shippingFee), summaryBoxX + summaryBoxWidth - 4, summaryY + 12, { align: 'right' });

  if (order.discount && order.discount > 0) {
    doc.setTextColor(239, 68, 68); // Red
    doc.text('Promotional Discount:', summaryBoxX + 4, summaryY + 18);
    doc.text(`- ${formatPkr(order.discount)}`, summaryBoxX + summaryBoxWidth - 4, summaryY + 18, { align: 'right' });
  }

  // Grand Total Banner
  doc.setFillColor(...accentColor);
  doc.roundedRect(summaryBoxX + 2, summaryY + 21, summaryBoxWidth - 4, 8, 1, 1, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('GRAND TOTAL:', summaryBoxX + 5, summaryY + 26.5);
  doc.text(formatPkr(order.total), summaryBoxX + summaryBoxWidth - 5, summaryY + 26.5, { align: 'right' });

  // 6. Comprehensive General Warranty Terms Box (Left of Summary)
  const warrantyBoxWidth = summaryBoxX - 14 - 4;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, summaryY, warrantyBoxWidth, 32, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...primaryColor);
  doc.text('GENERAL WARRANTY TERMS & SERVICE POLICY:', 18, summaryY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...textMuted);
  const terms = [
    '• 100% Genuine Box-Pack: All components carry official manufacturer / distributor warranty from original invoice date.',
    '• Warranty Exclusions: Physical damage, burnt chips/circuits, electrical surges, bent pins, or liquid damage void warranty.',
    '• Claim Requirements: Please retain this original invoice copy and product serial boxes for manufacturer RMA claims.',
    '• 24/7 Logistics Tracking: Live courier tracking scans can be verified on our website using your Tracking / CN #.',
  ];

  let termY = summaryY + 10;
  terms.forEach((t) => {
    doc.text(t, 18, termY);
    termY += 4.5;
  });

  // 7. Footer & Authorized Signatures
  const footerY = summaryY + 38;
  doc.setDrawColor(226, 232, 240);
  doc.line(14, footerY, pageWidth - 14, footerY);

  doc.setFontSize(7);
  doc.setTextColor(...textMuted);
  doc.text('This is a computer-generated invoice verified by ApexRig ERP logistics system.', 14, footerY + 5);
  doc.text('Thank you for shopping with ApexRig Pakistan! For support, WhatsApp: +92 300 1234567', 14, footerY + 9);

  // Signature Block
  const sigX = pageWidth - 60;
  doc.line(sigX, footerY + 8, pageWidth - 14, footerY + 8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textDark);
  doc.text('Authorized Signature & Stamp', sigX + 2, footerY + 12);

  // Save the PDF
  const filename = `Invoice-${order.orderNumber || order.id}.pdf`;
  doc.save(filename);
}

/**
 * Generates an official, beautifully formatted PC Hardware Quotation PDF
 */
export function generateQuotationPdf(
  build: PCBuildParts,
  selectedVariants: Record<string, string>,
  settings?: StoreSettings,
  customerName?: string
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const storeName = settings?.storeName || 'APEXRIG PC & COMPUTER HARDWARE';
  const tagline = settings?.tagline || "Pakistan's Premier Custom PC Builder & Tech Logistics Hub";
  const address = settings?.address || 'Hafeez Centre, Main Boulevard Gulberg III, Lahore, Pakistan';
  const phone = settings?.phone || settings?.whatsappNumber || '+92 300 1234567';
  const email = settings?.email || 'sales@apexrig.pk';

  const primaryColor: [number, number, number] = [15, 23, 42];
  const accentColor: [number, number, number] = [79, 70, 229];
  const textDark: [number, number, number] = [30, 41, 59];
  const textMuted: [number, number, number] = [100, 116, 139];

  // Header Brand Bar
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 26, 'F');
  doc.setFillColor(...accentColor);
  doc.rect(0, 26, pageWidth, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(storeName, 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(226, 232, 240);
  doc.text(tagline, 14, 18);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text('OFFICIAL PRICE QUOTATION', pageWidth - 14, 12, { align: 'right' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(199, 210, 254);
  doc.text('Valid for 3 Days from Issue Date', pageWidth - 14, 18, { align: 'right' });

  // Meta info
  let curY = 35;
  doc.setFontSize(8);
  doc.setTextColor(...textDark);
  doc.setFont('helvetica', 'bold');
  doc.text('ISSUED BY APEXRIG HARDWARE LABS:', 14, curY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textMuted);
  doc.text(address, 14, curY + 4);
  doc.text(`Direct Sales: ${phone} | Support: ${email}`, 14, curY + 8);

  const quoteNo = `QT-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
  const metaBoxX = pageWidth - 80;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(metaBoxX, curY - 2, 66, 22, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.setFontSize(9);
  doc.text(`QUOTATION #: ${quoteNo}`, metaBoxX + 4, curY + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...textMuted);
  doc.text(`Issue Date: ${new Date().toLocaleDateString('en-PK')}`, metaBoxX + 4, curY + 9);
  doc.text(`Client: ${customerName || 'Prospective Gaming / Pro Client'}`, metaBoxX + 4, curY + 14);

  curY += 25;

  const activeParts = Object.entries(build as Record<string, Product | undefined | null>).filter(
    (entry): entry is [string, Product] => Boolean(entry[1])
  );

  let subtotal = 0;
  const tableRows = activeParts.map(([cat, prod], idx) => {
    const variantId = selectedVariants[prod.id];
    const variant = prod.variants?.find((v) => v.id === variantId);
    const price = variant?.price || prod.price;
    subtotal += price;

    let desc = prod.name;
    if (variant && variant.name !== 'Standard') {
      desc += ` [${variant.name}${variant.color ? ` - ${variant.color}` : ''}]`;
    }

    return [
      String(idx + 1),
      desc,
      cat,
      prod.warranty || '1 Year Official Warranty',
      '1',
      formatPkr(price),
      formatPkr(price),
    ];
  });

  autoTable(doc, {
    startY: curY,
    head: [['#', 'Component Description & Specifications', 'Category', 'Warranty', 'Qty', 'Unit Price', 'Total']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      cellPadding: 2.5,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: textDark,
      cellPadding: 2.5,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 'auto', fontStyle: 'bold' },
      2: { cellWidth: 26 },
      3: { cellWidth: 32, textColor: [16, 149, 193] },
      4: { cellWidth: 10, halign: 'center' },
      5: { cellWidth: 26, halign: 'right' },
      6: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14 },
    tableWidth: pageWidth - 28,
  });

  const lastTableY = (doc as any).lastAutoTable?.finalY || curY + 40;
  let summaryY = lastTableY + 4;

  if (summaryY + 65 > pageHeight) {
    doc.addPage();
    summaryY = 15;
  }

  // Summary box
  const summaryBoxWidth = 75;
  const summaryBoxX = pageWidth - 14 - summaryBoxWidth;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(summaryBoxX, summaryY, summaryBoxWidth, 28, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textMuted);
  doc.text('Parts Total:', summaryBoxX + 4, summaryY + 6);
  doc.setTextColor(...textDark);
  doc.text(formatPkr(subtotal), summaryBoxX + summaryBoxWidth - 4, summaryY + 6, { align: 'right' });

  doc.setTextColor(...textMuted);
  doc.text('Assembly & Stress Testing:', summaryBoxX + 4, summaryY + 11);
  doc.setTextColor(5, 150, 105);
  doc.text('FREE (Complimentary)', summaryBoxX + summaryBoxWidth - 4, summaryY + 11, { align: 'right' });

  doc.setFillColor(...accentColor);
  doc.roundedRect(summaryBoxX + 2, summaryY + 17, summaryBoxWidth - 4, 8, 1, 1, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('ESTIMATED RIG TOTAL:', summaryBoxX + 5, summaryY + 22.5);
  doc.text(formatPkr(subtotal), summaryBoxX + summaryBoxWidth - 5, summaryY + 22.5, { align: 'right' });

  // Terms Box
  const warrantyBoxWidth = summaryBoxX - 14 - 4;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, summaryY, warrantyBoxWidth, 28, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...primaryColor);
  doc.text('QUOTATION TERMS & RIG POLICIES:', 18, summaryY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...textMuted);
  const terms = [
    '• Hardware Pricing: Quotation is valid for 3 days and subject to USD currency fluctuations.',
    '• Genuine Warranty: All listed parts are 100% brand-new with distributor/brand warranty.',
    '• Rig Assembly: Includes professional cable management, thermal compound application & BIOS update.',
    '• Safe Shipping: Nationwide insured cargo delivery available to all major cities in Pakistan.',
  ];

  let termY = summaryY + 10;
  terms.forEach((t) => {
    doc.text(t, 18, termY);
    termY += 4;
  });

  const filename = `Quotation-${quoteNo}.pdf`;
  doc.save(filename);
}
