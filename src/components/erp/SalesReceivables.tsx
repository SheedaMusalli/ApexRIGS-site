import { InvoiceReceiptModal } from './InvoiceReceiptModal';
import React, { useState, useMemo, useEffect } from 'react';
import { authFetch } from '../../utils/apiClient';
import {
  FileText,
  Users,
  Plus,
  Search,
  Printer,
  Share2,
  Mail,
  MessageCircle,
  CreditCard,
  Building,
  CheckCircle,
  Clock,
  ArrowDownLeft,
  DollarSign,
  Trash2,
  Edit,
  Eye,
  Download,
  AlertCircle
} from 'lucide-react';
import {
  Customer,
  SalesDocument,
  CustomerReceipt,
  SalesDocumentType, DocumentPaymentMode,
  BranchLocationId,
  SalesItemLine
} from '../../types/erp';
import { Product } from '../../types';
import { erpStorage } from '../../services/erpStorage';
import { formatPkr } from '../../utils/formatters';
import { SearchableProductSelect } from '../SearchableProductSelect';

interface SalesReceivablesProps {
  products: Product[];
  activeBranchId: BranchLocationId;
}

export const SalesReceivables: React.FC<SalesReceivablesProps> = ({ products, activeBranchId }) => {
  const [activeTab, setActiveTab] = useState<'invoices' | 'customers' | 'quotations' | 'receipts' | 'credit_notes'>('invoices');
  const [customers, setCustomers] = useState<Customer[]>(() => erpStorage.getCustomers());
  const [salesDocs, setSalesDocs] = useState<SalesDocument[]>(() => erpStorage.getSalesDocuments());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [notification, setNotification] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  // Modal States
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [selectedDocForView, setSelectedDocForView] = useState<SalesDocument | null>(null);

  // New Invoice Form State
  const [editingDoc, setEditingDoc] = useState<SalesDocument | null>(null);
  const [editorAdminName, setEditorAdminName] = useState<string>('Admin (Hafeez Station ERP)');
  const [showInlineAddCustomer, setShowInlineAddCustomer] = useState<boolean>(false);
  const [inlineCustomer, setInlineCustomer] = useState<{ name: string; phone: string; city: string; address: string }>({
    name: '',
    phone: '',
    city: '',
    address: '',
  });
  const [newDocType, setNewDocType] = useState<SalesDocumentType>('SALES_ORDER');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [invoiceLines, setInvoiceLines] = useState<{ productId: string; qty: number; unitPrice: number; discount: number; serialNumber?: string }[]>([
    { productId: products[0]?.id || '', qty: 1, unitPrice: products[0]?.price || 0, discount: 0, serialNumber: '' }
  ]);
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [whtRate, setWhtRate] = useState<number>(0);
  const [laborFee, setLaborFee] = useState<number>(0);

  // New Payment Fields
  const bankAccounts = useMemo(() => erpStorage.getBankAccounts(), []);
  const [termDays, setTermDays] = useState<number>(30);
  const [dueDate, setDueDate] = useState<string>(new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]);
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentBank, setPaymentBank] = useState<string>('Cash in Hand');
  const [paymentMode, setPaymentMode] = useState<string>('CASH');
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [customDocumentNumber, setCustomDocumentNumber] = useState<string>('');

  // New Customer Form State
  const [customerForm, setCustomerForm] = useState<Partial<Customer>>({
    name: '',
    companyName: '',
    email: '',
    phone: '',
    whatsapp: '',
    city: '',
    address: '',
    ntn: '',
    isFiler: false,
    priceTier: 'RETAIL',
    creditLimitPkr: 0,
    creditDaysAllowed: 0,
  });

  const refreshData = async () => {
    try {
      const [custRes, docsRes] = await Promise.all([
        authFetch('/api/erp/customers').then((r) => (r.ok ? r.json() : null)),
        authFetch('/api/erp/sales-docs').then((r) => (r.ok ? r.json() : null)),
      ]);
      if (Array.isArray(custRes)) {
        setCustomers(custRes);
        try {
          localStorage.setItem('apex_erp_customers_v3', JSON.stringify(custRes));
        } catch (e) {}
      } else {
        setCustomers(erpStorage.getCustomers());
      }
      if (Array.isArray(docsRes)) {
        setSalesDocs(docsRes);
        try {
          localStorage.setItem('apex_erp_sales_docs_v3', JSON.stringify(docsRes));
        } catch (e) {}
      } else {
        setSalesDocs(erpStorage.getSalesDocuments());
      }
    } catch (e) {
      setCustomers(erpStorage.getCustomers());
      setSalesDocs(erpStorage.getSalesDocuments());
    }
  };

  useEffect(() => {
    refreshData();
    const handleSync = () => { setCustomers(erpStorage.getCustomers()); setSalesDocs(erpStorage.getSalesDocuments()); };
    window.addEventListener('apex:erp_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('apex:erp_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // Filtered Documents
  const filteredDocs = useMemo(() => {
    return salesDocs.filter((doc) => {
      if (activeTab === 'invoices' && doc.type !== 'INVOICE' && doc.type !== 'PROFORMA' && doc.type !== 'SALES_ORDER') return false;
      if (activeTab === 'quotations' && doc.type !== 'QUOTATION') return false;
      if (activeTab === 'credit_notes' && doc.type !== 'CREDIT_NOTE') return false;

      if (statusFilter !== 'ALL' && doc.status !== statusFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          doc.docNumber.toLowerCase().includes(q) ||
          doc.customerName.toLowerCase().includes(q) ||
          doc.customerPhone.includes(q)
        );
      }
      return true;
    });
  }, [salesDocs, activeTab, statusFilter, searchQuery]);

  // Filtered Customers
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    const q = searchQuery.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.companyName && c.companyName.toLowerCase().includes(q)) ||
        c.city.toLowerCase().includes(q)
    );
  }, [customers, searchQuery]);

  // Calculations for KPI Cards
  const stats = useMemo(() => {
    const totalReceivables = customers.reduce((acc, c) => acc + (c.currentBalancePkr > 0 ? c.currentBalancePkr : 0), 0);
    const totalInvoicedMonth = salesDocs
      .filter((d) => d.type === 'INVOICE' && !['DRAFT', 'CANCELLED'].includes(d.status))
      .reduce((acc, d) => acc + d.grandTotalPkr, 0);
    const overdueCount = salesDocs.filter(d => d.type === 'INVOICE' && !['DRAFT', 'CANCELLED'].includes(d.status) && d.balanceDuePkr > 0).length;
    return { totalReceivables, totalInvoicedMonth, overdueCount, totalCustomers: customers.length };
  }, [customers, salesDocs]);

  // Handle Adding Line to Invoice
  const handleAddLine = () => {
    if (products.length === 0) return;
    setInvoiceLines([...invoiceLines, { productId: products[0].id, qty: 1, unitPrice: products[0].price, discount: 0, serialNumber: '' }]);
  };

  const handleRemoveLine = (index: number) => {
    setInvoiceLines(invoiceLines.filter((_, i) => i !== index));
  };

  const handleProductSelect = (index: number, prodId: string, product?: Product) => {
    const prod = product || products.find((p) => p.id === prodId);
    if (!prod) return;
    const updated = [...invoiceLines];
    updated[index] = {
      ...updated[index],
      productId: prod.id,
      unitPrice: prod.price,
    };
    setInvoiceLines(updated);
  };

  // Create Invoice / Quotation
  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    const customer = customers.find((c) => c.id === selectedCustomerId);
    if (!customer) {
      alert('Please select a valid customer.');
      return;
    }

    if (!invoiceLines.length || invoiceLines.some(line => !line.productId || !Number.isInteger(line.qty) || line.qty <= 0 || !Number.isFinite(line.unitPrice) || line.unitPrice < 0 || !Number.isFinite(line.discount) || line.discount < 0 || line.discount > line.qty * line.unitPrice) || !Number.isFinite(laborFee) || laborFee < 0) {
      alert('Enter valid items, positive whole quantities, nonnegative prices, and discounts no greater than each line total.'); return;
    }
    if (editingDoc && (editingDoc.customerId !== customer.id || editingDoc.type !== newDocType)) {
      alert('Keep the original customer and document type when editing. Create a separate document to change them.'); return;
    }
    let subtotal = 0;
    let totalDiscount = 0;
    
    const items: SalesItemLine[] = invoiceLines.map((line, idx) => {
      const prod = products.find((p) => p.id === line.productId);
      const lineSub = line.qty * line.unitPrice;
      const lineDisc = line.discount;
      const taxable = Math.max(0, lineSub - lineDisc);
      subtotal += lineSub;
      totalDiscount += lineDisc;
      const cleanSerial = line.serialNumber?.trim() || undefined;
      const serialsArray = cleanSerial ? cleanSerial.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean) : undefined;
      
      return {
        id: 'line-' + idx + '-' + Date.now(),
        productId: line.productId,
        productName: prod ? prod.name : 'Custom Item',
        sku: prod ? prod.sku || 'SKU-CUSTOM' : 'SKU-CUSTOM',
        category: prod ? prod.category : 'General',
        quantity: line.qty,
        unitCostPkr: prod?.costPrice ?? 0,
        unitPrice: line.unitPrice,
        unitPricePkr: line.unitPrice,
        discountPkr: line.discount,
        taxRatePercent: 0,
        taxAmountPkr: 0,
        totalPkr: taxable,
        warehouseId: activeBranchId,
        serialNumber: cleanSerial,
        serialNumbers: serialsArray,
      };
    });

    const whtDeduction = 0;
    const grandTotal = subtotal - totalDiscount + laborFee;

    const docPrefix = newDocType === 'INVOICE' ? 'INV' : newDocType === 'QUOTATION' ? 'QTN' : 'SO';
    const finalDocNumber = customDocumentNumber.trim() || (editingDoc ? editingDoc.docNumber : `${docPrefix}-2026-${String(salesDocs.length + 101).padStart(4, '0')}`);
    const paidAmount = Number(paymentAmount) || 0;

    if (!Number.isFinite(paidAmount) || paidAmount < 0 || paidAmount + (editingDoc?.paidAmountPkr || 0) > grandTotal) {
      alert('Payment must not exceed the outstanding invoice amount.'); return;
    }
    if (editingDoc && paidAmount > 0) {
      alert('Use Receive payment in the invoice preview to record an additional payment. Save this edit with payment amount left blank.'); return;
    }
    if (salesDocs.some(d => d.docNumber === finalDocNumber && d.id !== editingDoc?.id)) {
      alert('This document number already exists. Choose a unique number.'); return;
    }
    if (editingDoc) {
      // EDIT EXISTING INVOICE: preserve original creation metadata, log audit trail
      const oldGrandTotal = editingDoc.grandTotalPkr;
      const balanceDelta = grandTotal - oldGrandTotal;

      const editEntry = {
        editedBy: editorAdminName.trim() || 'Admin (Hafeez Station ERP)',
        editedAt: new Date().toLocaleString('en-PK', {
          timeZone: 'Asia/Karachi',
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
        changeSummary: `Invoice updated (${items.length} lines, New Total: PKR ${grandTotal.toLocaleString()})`,
        previousGrandTotal: oldGrandTotal,
        newGrandTotal: grandTotal,
      };

      const updatedDoc: SalesDocument = {
        ...editingDoc,
        type: newDocType,
        docNumber: finalDocNumber,
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        customerEmail: customer.email,
        customerAddress: customer.address,
        customerNtn: customer.ntn,
        customerIsFiler: customer.isFiler,
        items,
        subtotalPkr: subtotal,
        totalDiscountPkr: totalDiscount,
        totalGstTaxPkr: 0,
        whtDeductionRate: 0,
        whtDeductionPkr: 0,
        shippingChargesPkr: 0,
        assemblyLaborFeePkr: laborFee,
        grandTotalPkr: grandTotal,
        status: (editingDoc.paidAmountPkr || 0) >= grandTotal ? 'PAID' : (editingDoc.paidAmountPkr || 0) > 0 ? 'PARTIALLY_PAID' : editingDoc.status,
        paidAmountPkr: Math.max(editingDoc.paidAmountPkr || 0, (editingDoc.paidAmountPkr || 0) + paidAmount),
        balanceDuePkr: Math.max(0, grandTotal - ((editingDoc.paidAmountPkr || 0) + paidAmount)),
        termDays,
        dueDate,
        previousBalancePkr: customer.currentBalancePkr,
        notes: invoiceNotes,
        updatedAt: new Date().toISOString(),
        editHistory: [...(editingDoc.editHistory || []), editEntry],
      };

      try {
        const response = await fetch(`/api/erp/sales-docs/${encodeURIComponent(updatedDoc.id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedDoc) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Invoice could not be updated.');
      } catch (error) { alert((error as Error).message); return; }
      setSalesDocs(erpStorage.saveSalesDocument(updatedDoc));
      void refreshData();

      showToast(`Invoice #${updatedDoc.docNumber} updated. Audit log recorded.`);
      setIsInvoiceModalOpen(false);
      setEditingDoc(null);
      setSelectedDocForView(updatedDoc);
      window.dispatchEvent(new CustomEvent('apex:erp_updated'));
      return;
    }

    // CREATE NEW INVOICE
    let newDoc: SalesDocument = {
      id: 'sdoc-' + Date.now(),
      docNumber: finalDocNumber,
      type: newDocType,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerEmail: customer.email,
      customerAddress: customer.address,
      customerNtn: customer.ntn,
      customerIsFiler: customer.isFiler,
      branchId: activeBranchId,
      issueDate: new Date().toISOString().split('T')[0],
      dueDate,
      termDays,
      previousBalancePkr: customer.currentBalancePkr,
      status: paidAmount >= grandTotal ? 'PAID' : paidAmount > 0 ? 'PARTIALLY_PAID' : (newDocType === 'QUOTATION' ? 'SENT' : 'CONFIRMED'),
      items,
      subtotalPkr: subtotal,
      totalDiscountPkr: totalDiscount,
      totalGstTaxPkr: 0,
        whtDeductionRate: 0,
        whtDeductionPkr: 0,
      shippingChargesPkr: 0,
      assemblyLaborFeePkr: laborFee,
      grandTotalPkr: grandTotal,
      paidAmountPkr: paidAmount,
      balanceDuePkr: Math.max(0, grandTotal - paidAmount),
      paymentMethod: paidAmount > 0 ? paymentMode : undefined,
      paymentReference: paidAmount > 0 ? paymentReference : undefined,
      paymentDetails: paidAmount > 0 ? {
        date: paymentDate,
        bank: paymentBank,
        mode: paymentMode as DocumentPaymentMode,
        referenceNumber: paymentReference || finalDocNumber,
        amount: paidAmount,
      } : undefined,
      notes: invoiceNotes,
      salesAgent: 'Senior Sales Account Manager',
      createdBy: 'admin_hafeez',
      createdByName: editorAdminName.trim() || 'Admin (Hafeez Station ERP)',
      createdByType: 'admin',
      editHistory: [],
      createdAt: new Date().toISOString(),
    };

    newDoc.paidAmountPkr = 0;
    newDoc.balanceDuePkr = grandTotal;
    newDoc.status = newDocType === 'QUOTATION' ? 'SENT' : 'CONFIRMED';
    delete newDoc.paymentDetails;
    try {
      const response = await authFetch('/api/erp/sales-docs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newDoc) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Document could not be saved.');
      newDoc = data.doc;
    } catch (error) { alert((error as Error).message); return; }
    if (newDocType === 'INVOICE' && paidAmount > 0) {
      try {
        const response = await authFetch(`/api/erp/sales-docs/${encodeURIComponent(newDoc.id)}/receipts`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: crypto.randomUUID(), amount: paidAmount, bankAccountId: bankAccounts.find(b => b.accountName === paymentBank)?.id, date: paymentDate, reference: paymentReference }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Payment could not be posted.');
        newDoc = data.doc;
      } catch (error) { alert('Document saved as unpaid. Use Receive payment to retry: ' + (error as Error).message); }
    }
    setSalesDocs(erpStorage.saveSalesDocument(newDoc));
    void refreshData();

    // Create corresponding Custom Order for ERP
    if (newDocType === 'INVOICE' || newDocType === 'SALES_ORDER') {
      const orderPayload = {
        id: newDoc.id,
        orderNumber: newDoc.docNumber,
        customer: {
          fullName: customer.name,
          email: customer.email || 'no-email@apex.local',
          phone: customer.phone || '00000000000',
          address: customer.address || 'Local ERP Customer',
          city: 'N/A'
        },
        items: items.map(item => ({
          id: item.productId || 'custom-' + Date.now(),
          productId: item.productId || '',
          name: item.productName || 'Custom Item',
          category: item.category || 'General',
          quantity: item.quantity || 1,
          price: item.unitPricePkr || 0,
          image: ''
        })),
        paymentMethod: 'ERP ' + (paymentMode || 'Payment'),
        subtotal: subtotal,
        shippingFee: 0,
        discount: totalDiscount,
        total: grandTotal,
        source: 'ERP'
      };
      authFetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      }).catch(() => {});
    }

    showToast(`Invoice #${newDoc.docNumber} generated. Logged by ${newDoc.createdByName}.`);
    setIsInvoiceModalOpen(false);
    setSelectedDocForView(newDoc);
    window.dispatchEvent(new CustomEvent('apex:erp_updated'));
  };

  // Start Editing Existing Invoice
  const handleStartEdit = (doc: SalesDocument) => {
    setPaymentAmount('');
    setEditingDoc(doc);
    setNewDocType(doc.type);
    setCustomDocumentNumber(doc.docNumber);
    setSelectedCustomerId(doc.customerId);
    setInvoiceLines(
      doc.items.length > 0
        ? doc.items.map((it) => ({
            productId: it.productId,
            qty: it.quantity,
            unitPrice: it.unitPricePkr,
            discount: it.discountPkr || 0,
            serialNumber: it.serialNumber || (it.serialNumbers && it.serialNumbers.length > 0 ? it.serialNumbers.join(', ') : ''),
          }))
        : [{ productId: products[0]?.id || '', qty: 1, unitPrice: products[0]?.price || 0, discount: 0, serialNumber: '' }]
    );
    setInvoiceNotes(doc.notes || '');
    setWhtRate(doc.whtDeductionRate || 0);
    setLaborFee(doc.assemblyLaborFeePkr || 0);
    setTermDays(doc.termDays || 30);
    setDueDate(doc.dueDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]);
    setShowInlineAddCustomer(false);
    setIsInvoiceModalOpen(true);
  };

  // Open Blank New Invoice Modal
  const handleOpenNewInvoice = () => {
    setEditingDoc(null);
    setNewDocType('INVOICE');
    setSelectedCustomerId(customers[0]?.id || '');
    setInvoiceLines([
      { productId: products[0]?.id || '', qty: 1, unitPrice: products[0]?.price || 0, discount: 0, serialNumber: '' }
    ]);
    setInvoiceNotes('Payment within 30 days. Hardware warranty covered under official manufacturer serials.');
    setWhtRate(1.5);
    setLaborFee(0);
    setTermDays(30);
    setDueDate(new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]);
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentBank('Cash in Hand');
    setPaymentMode('CASH');
    setPaymentReference('');
    setPaymentAmount('');
    setCustomDocumentNumber('');
    setShowInlineAddCustomer(false);
    setIsInvoiceModalOpen(true);
  };

  // Quick Inline Customer Creation (Zero Credit Limit Restrictions)
  const handleCreateInlineCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineCustomer.name.trim() || !inlineCustomer.phone.trim()) {
      alert('Please enter at least customer full name and phone number.');
      return;
    }

    const newCust: Customer = {
      id: 'cust-' + Date.now(),
      name: inlineCustomer.name.trim(),
      companyName: '',
      email: '',
      phone: inlineCustomer.phone.trim(),
      whatsapp: inlineCustomer.phone.trim(),
      city: inlineCustomer.city.trim() || '',
      address: inlineCustomer.address.trim() || '',
      ntn: '',
      isFiler: false,
      priceTier: 'RETAIL',
      creditLimitPkr: 0,
      creditDaysAllowed: 0,
      currentBalancePkr: 0,
      totalSalesPkr: 0,
      createdAt: new Date().toISOString(),
    };

    const updated = erpStorage.saveCustomer(newCust);
    setCustomers(updated);
    setSelectedCustomerId(newCust.id);
    setShowInlineAddCustomer(false);
    setInlineCustomer({ name: '', phone: '', city: '', address: '' });
    showToast(`Customer "${newCust.name}" added and selected for billing.`);
  };

  // Create Customer from Customer Tab Modal
  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerForm.name || !customerForm.phone) {
      alert('Please fill customer name and phone.');
      return;
    }

    const newCust: Customer = {
      id: 'cust-' + Date.now(),
      name: customerForm.name || '',
      companyName: customerForm.companyName || '',
      email: customerForm.email || '',
      phone: customerForm.phone || '',
      whatsapp: customerForm.whatsapp || customerForm.phone || '',
      city: customerForm.city || '',
      address: customerForm.address || '',
      ntn: customerForm.ntn || '',
      isFiler: customerForm.isFiler ?? false,
      priceTier: customerForm.priceTier || 'RETAIL',
      creditLimitPkr: Number(customerForm.creditLimitPkr) || 0,
      creditDaysAllowed: Number(customerForm.creditDaysAllowed) || 0,
      currentBalancePkr: 0,
      totalSalesPkr: 0,
      createdAt: new Date().toISOString(),
    };

    const updated = erpStorage.saveCustomer(newCust);
    setCustomers(updated);
    setIsCustomerModalOpen(false);
    showToast(`Customer "${newCust.name}" registered successfully.`);
    setCustomerForm({
      name: '',
      companyName: '',
      email: '',
      phone: '',
      whatsapp: '',
      city: '',
      address: '',
      ntn: '',
      isFiler: false,
      priceTier: 'RETAIL',
      creditLimitPkr: 0,
      creditDaysAllowed: 0,
    });
  };

  // WhatsApp & Email Sharing Link Generator
  const generateWhatsAppShare = (doc: SalesDocument) => {
    const text = `*ApexRig PC & Computer Hardware*%0A*${doc.type === 'INVOICE' ? 'Sales Invoice' : 'Price Quotation'} #${doc.docNumber}*%0A%0A*Customer:* ${doc.customerName}%0A*Date:* ${doc.issueDate}%0A*Total Amount:* PKR ${doc.grandTotalPkr.toLocaleString()}%0A*Status:* ${doc.status}%0A%0AItems:%0A${doc.items.map((i) => `• ${i.quantity}x ${i.productName} (PKR ${i.unitPricePkr.toLocaleString()})`).join('%0A')}%0A%0A_Thank you for choosing ApexRig Pakistan._`;
    const cleanPhone = doc.customerPhone.replace(/[^0-9]/g, '');
    const url = `https://wa.me/${cleanPhone.startsWith('92') ? cleanPhone : '92' + cleanPhone.replace(/^0/, '')}?text=${text}`;
    window.open(url, '_blank');
  };

  const handleDeleteDoc = async (docId: string, docNumber: string) => {
    try {
      const response = await fetch(`/api/erp/sales-docs/${encodeURIComponent(docId)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error((await response.json()).error || 'Document could not be deleted.');
      localStorage.setItem('apex_erp_sales_docs_v3', JSON.stringify(erpStorage.getSalesDocuments().filter(d => d.id !== docId)));
      setSelectedDocForView(null); await refreshData();
    } catch (error) { alert((error as Error).message); return; }
    showToast(`Sales record #${docNumber} deleted successfully.`);
    window.dispatchEvent(new CustomEvent('apex:erp_updated'));
  };

  const handleDeleteCustomer = (customerId: string, customerName: string) => {
    const updated = erpStorage.deleteCustomer(customerId);
    setCustomers(updated);
    fetch(`/api/erp/customers/${encodeURIComponent(customerId)}`, { method: 'DELETE' }).catch(() => {});
    showToast(`Customer "${customerName}" removed from records.`);
    window.dispatchEvent(new CustomEvent('apex:erp_updated'));
  };

  return (
    <div className="space-y-6">
      {isReceiptModalOpen && selectedDocForView && <InvoiceReceiptModal invoice={selectedDocForView} onClose={() => setIsReceiptModalOpen(false)} onSaved={doc => {
        erpStorage.saveSalesDocument(doc); setSelectedDocForView(doc); setIsReceiptModalOpen(false); void refreshData(); showToast('Receipt posted. Invoice and cash balances updated.');
      }} />}
      {notification && (
        <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-semibold animate-in fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-emerald-500/20 rounded-2xl p-4 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Outstanding Receivables</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-300 font-mono">
            {formatPkr(stats.totalReceivables)}
          </div>
          <div className="text-[11px] text-emerald-400/80 mt-1 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            <span>Across {stats.totalCustomers} corporate & retail debtors</span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-blue-500/20 rounded-2xl p-4 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Total Invoiced</span>
            <FileText className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-blue-300 font-mono">
            {formatPkr(stats.totalInvoicedMonth)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Sales Recorded</div>
        </div>

        <div className="bg-slate-900/80 border border-amber-500/20 rounded-2xl p-4 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Pending Settlements</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-300 font-mono">
            {stats.overdueCount} Invoices
          </div>
          <div className="text-[11px] text-amber-400/80 mt-1">Awaiting customer collection</div>
        </div>

        <div className="bg-slate-900/80 border border-purple-500/20 rounded-2xl p-4 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Active Customers</span>
            <Users className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-purple-300 font-mono">
            {stats.totalCustomers} Accounts
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Ledgers & credit tier active</div>
        </div>
      </div>

      {/* Sub-Tabs & Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-white/10">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('invoices')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'invoices'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Sales Invoices & Orders</span>
          </button>

          <button
            onClick={() => setActiveTab('quotations')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'quotations'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Quotations & Estimates</span>
          </button>

          <button
            onClick={() => setActiveTab('customers')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'customers'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Customer Ledgers</span>
          </button>

          <button
            onClick={() => setActiveTab('credit_notes')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'credit_notes'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>Credit Notes & Returns</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search invoice, customer, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <button
            onClick={handleOpenNewInvoice}
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all shrink-0"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{activeTab === 'quotations' ? 'New Quotation' : 'Create Invoice'}</span>
          </button>

          <button
            onClick={() => setIsCustomerModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-purple-600/20 transition-all shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Customer</span>
          </button>
        </div>
      </div>

      {/* Main Table / View Area */}
      {activeTab !== 'customers' ? (
        <div className="bg-slate-900/90 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] font-bold border-b border-white/10">
                <tr>
                  <th className="py-3.5 px-4">Doc # & Type</th>
                  <th className="py-3.5 px-4">Customer & Phone</th>
                  <th className="py-3.5 px-4">Issue Date</th>
                  <th className="py-3.5 px-4">Items / SKUs</th>
                  <th className="py-3.5 px-4 text-right">Grand Total (PKR)</th>
                  <th className="py-3.5 px-4 text-right">Balance Due</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredDocs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      No records found matching your filters.
                    </td>
                  </tr>
                ) : (
                  filteredDocs.map((doc) => (
                    <tr key={doc.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-amber-400">{doc.docNumber}</div>
                        <div className="text-[10px] text-slate-500">{doc.type}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{doc.customerName}</div>
                        <div className="text-[11px] text-slate-400">{doc.customerPhone}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">{doc.issueDate}</td>
                      <td className="py-3 px-4">
                        <span className="bg-white/5 px-2 py-0.5 rounded text-[11px] text-slate-300">
                          {doc.items.reduce((acc, i) => acc + i.quantity, 0)} Units ({doc.items.length} SKUs)
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-white">
                        {formatPkr(doc.grandTotalPkr)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-amber-300">
                        {formatPkr(doc.balanceDuePkr)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            doc.status === 'PAID'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : doc.status === 'PARTIALLY_PAID'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          }`}
                        >
                          {doc.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleStartEdit(doc)}
                            className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 transition-colors"
                            title="Edit Invoice"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setSelectedDocForView(doc)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white"
                            title="View & Print Invoice"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => generateWhatsAppShare(doc)}
                            className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            title="Share via WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedDocForView(doc);
                              setTimeout(() => window.print(), 200);
                            }}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white"
                            title="Print PDF Voucher"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteDoc(doc.id, doc.docNumber);
                            }}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors"
                            title="Delete Record"
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
      ) : (
        /* CUSTOMER LEDGERS TABLE */
        <div className="bg-slate-900/90 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] font-bold border-b border-white/10">
                <tr>
                  <th className="py-3.5 px-4">Customer Name</th>
                  <th className="py-3.5 px-4">Company / NTN</th>
                  <th className="py-3.5 px-4">Contact Info</th>
                  <th className="py-3.5 px-4">Price Tier</th>
                  <th className="py-3.5 px-4 text-right">Credit Limit</th>
                  <th className="py-3.5 px-4 text-right">Outstanding Balance</th>
                  <th className="py-3.5 px-4 text-right">Total Lifetime Sales</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredCustomers.map((cust) => (
                  <tr key={cust.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-white">{cust.name}</div>
                      <div className="text-[10px] text-slate-500">{cust.city}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-300">{cust.companyName || 'Individual'}</div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {cust.companyName || "Retail"}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-mono text-slate-300">{cust.phone}</div>
                      <div className="text-[10px] text-slate-400">{cust.email}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {cust.priceTier}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-400">
                      {formatPkr(cust.creditLimitPkr)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold">
                      <span className={cust.currentBalancePkr > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                        {formatPkr(cust.currentBalancePkr)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-white">
                      {formatPkr(cust.totalSalesPkr)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedCustomerId(cust.id);
                            setIsInvoiceModalOpen(true);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 text-[11px] font-bold"
                        >
                          + Bill Customer
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCustomer(cust.id, cust.name);
                          }}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors"
                          title="Delete Customer Account"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: CREATE SALES INVOICE / QUOTATION */}
      {isInvoiceModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
          <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-6 lg:p-7 max-w-6xl w-full shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white uppercase tracking-wider">
                    {editingDoc ? `Edit ${newDocType === 'INVOICE' ? 'Sales Invoice' : 'Quotation'} #${editingDoc.docNumber}` : `Create ${newDocType === 'INVOICE' ? 'Sales Invoice' : 'Price Quotation'}`}
                  </h3>
                  <p className="text-[11px] text-slate-400">Generate customer invoice, manage credit payment terms, and log counter sales</p>
                </div>
              </div>
              <button onClick={() => setIsInvoiceModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-base">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateDocument} className="space-y-4 text-xs">
              {/* Top Controls Grid: 2 Balanced Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Customer Selector Card (7 cols) */}
                <div className="lg:col-span-7 bg-slate-950/70 p-4 rounded-2xl border border-white/5 space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-300 font-bold uppercase tracking-wider text-[11px]">Select Customer Account *</label>
                    <button
                      type="button"
                      onClick={() => setShowInlineAddCustomer(!showInlineAddCustomer)}
                      className="text-amber-400 hover:text-amber-300 font-bold text-xs flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      <span>{showInlineAddCustomer ? 'Cancel Fast Add' : '+ Fast Add Customer'}</span>
                    </button>
                  </div>
                  {!showInlineAddCustomer ? (
                    <select
                      value={selectedCustomerId}
                      onChange={(e) => setSelectedCustomerId(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:border-amber-500 focus:outline-none text-xs"
                    >
                      <option value="">Select customer…</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.phone ? `· ${c.phone}` : ''} {c.city ? `(${c.city})` : ''} · Bal: Rs {(c.currentBalancePkr || 0).toLocaleString()}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-3 bg-slate-900 border border-amber-500/40 rounded-xl space-y-2 animate-in fade-in duration-150">
                      <div className="text-[11px] font-bold text-amber-300">
                        Fast Add Customer:
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Full Name *"
                          value={inlineCustomer.name || ''}
                          onChange={(e) => setInlineCustomer({ ...inlineCustomer, name: e.target.value })}
                          className="bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                        />
                        <input
                          type="text"
                          placeholder="Phone Number *"
                          value={inlineCustomer.phone || ''}
                          onChange={(e) => setInlineCustomer({ ...inlineCustomer, phone: e.target.value })}
                          className="bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                        />
                        <input
                          type="text"
                          placeholder="City (e.g. Lahore)"
                          value={inlineCustomer.city || ''}
                          onChange={(e) => setInlineCustomer({ ...inlineCustomer, city: e.target.value })}
                          className="bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                        />
                        <input
                          type="text"
                          placeholder="Market / Address"
                          value={inlineCustomer.address || ''}
                          onChange={(e) => setInlineCustomer({ ...inlineCustomer, address: e.target.value })}
                          className="bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowInlineAddCustomer(false)}
                          className="px-2.5 py-1 text-slate-400 hover:text-white text-xs"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleCreateInlineCustomer}
                          className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg shadow"
                        >
                          Save & Select Customer
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Document Type & Reference (5 cols) */}
                <div className="lg:col-span-5 bg-slate-950/70 p-4 rounded-2xl border border-white/5 grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-300 font-bold block mb-1 uppercase tracking-wider text-[11px]">Doc Type</label>
                    <select
                      value={newDocType}
                      onChange={(e) => setNewDocType(e.target.value as SalesDocumentType)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-2.5 py-2 text-white focus:border-amber-500 focus:outline-none text-xs"
                    >
                      <option value="INVOICE">Sales Invoice</option>
                      <option value="QUOTATION">Price Quotation</option>
                      <option value="PROFORMA">Proforma Invoice</option>
                      <option value="SALES_ORDER">Sales Order</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-300 font-bold block mb-1 uppercase tracking-wider text-[11px]">Doc Number</label>
                    <input
                      type="text"
                      placeholder={editingDoc ? editingDoc.docNumber : 'Auto-generated'}
                      value={customDocumentNumber}
                      onChange={(e) => setCustomDocumentNumber(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-2.5 py-2 text-white font-mono text-xs focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="border border-white/10 rounded-2xl overflow-hidden bg-slate-950/60 shadow-inner space-y-0">
                <div className="p-3 bg-slate-950 flex items-center justify-between border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Item Details & Pricing</span>
                    <span className="text-xs text-slate-500">({invoiceLines.length} {invoiceLines.length === 1 ? 'line' : 'lines'})</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Product Line</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[800px]">
                    <thead className="bg-slate-900/90 text-slate-400 uppercase tracking-wider text-[11px] border-b border-white/5">
                      <tr>
                        <th className="p-3 font-semibold min-w-[280px]">Product / Component</th>
                        <th className="p-3 font-semibold w-56">Serial Number (S/N)</th>
                        <th className="p-3 w-24 text-center font-semibold">Quantity</th>
                        <th className="p-3 w-32 text-right font-semibold">Unit Price (PKR)</th>
                        <th className="p-3 w-32 text-right font-semibold">Line Total (PKR)</th>
                        <th className="p-3 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {invoiceLines.map((line, idx) => {
                        const lineTotal = (Number(line.qty) || 0) * (Number(line.unitPrice) || 0);
                        return (
                          <tr key={idx} className="hover:bg-white/[0.02]">
                            <td className="p-2.5 align-middle">
                              <SearchableProductSelect
                                products={products}
                                selectedProductId={line.productId}
                                onSelectProduct={(id, p) => handleProductSelect(idx, id, p)}
                                compact={true}
                                label=""
                                idPrefix={`inv-line-${idx}`}
                              />
                            </td>
                            <td className="p-2.5 align-middle">
                              <input
                                type="text"
                                placeholder="Hardware S/N"
                                value={line.serialNumber || ''}
                                onChange={(e) => {
                                  const updated = [...invoiceLines];
                                  updated[idx].serialNumber = e.target.value;
                                  setInvoiceLines(updated);
                                }}
                                className="w-full bg-slate-900 border border-white/10 rounded-xl px-2.5 py-2 text-amber-300 font-mono text-xs focus:border-amber-500 focus:outline-none placeholder-slate-600"
                              />
                            </td>
                            <td className="p-2.5 align-middle">
                              <input
                                type="number"
                                min="1"
                                placeholder="Qty"
                                value={line.qty}
                                onChange={(e) => {
                                  const updated = [...invoiceLines];
                                  updated[idx].qty = Number(e.target.value);
                                  setInvoiceLines(updated);
                                }}
                                className="w-full bg-slate-900 border border-white/10 rounded-xl px-2.5 py-2 text-white font-mono text-center text-xs focus:border-amber-500 focus:outline-none"
                              />
                            </td>
                            <td className="p-2.5 align-middle">
                              <input
                                type="number"
                                placeholder="Unit Price"
                                value={line.unitPrice || ''}
                                onChange={(e) => {
                                  const updated = [...invoiceLines];
                                  updated[idx].unitPrice = Number(e.target.value);
                                  setInvoiceLines(updated);
                                }}
                                className="w-full bg-slate-900 border border-white/10 rounded-xl px-2.5 py-2 text-white font-mono text-right text-xs focus:border-amber-500 focus:outline-none"
                              />
                            </td>
                            <td className="p-3 align-middle text-right font-mono font-bold text-slate-100 text-xs">
                              {formatPkr(lineTotal)}
                            </td>
                            <td className="p-2.5 align-middle text-center">
                              <button
                                type="button"
                                disabled={invoiceLines.length === 1}
                                onClick={() => handleRemoveLine(idx)}
                                className="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 disabled:opacity-20 flex items-center justify-center transition-colors mx-auto"
                                title="Remove line"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bottom 2-Column Grid: Left (Terms/Notes/Audit) & Right (Totals & Payment) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Left 7 Columns: Terms & Notes & Audit */}
                <div className="lg:col-span-7 space-y-3 bg-slate-950/60 p-4 rounded-2xl border border-white/5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-400 block mb-1 font-semibold text-[11px]">Payment Term (Days)</label>
                      <input
                        type="number"
                        value={termDays}
                        onChange={(e) => {
                          setTermDays(Number(e.target.value));
                          setDueDate(new Date(Date.now() + Number(e.target.value) * 86400000).toISOString().split('T')[0]);
                        }}
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white font-mono focus:border-amber-500 focus:outline-none text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1 font-semibold text-[11px]">Due Date</label>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white font-mono focus:border-amber-500 focus:outline-none text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1 font-semibold text-[11px]">Notes & Warranty Terms</label>
                    <textarea
                      value={invoiceNotes}
                      placeholder="e.g. Official warranty verified by serial numbers, deliver via courier..."
                      onChange={(e) => setInvoiceNotes(e.target.value)}
                      rows={2}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1 font-semibold text-[11px]">
                      {editingDoc ? 'Edited By (Audit Trail)' : 'Created By (Audit Trail)'}
                    </label>
                    <input
                      type="text"
                      value={editorAdminName}
                      onChange={(e) => setEditorAdminName(e.target.value)}
                      placeholder="e.g. Hammad Ur Rehman (Admin)"
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white font-medium text-xs focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Right 5 Columns: Financial Summary & Immediate Payment */}
                <div className="lg:col-span-5 space-y-3 bg-slate-950/60 p-4 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-2 text-amber-400 font-bold border-b border-white/5 pb-2">
                    <CreditCard className="w-4 h-4" />
                    <h4 className="uppercase tracking-wider text-xs">Billing Summary & Settlement</h4>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-300">
                    <div className="flex justify-between items-center text-slate-400">
                      <span>Items Subtotal:</span>
                      <span className="font-mono text-white font-semibold">
                        {formatPkr(invoiceLines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0))}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-400">
                      <span>Customer Prev. Balance:</span>
                      <span className="font-mono text-slate-300">
                        {formatPkr(customers.find(c => c.id === selectedCustomerId)?.currentBalancePkr || 0)}
                      </span>
                    </div>
                    <div className="bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl flex justify-between items-center my-1">
                      <span className="font-bold text-white text-xs uppercase tracking-wider">Invoice Grand Total:</span>
                      <span className="font-mono font-black text-amber-400 text-base">
                        {formatPkr(invoiceLines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0))}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/10 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-slate-400 block mb-0.5 text-[11px]">Payment Mode</label>
                        <select
                          value={paymentMode}
                          onChange={(e) => setPaymentMode(e.target.value as string)}
                          className="w-full bg-slate-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-white text-xs focus:border-amber-500 focus:outline-none"
                        >
                          <option value="CASH">Cash</option>
                          <option value="CHECK">Check</option>
                          <option value="CREDIT_CARD">Credit Card</option>
                          <option value="ONLINE">Bank Transfer (IBFT)</option>
                          <option value="OFFSET">Trade-in (Offset)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-slate-400 block mb-0.5 text-[11px]">Bank / Account</label>
                        <select
                          value={paymentBank}
                          onChange={(e) => setPaymentBank(e.target.value)}
                          className="w-full bg-slate-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-white text-xs focus:border-amber-500 focus:outline-none"
                        >
                          <option value="Cash in Hand">Cash in Hand</option>
                          {bankAccounts.filter(b => b.type !== 'CASH_DRAWER').map(bank => (
                            <option key={bank.id} value={bank.accountName}>{bank.accountName}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-slate-400 block mb-0.5 text-[11px]">Ref / Trx # (Optional)</label>
                        <input
                          type="text"
                          placeholder="Optional"
                          value={paymentReference}
                          onChange={(e) => setPaymentReference(e.target.value)}
                          className="w-full bg-slate-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-white font-mono text-xs focus:border-amber-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-emerald-400 font-bold block mb-0.5 text-[11px]">Received (PKR)</label>
                        <input
                          type="number"
                          placeholder="0.00"
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value ? Number(e.target.value) : '')}
                          className="w-full bg-slate-900 border border-emerald-500/50 rounded-xl px-2.5 py-1.5 text-emerald-300 font-mono font-bold text-xs focus:border-emerald-400 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsInvoiceModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-lg shadow-amber-500/20 text-xs transition-all active:scale-95"
                >
                  {editingDoc ? 'Save Changes & Log Audit' : 'Save & Issue Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE CUSTOMER */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-purple-500/30 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold">
                  <Users className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Add New Customer Account</h3>
              </div>
              <button onClick={() => setIsCustomerModalOpen(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Customer Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Syed Hamza Farooq"
                  value={customerForm.name || ''}
                  onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">Phone / Mobile *</label>
                  <input
                    type="text"
                    required
                    placeholder="+92 300 1234567"
                    value={customerForm.phone || ''}
                    onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">WhatsApp #</label>
                  <input
                    type="text"
                    placeholder="+92 300 1234567"
                    value={customerForm.whatsapp || ''}
                    onChange={(e) => setCustomerForm({ ...customerForm, whatsapp: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">Company / Organization</label>
                  <input
                    type="text"
                    placeholder="e.g. Alpha Gaming Arena"
                    value={customerForm.companyName || ''}
                    onChange={(e) => setCustomerForm({ ...customerForm, companyName: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">City</label>
                  <input
                    type="text"
                    value={customerForm.city || ''}
                    onChange={(e) => setCustomerForm({ ...customerForm, city: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">Credit Limit (PKR)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={customerForm.creditLimitPkr || ''}
                    onChange={(e) => setCustomerForm({ ...customerForm, creditLimitPkr: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Price Tier</label>
                  <select
                    value={customerForm.priceTier || ''}
                    onChange={(e) => setCustomerForm({ ...customerForm, priceTier: e.target.value as any })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="RETAIL">Retail Customer</option>
                    <option value="WHOLESALE">Wholesale Tier</option>
                    <option value="DEALER_RESELLER">Dealer / Reseller</option>
                    <option value="VIP_GAMER">VIP Gamer Club</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-lg shadow-purple-600/20"
                >
                  Save Customer Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PRINTABLE INVOICE / QUOTATION VIEW */}
      {selectedDocForView && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4">
          <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-6 lg:p-8 max-w-5xl xl:max-w-6xl w-full shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  {selectedDocForView.type} #{selectedDocForView.docNumber}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const docToEdit = selectedDocForView;
                    setSelectedDocForView(null);
                    handleStartEdit(docToEdit);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs flex items-center gap-1 border border-amber-500/40 transition-all"
                  title="Edit Invoice"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Edit Invoice</span>
                </button>
                <button
                  onClick={() => generateWhatsAppShare(selectedDocForView)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteDoc(selectedDocForView.id, selectedDocForView.docNumber);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 font-bold text-xs flex items-center gap-1 border border-rose-500/30 transition-all"
                  title="Delete Record"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
                {selectedDocForView.type === 'INVOICE' && selectedDocForView.balanceDuePkr > 0 && !['DRAFT', 'CANCELLED', 'REFUNDED'].includes(selectedDocForView.status) && <button onClick={() => setIsReceiptModalOpen(true)} className="px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold">Receive payment</button>}
                <button onClick={() => setSelectedDocForView(null)} className="text-slate-400 hover:text-white px-2">
                  ✕
                </button>
              </div>
            </div>

            {/* Printable Slip Preview */}
            <div className="bg-white text-slate-900 p-6 rounded-2xl space-y-4 font-sans text-xs">
              <div className="flex justify-between border-b border-slate-200 pb-4">
                <div>
                  <h1 className="text-lg font-black tracking-tight text-slate-950">APEXRIG PC & GAMING HARDWARE</h1>
                  <p className="text-[11px] text-slate-600">Hafeez Centre, Main Boulevard Gulberg III, Lahore</p>
                  
                </div>
                <div className="text-right">
                  <div className="text-sm font-black text-amber-600 uppercase">{selectedDocForView.type}</div>
                  <div className="font-mono font-bold text-slate-900">{selectedDocForView.docNumber}</div>
                  <div className="text-slate-500">Date: {selectedDocForView.issueDate}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-b border-slate-200 pb-3">
                <div>
                  <div className="font-bold text-slate-700 uppercase text-[10px]">Billed To:</div>
                  <div className="font-bold text-slate-900">{selectedDocForView.customerName}</div>
                  <div>{selectedDocForView.customerPhone}</div>
                  <div>{selectedDocForView.customerAddress}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-slate-700 uppercase text-[10px]">Payment Status:</div>
                  <div className="font-black text-emerald-700 uppercase">{selectedDocForView.status}</div>
                  <div className="text-slate-600 font-mono">Due Date: {selectedDocForView.dueDate}</div>
                </div>
              </div>

              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-300 text-slate-600 text-[10px] uppercase font-bold">
                    <th className="py-2">Item / Hardware Description</th>
                    <th className="py-2 text-center">Qty</th>
                    <th className="py-2 text-right">Unit Price</th>
                    <th className="py-2 text-right">Tax (PKR)</th>
                    <th className="py-2 text-right">Total (PKR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {(selectedDocForView.items || []).map((i, idx) => (
                    <tr key={idx}>
                      <td className="py-2 font-sans">
                        <div className="font-bold text-slate-900">{i.productName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">SKU: {i.sku}</div>
                        {(i.serialNumber || (i.serialNumbers && i.serialNumbers.length > 0)) && (
                          <div className="text-[10px] font-bold text-indigo-700 font-mono mt-0.5">
                            S/N: {i.serialNumber || i.serialNumbers?.join(', ')}
                          </div>
                        )}
                      </td>
                      <td className="py-2 text-center">{i.quantity}</td>
                      <td className="py-2 text-right">{i.unitPricePkr.toLocaleString()}</td>
                      <td className="py-2 text-right">{(i.taxAmountPkr || 0).toLocaleString()}</td>
                      <td className="py-2 text-right font-bold">{i.totalPkr.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-end pt-3 border-t border-slate-200">
                <div className="w-64 space-y-1 font-mono text-[11px]">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span>PKR {selectedDocForView.subtotalPkr.toLocaleString()}</span>
                  </div>
                  {selectedDocForView.totalDiscountPkr > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Discount:</span>
                      <span>- PKR {selectedDocForView.totalDiscountPkr.toLocaleString()}</span>
                    </div>
                  )}
                  {selectedDocForView.assemblyLaborFeePkr > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Labor & Assembly:</span>
                      <span>PKR {selectedDocForView.assemblyLaborFeePkr.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-sm text-slate-950 pt-2 border-t border-slate-300 font-sans">
                    <span>Grand Total:</span>
                    <span>PKR {selectedDocForView.grandTotalPkr.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-500 pt-1">
                    <span>Balance Due:</span>
                    <span className="font-bold text-red-600">PKR {selectedDocForView.balanceDuePkr.toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <div className="mt-6 pt-3 border-t border-slate-300 text-[10px] text-slate-500 font-mono space-y-1 flex justify-between">
                <div>
                  <span className="block font-bold">Doc ID: {selectedDocForView.id}</span>
                  <span>Issued By User: {selectedDocForView.createdBy}</span>
                </div>
                <div className="text-right">
                  <span className="block font-bold">System Record Date</span>
                  <span>{new Date(selectedDocForView.createdAt).toLocaleString('en-PK')}</span>
                </div>
              </div>
              
              {selectedDocForView.editHistory && selectedDocForView.editHistory.length > 0 && (
                  <div className="pt-2 border-t border-slate-200 mt-1">
                    <strong className="text-slate-800 block mb-1">ERP Modification & Revision History:</strong>
                    <ul className="space-y-1 font-mono">
                      {selectedDocForView.editHistory.map((entry, idx) => (
                        <li key={idx} className="flex justify-between text-slate-600 bg-white p-1.5 rounded border border-slate-200">
                          <span>
                            • Edited by <strong>{entry.editedBy}</strong>: {entry.changeSummary}
                          </span>
                          <span className="text-slate-500 font-bold">{entry.editedAt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
      )}
    </div>
  );
};
