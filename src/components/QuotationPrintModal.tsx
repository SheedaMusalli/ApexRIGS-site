import React from 'react';
import { X, Printer, Download, Cpu, Phone, Mail, MapPin } from 'lucide-react';
import { PCBuildParts, StoreSettings, Product } from '../types';
import { formatPkr } from '../utils/formatters';
import { generateQuotationPdf } from '../utils/generateInvoicePdf';

interface QuotationPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  build: PCBuildParts;
  selectedVariants: Record<string, string>;
  storeSettings: StoreSettings;
}

export const QuotationPrintModal: React.FC<QuotationPrintModalProps> = ({
  isOpen,
  onClose,
  build,
  selectedVariants,
  storeSettings,
}) => {
  if (!isOpen) return null;

  const quoteNumber = `QT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const currentDate = new Date().toLocaleDateString('en-PK', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const activeParts = Object.entries(build as Record<string, Product | undefined | null>).filter(
    (entry): entry is [string, Product] => Boolean(entry[1])
  );

  const total = activeParts.reduce((acc, [_, prod]) => {
    const variantId = selectedVariants[prod.id];
    const variant = prod.variants?.find((v) => v.id === variantId);
    return acc + (variant?.price || prod.price);
  }, 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-4xl bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden my-8 flex flex-col max-h-[92vh]">
        {/* Action Bar (hidden on print) */}
        <div className="print:hidden flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-indigo-400" />
            <span className="font-bold text-sm">Official PC Build Quotation</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => generateQuotationPdf(build, selectedVariants, storeSettings)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-md transition-colors"
              title="Download High-Resolution PDF Quotation"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-md transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Quotation Content */}
        <div id="quotation-print-area" className="p-8 overflow-y-auto print:p-0 print:overflow-visible">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start justify-between pb-6 border-b border-slate-200 gap-4">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">
                {storeSettings.storeName || 'APEXRIG PC & HARDWARE'}
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {storeSettings.tagline || "Pakistan's Premier Custom PC Builder & Hardware Hub"}
              </p>
              <div className="mt-2 text-xs text-slate-600 space-y-0.5">
                <p className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {storeSettings.address || 'Hafeez Centre, Main Boulevard Gulberg III, Lahore'}
                </p>
                <p className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {storeSettings.phone || storeSettings.whatsappNumber}
                </p>
                <p className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  {storeSettings.email || 'bhaiisheeda@gmail.com'}
                </p>
              </div>
            </div>

            <div className="text-right sm:text-right w-full sm:w-auto bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 block">
                QUOTATION
              </span>
              <p className="text-base font-black text-slate-900 mt-1">{quoteNumber}</p>
              <p className="text-xs text-slate-500 mt-1">Date: {currentDate}</p>
              <p className="text-xs text-emerald-600 font-semibold mt-1">Valid for 3 Days</p>
            </div>
          </div>

          {/* Parts Table */}
          <div className="mt-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Itemized Component Specifications
            </h3>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b-2 border-slate-300 bg-slate-100">
                  <th className="py-2.5 px-3 font-semibold text-slate-700 w-12">#</th>
                  <th className="py-2.5 px-3 font-semibold text-slate-700 w-36">Component Category</th>
                  <th className="py-2.5 px-3 font-semibold text-slate-700">Product Description & Specs</th>
                  <th className="py-2.5 px-3 font-semibold text-slate-700 w-24">Warranty</th>
                  <th className="py-2.5 px-3 font-semibold text-slate-700 text-right w-32">Price (PKR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {activeParts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No components added to this build yet.
                    </td>
                  </tr>
                ) : (
                  activeParts.map(([cat, prod], idx) => {
                    const variantId = selectedVariants[prod.id];
                    const variant = prod.variants?.find((v) => v.id === variantId);
                    const itemPrice = variant?.price || prod.price;

                    return (
                      <tr key={cat}>
                        <td className="py-3 px-3 font-medium text-slate-500">{idx + 1}</td>
                        <td className="py-3 px-3 font-semibold text-slate-800">{cat}</td>
                        <td className="py-3 px-3">
                          <p className="font-bold text-slate-900">{prod.name}</p>
                          {variant && (
                            <p className="text-[11px] text-slate-600">
                              Selected: {variant.name} {variant.color ? `(${variant.color})` : ''}
                            </p>
                          )}
                          <p className="text-[10px] text-slate-500 line-clamp-1">{prod.description}</p>
                        </td>
                        <td className="py-3 px-3 text-slate-600 font-medium">
                          {prod.warranty || '1 Year Official'}
                        </td>
                        <td className="py-3 px-3 text-right font-black text-slate-900">
                          {formatPkr(itemPrice)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Totals & Notes */}
          <div className="mt-6 pt-4 border-t-2 border-slate-200 flex flex-col sm:flex-row justify-between items-start gap-6">
            <div className="space-y-2 text-xs text-slate-600 max-w-md">
              <p className="font-bold text-slate-800">Terms & Conditions:</p>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-500">
                <li>Component prices are subject to USD/PKR market fluctuations without prior notice.</li>
                <li>All components include 100% genuine official manufacturer / distributor warranties.</li>
                <li>Custom PC builds include complimentary stress-testing, BIOS update, and cable management.</li>
                <li>Nationwide insured courier delivery available via Leopard / Daewoo Express.</li>
              </ul>
            </div>

            <div className="w-full sm:w-72 bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal ({activeParts.length} parts):</span>
                <span className="font-semibold text-slate-900">{formatPkr(total)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Assembly & Cable Management:</span>
                <span className="font-semibold text-emerald-600">FREE</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Burn-in Thermal Testing:</span>
                <span className="font-semibold text-emerald-600">FREE</span>
              </div>
              <div className="pt-2 border-t border-slate-300 flex justify-between text-sm font-black text-slate-900">
                <span>Total Quotation:</span>
                <span className="text-indigo-600">{formatPkr(total)}</span>
              </div>
            </div>
          </div>

          {/* Footer Signature */}
          <div className="mt-12 pt-6 border-t border-slate-200 flex justify-between items-end text-xs text-slate-500">
            <div>
              <p className="font-semibold text-slate-800">
                {storeSettings.ownerName || 'Hammad Ur Rehman'}
              </p>
              <p>{storeSettings.ownerTitle || 'Store Owner & Lead Hardware Architect'}</p>
              <p>{storeSettings.storeName}</p>
            </div>
            <div className="text-right">
              <div className="w-36 border-b border-slate-400 mb-1"></div>
              <p className="font-semibold text-slate-700">Authorized Signature & Stamp</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
