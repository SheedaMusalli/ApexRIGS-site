import React, { useState } from 'react';
import { X, CheckCircle2, Shield, Truck, CreditCard, Building, MessageSquare, AlertCircle, ShoppingCart, Upload, Image as ImageIcon, Loader2, Check, FileCheck, ExternalLink } from 'lucide-react';
import { CartItem, UserAccount, StoreSettings, Order } from '../types';
import { formatPkr } from '../utils/formatters';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  currentUser: UserAccount | null;
  storeSettings: StoreSettings;
  onOrderSuccess: (order: Order) => void;
  onOpenTracking?: (trackNo?: string, courierCode?: string) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  items,
  currentUser,
  storeSettings,
  onOrderSuccess,
  onOpenTracking,
}) => {
  const [formData, setFormData] = useState({
    fullName: currentUser?.fullName || '',
    email: currentUser?.email || '',
    phone: currentUser?.phone || '',
    city: currentUser?.city || 'Lahore',
    address: currentUser?.address || '',
    notes: '',
  });

  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'bank_transfer'>('cod');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [saveToAccount, setSaveToAccount] = useState(true);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [receiptUploadError, setReceiptUploadError] = useState<string | null>(null);
  const [receiptUploadSuccess, setReceiptUploadSuccess] = useState(false);

  React.useEffect(() => {
    if (currentUser) {
      setFormData((prev) => ({
        ...prev,
        fullName: currentUser.fullName || prev.fullName,
        email: currentUser.email || prev.email,
        phone: currentUser.phone || prev.phone,
        city: currentUser.city || prev.city || 'Lahore',
        address: currentUser.address || prev.address,
      }));
    }
  }, [currentUser, isOpen]);

  if (!isOpen) return null;

  const subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const shippingFee = subtotal >= (storeSettings.freeShippingThreshold || 100000) ? 0 : (storeSettings.defaultShippingFee || 1500);
  const grandTotal = subtotal + shippingFee;

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim() || !formData.phone.trim() || !formData.address.trim() || !formData.city.trim()) {
      setErrorMessage('Please fill in your full name, phone number, city, and complete delivery address.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // If user is logged in and opted to keep profile synced with any changes made at checkout
      if (currentUser && saveToAccount) {
        fetch('/api/auth/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: currentUser.id,
            email: currentUser.email,
            fullName: formData.fullName.trim(),
            phone: formData.phone.trim(),
            city: formData.city.trim(),
            address: formData.address.trim(),
          }),
        }).catch(() => {});
      }

      const orderPayload = {
        customer: {
          fullName: formData.fullName.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          city: formData.city.trim(),
          address: formData.address.trim(),
          notes: formData.notes.trim(),
        },
        items,
        subtotal,
        shippingFee,
        total: grandTotal,
        paymentMethod: paymentMethod === 'cod' ? 'Cash on Delivery (COD)' : 'Direct Bank Transfer',
        status: 'Pending',
        userId: currentUser?.id,
        source: 'Website',
      };

      const token = localStorage.getItem('apex_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers,
        body: JSON.stringify(orderPayload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to place order. Please try again.');
      }

      const savedOrder: Order = await res.json();
      setCreatedOrder(savedOrder);
      onOrderSuccess(savedOrder);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error processing your order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWhatsAppConfirm = () => {
    if (!createdOrder) return;
    const cleanNum = storeSettings.whatsappNumber.replace(/[^0-9]/g, '');
    const msg = encodeURIComponent(
      `*ORDER CONFIRMATION - APEXRIG PC*\n\n` +
      `*Order ID:* ${createdOrder.orderNumber || createdOrder.id}\n` +
      `*Customer:* ${createdOrder.customer.fullName} (${createdOrder.customer.phone})\n` +
      `*Delivery City:* ${createdOrder.customer.city}\n` +
      `*Total Amount:* ${formatPkr(createdOrder.total)}\n` +
      `*Payment:* ${createdOrder.paymentMethod}\n\n` +
      `Please verify and start order dispatch.`
    );
    window.open(`https://wa.me/${cleanNum}?text=${msg}`, '_blank');
  };

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !createdOrder) return;

    if (!file.type.startsWith('image/')) {
      setReceiptUploadError('Please select a valid image file (PNG, JPG, JPEG, WebP).');
      return;
    }

    setIsUploadingReceipt(true);
    setReceiptUploadError(null);
    setReceiptUploadSuccess(false);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result as string;
          const token = localStorage.getItem('apex_token');
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }

          const res = await fetch(`/api/orders/${createdOrder.id}/payment-receipt`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ paymentScreenshot: base64Data }),
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || 'Failed to upload payment receipt.');
          }

          const data = await res.json();
          const updatedOrder: Order = data.order || {
            ...createdOrder,
            paymentScreenshot: base64Data,
            paymentScreenshotUploadedAt: new Date().toISOString(),
          };

          setCreatedOrder(updatedOrder);
          onOrderSuccess(updatedOrder);
          setReceiptUploadSuccess(true);
        } catch (uploadErr: any) {
          setReceiptUploadError(uploadErr.message || 'Error uploading payment screenshot.');
        } finally {
          setIsUploadingReceipt(false);
        }
      };

      reader.onerror = () => {
        setReceiptUploadError('Failed to read image file.');
        setIsUploadingReceipt(false);
      };

      reader.readAsDataURL(file);
    } catch (err: any) {
      setReceiptUploadError(err.message || 'Error processing image.');
      setIsUploadingReceipt(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white">
              {createdOrder ? 'Order Placed Successfully!' : 'Secure Order Checkout'}
            </h2>
            <p className="text-xs text-slate-400">
              {createdOrder
                ? 'Thank you for choosing ApexRig PC Store.'
                : 'Fast, insured nationwide delivery across Pakistan'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success View */}
        {createdOrder ? (
          <div className="p-6 sm:p-8 text-center space-y-5 max-h-[85vh] overflow-y-auto custom-scrollbar">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto ring-8 ring-emerald-500/10">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xl font-black text-white">
                Order #{createdOrder.orderNumber || createdOrder.id.slice(0, 8)}
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
                We have received your order. Our team in Hafeez Centre Lahore is preparing components for dispatch.
              </p>
            </div>

            {/* Order Summary Snapshot */}
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 max-w-md mx-auto text-left text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Customer:</span>
                <span className="text-white font-medium">{createdOrder.customer.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Contact:</span>
                <span className="text-white font-medium">{createdOrder.customer.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Destination:</span>
                <span className="text-white font-medium">{createdOrder.customer.city}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Bill:</span>
                <span className="text-emerald-400 font-bold">{formatPkr(createdOrder.total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Payment:</span>
                <span className="text-slate-200">{createdOrder.paymentMethod}</span>
              </div>
            </div>

            {/* Bank Transfer Details Box */}
            {paymentMethod === 'bank_transfer' && storeSettings.bankDetails && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 max-w-md mx-auto text-left text-xs text-amber-200 space-y-1">
                <p className="font-semibold text-amber-300">Bank Transfer Details:</p>
                <p>Bank: {storeSettings.bankDetails.bankName}</p>
                <p>Account Title: {storeSettings.bankDetails.accountTitle}</p>
                <p className="font-mono font-bold text-amber-100">A/C: {storeSettings.bankDetails.accountNumber}</p>
                {storeSettings.bankDetails.iban && <p className="font-mono text-[11px]">IBAN: {storeSettings.bankDetails.iban}</p>}
              </div>
            )}

            {/* PAYMENT SCREENSHOT UPLOAD SECTION */}
            <div className="bg-slate-950/70 border border-slate-700/80 rounded-2xl p-4 max-w-md mx-auto text-left space-y-3 shadow-lg">
              <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Payment Receipt Verification</span>
                </div>
                {createdOrder.paymentScreenshot && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Attached
                  </span>
                )}
              </div>

              {createdOrder.paymentScreenshot ? (
                <div className="space-y-3">
                  <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl flex items-center gap-3">
                    <img
                      src={createdOrder.paymentScreenshot}
                      alt="Payment Screenshot Receipt"
                      className="w-16 h-16 object-cover rounded-lg border border-emerald-500/40 shrink-0 bg-black/50"
                    />
                    <div className="text-xs space-y-1 min-w-0 flex-1">
                      <p className="text-emerald-300 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        Screenshot Uploaded Successfully
                      </p>
                      <p className="text-[11px] text-slate-300 leading-tight">
                        Your payment receipt has been linked to Order #{createdOrder.orderNumber}.
                      </p>
                      <p className="text-[10px] text-emerald-400/90 font-medium">
                        ✓ Verification fast-tracked without phone delay
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <label className="cursor-pointer text-indigo-400 hover:text-indigo-300 underline font-medium">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleReceiptUpload}
                        disabled={isUploadingReceipt}
                      />
                      {isUploadingReceipt ? 'Uploading new image...' : 'Upload Different Screenshot'}
                    </label>

                    {receiptUploadSuccess && (
                      <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                        <Check className="w-3 h-3" /> Saved!
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Upload a screenshot or photo of your payment receipt (Bank Transfer / EasyPaisa / JazzCash / Deposit Slip) to <strong className="text-emerald-400">automatically verify your order</strong> without extra verification steps.
                  </p>

                  {receiptUploadError && (
                    <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{receiptUploadError}</span>
                    </div>
                  )}

                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 hover:border-emerald-500/70 rounded-xl p-4 cursor-pointer bg-slate-900/60 hover:bg-slate-900 transition-all group">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleReceiptUpload}
                      disabled={isUploadingReceipt}
                    />
                    <div className="w-11 h-11 rounded-full bg-emerald-500/10 group-hover:bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-all">
                      {isUploadingReceipt ? (
                        <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                      ) : (
                        <Upload className="w-5 h-5" />
                      )}
                    </div>
                    <span className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors">
                      {isUploadingReceipt ? 'Uploading Screenshot...' : 'Upload Payment Image / Screenshot'}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5">
                      Click or drop image file (PNG, JPG, JPEG, WebP)
                    </span>
                  </label>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              {onOpenTracking && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenTracking(createdOrder.trackingNumber || createdOrder.orderNumber, createdOrder.courierName);
                  }}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/25 transition-all"
                >
                  <Truck className="w-4 h-4" />
                  Track Live Shipment
                </button>
              )}
              <button
                onClick={handleWhatsAppConfirm}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-lg shadow-emerald-600/30 transition-all"
              >
                <MessageSquare className="w-4 h-4" />
                Notify on WhatsApp
              </button>
              <button
                onClick={onClose}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmitOrder} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Customer & Shipping Details */}
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Truck className="w-4 h-4 text-emerald-400" />
                  1. Delivery Information
                </h3>
                {currentUser && (
                  <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Account Pre-filled
                  </span>
                )}
              </div>

              {currentUser ? (
                <div className="p-2.5 rounded-xl bg-slate-800/80 border border-emerald-500/30 text-xs flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="text-[11px] text-slate-300">
                    <p className="font-semibold text-emerald-300">Delivery details auto-filled from your registered account</p>
                    <p className="text-slate-400">
                      {currentUser.fullName} • {currentUser.phone || 'No phone'} • {currentUser.city || 'Lahore'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-[11px] text-slate-400 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Enter your delivery info below. For 1-click checkout in future, create an account.</span>
                </div>
              )}

              {errorMessage && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="e.g. Muhammad Usman"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="e.g. 0300-1234567"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g. usman@gmail.com (optional)"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">City *</label>
                <input
                  type="text"
                  required
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="e.g. Lahore, Karachi, Islamabad"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Complete Delivery Address *</label>
                <textarea
                  required
                  rows={2}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="e.g. House 14, Street 3, Block D, Model Town"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Order Notes (Optional)</label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="e.g. Call before delivery, deliver after 2 PM"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {currentUser && (
                <label className="flex items-center gap-2 pt-1 cursor-pointer text-xs text-slate-400 hover:text-slate-200 select-none">
                  <input
                    type="checkbox"
                    checked={saveToAccount}
                    onChange={(e) => setSaveToAccount(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Save any updated address changes to my account profile</span>
                </label>
              )}
            </div>

            {/* Right: Payment & Summary */}
            <div className="space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-3">
                  <CreditCard className="w-4 h-4 text-indigo-400" />
                  2. Payment Method
                </h3>

                <div className="space-y-2.5">
                  <label
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      paymentMethod === 'cod'
                        ? 'bg-indigo-600/10 border-indigo-500/50 text-white'
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      checked={paymentMethod === 'cod'}
                      onChange={() => setPaymentMethod('cod')}
                      className="mt-0.5 text-indigo-600"
                    />
                    <div>
                      <span className="text-xs font-bold block text-slate-200">
                        Cash on Delivery (COD)
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Pay cash upon parcel delivery to courier agent.
                      </span>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      paymentMethod === 'bank_transfer'
                        ? 'bg-indigo-600/10 border-indigo-500/50 text-white'
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      checked={paymentMethod === 'bank_transfer'}
                      onChange={() => setPaymentMethod('bank_transfer')}
                      className="mt-0.5 text-indigo-600"
                    />
                    <div>
                      <span className="text-xs font-bold block text-slate-200">
                        Direct Bank Transfer / Raast / Meezan
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Fast online bank transfer to official store account.
                      </span>
                    </div>
                  </label>
                </div>

                {/* Items Summary */}
                <div className="mt-5 bg-slate-800/50 border border-slate-700/60 rounded-xl p-3.5 space-y-2 text-xs">
                  <span className="font-semibold text-slate-300 block mb-1">
                    Order Items ({items.length})
                  </span>
                  <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1">
                    {items.map((i) => (
                      <div key={i.id} className="flex justify-between items-center text-slate-300">
                        <span className="truncate max-w-[200px]">
                          {i.quantity}x {i.name}
                        </span>
                        <span className="font-medium text-slate-200">
                          {formatPkr(i.price * i.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-slate-700 space-y-1 text-slate-400">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span className="text-slate-200">{formatPkr(subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Nationwide Shipping</span>
                      <span className={shippingFee === 0 ? 'text-emerald-400 font-semibold' : 'text-slate-200'}>
                        {shippingFee === 0 ? 'FREE' : formatPkr(shippingFee)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm font-black text-white pt-1 border-t border-slate-700">
                      <span>Grand Total</span>
                      <span className="text-emerald-400">{formatPkr(grandTotal)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-sm shadow-xl shadow-emerald-600/30 transition-all hover:scale-[1.01]"
                >
                  {isSubmitting ? (
                    <span>Placing Order...</span>
                  ) : (
                    <span>Confirm & Place Order ({formatPkr(grandTotal)})</span>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
