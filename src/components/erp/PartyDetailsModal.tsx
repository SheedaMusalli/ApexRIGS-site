import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Check,
  Building2,
  User,
  Mail,
  Phone,
  Smartphone,
  Globe,
  Hash,
  MapPin,
  FileText,
  CreditCard,
  Percent,
  Calendar,
  Layers,
  Sliders,
  AlertCircle,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { api, localDate } from './SourceDocumentForm';

export type PartySubTab = 'address' | 'terms' | 'notes' | 'additional';

export interface PartyData {
  id?: string;
  name?: string;
  businessName?: string;
  companyName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  mobileNumber?: string;
  phone?: string;
  accountNumber?: string;
  code?: string;
  website?: string;
  
  // Address
  billingAddress?: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;

  // Tax Info
  ntn?: string;
  ntnNumber?: string;
  stn?: string;
  strnNumber?: string;
  cnic?: string;
  isFiler?: boolean;

  // Terms
  paymentTermsDays?: number;
  creditLimitPkr?: number;
  openingDate?: string;
  openingBalancePkr?: number;
  discountPercent?: number;
  applyCreditLimit?: boolean;
  isSupplier?: boolean;

  // Notes
  notes?: string;

  // Additional Fields
  field1?: string;
  fieldA?: string;
  field2?: string;
  fieldB?: string;
  field3?: string;
  fieldC?: string;

  createdAt?: string;
  currentBalancePkr?: number;
  currentPayableBalancePkr?: number;
  totalSalesPkr?: number;
  totalPurchasesPkr?: number;
}

export interface PartyDetailsModalProps {
  isOpen: boolean;
  kind: 'sales' | 'purchases'; // sales = customer, purchases = supplier
  initial?: PartyData | null;
  onClose: () => void;
  onSaved: (savedParty: PartyData) => void;
}

const PAKISTAN_PROVINCES = [
  'Punjab',
  'Sindh',
  'Khyber Pakhtunkhwa (KPK)',
  'Balochistan',
  'Islamabad Capital Territory',
  'Gilgit-Baltistan',
  'Azad Jammu & Kashmir (AJK)',
  'Other / International'
];

const FIELD1_OPTIONS = [
  'Retail Client / Consumer',
  'Wholesale Trader',
  'Authorized Distributor',
  'Corporate / Enterprise',
  'Gaming Lounge / Cyber Cafe',
  'Government / Tender',
  'Walk-in Store Customer',
  'VIP Account',
  'Other Category'
];

const FIELD2_OPTIONS = [
  'Bank Transfer (Online IBFT)',
  'Cash on Delivery (COD)',
  'Cash at Counter (POS)',
  'Raast Instant Pay',
  'Bank Cheque / Pay Order',
  'Credit / Debit Card',
  'Credit Settlement Account',
  'Other Payment Mode'
];

const FIELD3_OPTIONS = [
  'Shop Handover (Hafeez Center)',
  'Leopard Courier Service',
  'TCS Express Logistics',
  'Daewoo Fastex',
  'M&P Express',
  'Direct Cargo / Goods Transport',
  'Customer Self-Arranged Pickup',
  'Same-Day Lahore Delivery',
  'Other Logistics'
];

export function PartyDetailsModal({
  isOpen,
  kind,
  initial,
  onClose,
  onSaved,
}: PartyDetailsModalProps) {
  const isSales = kind === 'sales';
  const [activeTab, setActiveTab] = useState<PartySubTab>('address');

  // Primary Header Fields
  const [businessName, setBusinessName] = useState(initial?.businessName || initial?.companyName || '');
  const [firstName, setFirstName] = useState(initial?.firstName || '');
  const [lastName, setLastName] = useState(initial?.lastName || '');
  const [email, setEmail] = useState(initial?.email || '');
  const [mobileNumber, setMobileNumber] = useState(initial?.mobileNumber || initial?.phone || '');
  const [phone, setPhone] = useState(initial?.phone || '');
  const [accountNumber, setAccountNumber] = useState(initial?.accountNumber || initial?.code || '');
  const [website, setWebsite] = useState(initial?.website || '');

  // Sub-Tab 1: Address
  const [billingAddress, setBillingAddress] = useState(initial?.billingAddress || initial?.address || '');
  const [city, setCity] = useState(initial?.city || '');
  const [province, setProvince] = useState(initial?.province || '');
  const [postalCode, setPostalCode] = useState(initial?.postalCode || '');
  const [country, setCountry] = useState(initial?.country || '');

  // Sub-Tab 2: Tax Info
  const [ntn, setNtn] = useState(initial?.ntn || initial?.ntnNumber || '');
  const [stn, setStn] = useState(initial?.stn || initial?.strnNumber || '');
  const [cnic, setCnic] = useState(initial?.cnic || '');

  // Sub-Tab 3: Terms
  const [paymentTermsDays, setPaymentTermsDays] = useState<number>(initial?.paymentTermsDays !== undefined ? initial.paymentTermsDays : 0);
  const [creditLimitPkr, setCreditLimitPkr] = useState<number>(initial?.creditLimitPkr !== undefined ? initial.creditLimitPkr : 0);
  const [openingDate, setOpeningDate] = useState(initial?.openingDate || '');
  const [openingBalancePkr, setOpeningBalancePkr] = useState<number>(initial?.openingBalancePkr || 0);
  const [discountPercent, setDiscountPercent] = useState<number>(initial?.discountPercent || 0);
  const [applyCreditLimit, setApplyCreditLimit] = useState<boolean>(initial?.applyCreditLimit ?? false);
  const [isSupplier, setIsSupplier] = useState<boolean>(initial?.isSupplier ?? false);
  const [isFiler, setIsFiler] = useState<boolean>(initial?.isFiler ?? false);

  // Sub-Tab 4: Notes
  const [notes, setNotes] = useState(initial?.notes || '');

  // Sub-Tab 5: Additional Fields
  const [field1, setField1] = useState(initial?.field1 || '');
  const [fieldA, setFieldA] = useState(initial?.fieldA || '');
  const [field2, setField2] = useState(initial?.field2 || '');
  const [fieldB, setFieldB] = useState(initial?.fieldB || '');
  const [field3, setField3] = useState(initial?.field3 || '');
  const [fieldC, setFieldC] = useState(initial?.fieldC || '');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Auto-generate account number on initial load if empty
  useEffect(() => {
    if (!accountNumber) {
      const prefix = isSales ? 'CUST' : 'SUPP';
      setAccountNumber(`${prefix}-${Math.floor(1000 + Math.random() * 9000)}`);
    }
  }, [accountNumber, isSales]);

  // Sync composite display name
  const displayName = useMemo(() => {
    const combinedPerson = `${firstName} ${lastName}`.trim();
    if (businessName.trim() && combinedPerson) {
      return `${businessName.trim()} (${combinedPerson})`;
    }
    return businessName.trim() || combinedPerson || (initial?.name || 'Unnamed Account');
  }, [businessName, firstName, lastName, initial?.name]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError('');

    const finalName = businessName.trim() || `${firstName} ${lastName}`.trim() || 'New Account';
    if (!finalName) {
      setError('Please provide at least a Business Name or Contact Person Name.');
      return;
    }

    setBusy(true);
    try {
      const partyId = initial?.id || crypto.randomUUID();
      const payload: PartyData = {
        id: partyId,
        name: displayName,
        businessName: businessName.trim(),
        companyName: businessName.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        mobileNumber: mobileNumber.trim(),
        phone: phone.trim() || mobileNumber.trim(),
        accountNumber: accountNumber.trim(),
        code: accountNumber.trim(),
        website: website.trim(),

        billingAddress: billingAddress.trim(),
        address: billingAddress.trim(),
        city: city.trim(),
        province: province.trim(),
        postalCode: postalCode.trim(),
        country: country.trim(),

        ntn: ntn.trim(),
        ntnNumber: ntn.trim(),
        stn: stn.trim(),
        strnNumber: stn.trim(),
        cnic: cnic.trim(),
        isFiler,

        paymentTermsDays: Number(paymentTermsDays) || 0,
        creditLimitPkr: Number(creditLimitPkr) || 0,
        openingDate,
        openingBalancePkr: Number(openingBalancePkr) || 0,
        discountPercent: Number(discountPercent) || 0,
        applyCreditLimit,
        isSupplier,

        notes: notes.trim(),

        field1,
        fieldA: fieldA.trim(),
        field2,
        fieldB: fieldB.trim(),
        field3,
        fieldC: fieldC.trim(),

        createdAt: initial?.createdAt || new Date().toISOString(),
        currentBalancePkr: initial?.currentBalancePkr || Number(openingBalancePkr) || 0,
        currentPayableBalancePkr: initial?.currentPayableBalancePkr || Number(openingBalancePkr) || 0,
      };

      const endpoint = isSales ? '/api/erp/customers' : '/api/erp/vendors';
      await api(endpoint, 'POST', payload);

      onSaved(payload);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save account details.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[170] bg-black/85 backdrop-blur-sm overflow-y-auto p-2 sm:p-4 flex items-start justify-center">
      <form
        onSubmit={handleSubmit}
        className="my-3 sm:my-6 bg-slate-900 text-slate-200 border border-white/15 rounded-3xl p-6 lg:p-8 w-full max-w-[97vw] xl:max-w-[1450px] 2xl:max-w-[1600px] space-y-6 shadow-2xl animate-in zoom-in-95 duration-150"
      >
        {/* Modal Top Header */}
        <div className="flex justify-between items-start border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                  isSales
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                }`}
              >
                {isSales ? 'Customer Master Account' : 'Supplier / Vendor Account'}
              </span>
              <span className="text-xs text-slate-400">· Comprehensive Profile</span>
            </div>
            <h2 className="text-2xl font-black text-white mt-1">
              {initial ? `Edit ${isSales ? 'Customer' : 'Supplier'}: ${displayName}` : `Add New ${isSales ? 'Customer' : 'Supplier'}`}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Configure billing terms, tax filings, credit allowances, addresses, and custom profile attributes.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close party modal"
            className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-lg transition-colors"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-950/80 border border-red-500/40 text-red-200 rounded-xl text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Notice</p>
              <p className="text-xs text-red-300 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* PRIMARY TOP FIELDS: Business Name, First Name, Last Name, Email, Mobile, Phone, Account #, Website */}
        <div className="bg-slate-950/70 p-5 rounded-2xl border border-white/5 space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Business Name */}
            <div className="lg:col-span-2">
              <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-amber-400" />
                Business Name / Company Name *
              </label>
              <input
                type="text"
                placeholder={isSales ? 'e.g. Apex Cyber Lounge / Tech Systems' : 'e.g. Global Tech Distributors Pakistan'}
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-sm text-white focus:border-amber-500 focus:outline-none"
              />
            </div>

            {/* First Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                First Name
              </label>
              <input
                type="text"
                placeholder="e.g. Hammad"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-sm text-white focus:border-amber-500 focus:outline-none"
              />
            </div>

            {/* Last Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                Last Name
              </label>
              <input
                type="text"
                placeholder="e.g. Ur Rehman"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-sm text-white focus:border-amber-500 focus:outline-none"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                Email Address
              </label>
              <input
                type="email"
                placeholder="e.g. accounts@apexstore.pk"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-sm text-white focus:border-amber-500 focus:outline-none"
              />
            </div>

            {/* Mobile Number */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                Mobile Number (WhatsApp)
              </label>
              <input
                type="text"
                placeholder="e.g. +92 300 1234567"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-sm text-white focus:border-amber-500 focus:outline-none"
              />
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                Landline / Office Phone
              </label>
              <input
                type="text"
                placeholder="e.g. +92 42 35712345"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-sm text-white focus:border-amber-500 focus:outline-none"
              />
            </div>

            {/* Account Number */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-amber-400" />
                Account / Ledger Code #
              </label>
              <input
                type="text"
                placeholder="e.g. CUST-1049"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-sm text-amber-300 font-mono font-bold focus:border-amber-500 focus:outline-none"
              />
            </div>

            {/* Website */}
            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-blue-400" />
                Website URL
              </label>
              <input
                type="text"
                placeholder="e.g. https://www.techdistributors.pk"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-sm text-white focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* SUB-TABS NAVIGATION: Address, Terms, Notes, Additional Fields */}
        <div className="flex gap-2 overflow-x-auto border-b border-white/10 pb-2">
          {[
            { id: 'address', label: 'Address', icon: MapPin },
            { id: 'terms', label: 'Terms', icon: CreditCard },
            { id: 'notes', label: 'Notes', icon: FileText },
            { id: 'additional', label: 'Additional Fields', icon: Sliders },
          ].map((tab) => {
            const Icon = tab.icon;
            const isCurrent = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as PartySubTab)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                  isCurrent
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* SUB-TAB 1: ADDRESS (Billing Address, City, Province, Postal Code, Country) */}
        {activeTab === 'address' && (
          <div className="space-y-4 bg-slate-950/50 p-5 rounded-2xl border border-white/5 animate-in fade-in duration-150">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 text-amber-400" />
              Address & Billing Location
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Billing Address (Street, Floor, Shop / Suite) *</label>
              <textarea
                rows={2}
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
                placeholder="e.g. Shop 12-A, 3rd Floor, Hafeez Center, Gulberg III, Lahore"
                className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-xs text-white focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">City *</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Lahore, Karachi, Islamabad"
                  className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-sm text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Province / State *</label>
                <select
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-xs text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="">Select Province / State</option>
                  {PAKISTAN_PROVINCES.map((prov) => (
                    <option key={prov} value={prov}>
                      {prov}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Postal Code</label>
                <input
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="e.g. 54000"
                  className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-sm text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Country</label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-sm text-white focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* SUB-TAB 2: TERMS (Payment Term Days, Credit Limit, Opening Date, Opening Balance, Discount + Checkboxes) */}
        {activeTab === 'terms' && (
          <div className="space-y-5 bg-slate-950/50 p-5 rounded-2xl border border-white/5 animate-in fade-in duration-150">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-amber-400" />
              Financial Terms, Credit Envelope & Opening Balances
            </h3>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Payment Term Days</label>
                <div className="flex gap-2">
                  <select
                    value={[0, 7, 15, 30, 45, 60, 90].includes(paymentTermsDays) ? paymentTermsDays : 'custom'}
                    onChange={(e) => {
                      if (e.target.value !== 'custom') setPaymentTermsDays(Number(e.target.value));
                    }}
                    className="w-1/2 p-2.5 bg-slate-900 border border-white/10 rounded-xl text-xs text-white focus:border-amber-500 focus:outline-none"
                  >
                    <option value={0}>0 Days (Cash/Immediate)</option>
                    <option value={7}>7 Days Credit</option>
                    <option value={15}>15 Days Credit</option>
                    <option value={30}>30 Days Credit</option>
                    <option value={45}>45 Days Credit</option>
                    <option value={60}>60 Days Credit</option>
                    <option value={90}>90 Days Credit</option>
                    <option value="custom">Custom</option>
                  </select>
                  <input
                    type="number"
                    min="0"
                    value={paymentTermsDays}
                    onChange={(e) => setPaymentTermsDays(Number(e.target.value))}
                    className="w-1/2 p-2.5 bg-slate-900 border border-white/10 rounded-xl text-sm text-center text-white focus:border-amber-500 focus:outline-none"
                    placeholder="Days"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Credit Limit (PKR)</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={creditLimitPkr}
                  onChange={(e) => setCreditLimitPkr(Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-sm text-amber-300 font-bold focus:border-amber-500 focus:outline-none"
                  placeholder="e.g. 500000"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Discount (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-sm text-white focus:border-amber-500 focus:outline-none"
                  placeholder="e.g. 5%"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Opening Date</label>
                <input
                  type="date"
                  value={openingDate}
                  onChange={(e) => setOpeningDate(e.target.value)}
                  className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-sm text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Opening Balance</label>
                <input
                  type="number"
                  step="0.01"
                  value={openingBalancePkr}
                  onChange={(e) => setOpeningBalancePkr(Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-sm text-white font-bold focus:border-amber-500 focus:outline-none"
                  placeholder="0.00"
                />
                <span className="text-[11px] text-slate-500">Opening balance (PKR)</span>
              </div>
            </div>

            {/* Checkboxes: Apply Credit Limit, Supplier, Filer */}
            <div className="pt-3 border-t border-white/10 grid sm:grid-cols-3 gap-4">
              <label className="flex items-center gap-3 p-3 bg-slate-900 rounded-xl border border-white/5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={applyCreditLimit}
                  onChange={(e) => setApplyCreditLimit(e.target.checked)}
                  className="w-5 h-5 rounded accent-amber-500 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-white block">Apply Credit Limit</span>
                  <span className="text-[11px] text-slate-400">Enforce max credit threshold</span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-slate-900 rounded-xl border border-white/5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isSupplier}
                  onChange={(e) => setIsSupplier(e.target.checked)}
                  className="w-5 h-5 rounded accent-amber-500 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-white block">Supplier</span>
                  <span className="text-[11px] text-slate-400">Mark as supplier/vendor account</span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-slate-900 rounded-xl border border-white/5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isFiler}
                  onChange={(e) => setIsFiler(e.target.checked)}
                  className="w-5 h-5 rounded accent-amber-500 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-white block">Filer</span>
                  <span className="text-[11px] text-slate-400">Active tax filer status</span>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* SUB-TAB 4: NOTES (Big Text Field) */}
        {activeTab === 'notes' && (
          <div className="space-y-4 bg-slate-950/50 p-5 rounded-2xl border border-white/5 animate-in fade-in duration-150">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400" />
              General Notes & Relationship History
            </h3>
            <p className="text-xs text-slate-400">
              Record specific agreements, vendor payment terms, warranty terms, bank accounts, or special dispatch instructions.
            </p>
            <textarea
              rows={8}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Official distributor for ASUS and Corsair components in Pakistan. Delivers twice a week to Hafeez Center outlet. Contact person available between 11 AM and 8 PM..."
              className="w-full p-4 bg-slate-900 border border-white/10 rounded-2xl text-xs text-slate-200 focus:border-amber-500 focus:outline-none leading-relaxed"
            />
          </div>
        )}

        {/* SUB-TAB 5: ADDITIONAL FIELDS (Field 1, Field A, Field 2, Field B, Field 3, Field C) */}
        {activeTab === 'additional' && (
          <div className="space-y-5 bg-slate-950/50 p-5 rounded-2xl border border-white/5 animate-in fade-in duration-150">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-400" />
              Custom Attributes & Extended Metadata
            </h3>
            <p className="text-xs text-slate-400">
              Configure specialized classification dropdowns and custom text attributes.
            </p>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Section 1: Field 1 (Dropdown) & Field A (Text box) */}
              <div className="p-4 bg-slate-900 rounded-xl border border-white/5 space-y-3">
                <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">Classification & Channel</div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Field 1 (Category / Channel Dropdown)</label>
                  <select
                    value={field1}
                    onChange={(e) => setField1(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-amber-500 focus:outline-none"
                  >
                    <option value="">Select Channel / Category</option>
                    {FIELD1_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Field A (Custom Text Tag)</label>
                  <input
                    type="text"
                    placeholder="e.g. Lahore-Central-Zone / VIP Tier 1"
                    value={fieldA}
                    onChange={(e) => setFieldA(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Section 2: Field 2 (Dropdown) & Field B (Text box) */}
              <div className="p-4 bg-slate-900 rounded-xl border border-white/5 space-y-3">
                <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Payment & Banking Preferences</div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Field 2 (Preferred Payment Dropdown)</label>
                  <select
                    value={field2}
                    onChange={(e) => setField2(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-amber-500 focus:outline-none"
                  >
                    <option value="">Select Payment Preference</option>
                    {FIELD2_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Field B (Banking Details / IBAN)</label>
                  <input
                    type="text"
                    placeholder="e.g. Meezan Bank PK12MEZN0001234567890123"
                    value={fieldB}
                    onChange={(e) => setFieldB(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Section 3: Field 3 (Dropdown) & Field C (Text box) */}
              <div className="p-4 bg-slate-900 rounded-xl border border-white/5 space-y-3 md:col-span-2">
                <div className="text-xs font-bold text-blue-400 uppercase tracking-wider">Logistics & Delivery Routing</div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Field 3 (Preferred Dispatch / Courier Dropdown)</label>
                    <select
                      value={field3}
                      onChange={(e) => setField3(e.target.value)}
                      className="w-full p-2.5 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-amber-500 focus:outline-none"
                    >
                      <option value="">Select Dispatch / Courier</option>
                      {FIELD3_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Field C (Tracking / Route / Priority Code)</label>
                    <input
                      type="text"
                      placeholder="e.g. Express Courier Priority · Gate 2 Delivery"
                      value={fieldC}
                      onChange={(e) => setFieldC(e.target.value)}
                      className="w-full p-2.5 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Bottom Action Bar */}
        <div className="flex justify-between items-center pt-2 border-t border-white/10">
          <div className="text-xs text-slate-400">
            Account will be saved to <span className="text-amber-300 font-semibold">{isSales ? 'Customers Directory' : 'Suppliers Directory'}</span> and immediately available for invoices and bills.
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all shadow-lg shadow-amber-500/20 disabled:opacity-40 flex items-center gap-2"
            >
              {busy ? (
                'Saving Profile…'
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Save {isSales ? 'Customer' : 'Supplier'} Profile
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
