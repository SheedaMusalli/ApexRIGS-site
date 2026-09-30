import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  Truck,
  MapPin,
  Clock,
  AlertCircle,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Building2,
  Navigation,
  ShieldCheck,
  Phone,
  Globe,
  Package,
  Calendar,
  Layers,
  Printer,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Share2,
  FileText,
  UserCheck,
  Download,
  Lock,
} from 'lucide-react';
import {
  PAKISTAN_TRACK123_COURIERS,
  CourierProvider,
  detectCourierFromTrackingNumber,
  Track123QueryResult,
  Track123Checkpoint,
} from '../services/track123';
import { formatPkr, formatDateTime } from '../utils/formatters';
import { generateOrderInvoicePdf } from '../utils/generateInvoicePdf';
import { Order } from '../types';

interface TrackOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTrackingNumber?: string;
  initialCourierCode?: string;
}

export const TrackOrderModal: React.FC<TrackOrderModalProps> = ({
  isOpen,
  onClose,
  initialTrackingNumber = '',
  initialCourierCode = 'auto',
}) => {
  const [trackNumber, setTrackNumber] = useState<string>(initialTrackingNumber);
  const [selectedCourier, setSelectedCourier] = useState<string>(initialCourierCode || 'auto');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<Track123QueryResult | null>(null);
  const [matchedOrder, setMatchedOrder] = useState<Order | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [copiedReport, setCopiedReport] = useState<boolean>(false);
  const [checkpointSearch, setCheckpointSearch] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  // Sync initial props
  useEffect(() => {
    if (isOpen) {
      if (initialTrackingNumber) {
        setTrackNumber(initialTrackingNumber);
        if (initialCourierCode && initialCourierCode !== 'auto') {
          setSelectedCourier(initialCourierCode);
        } else {
          const detected = detectCourierFromTrackingNumber(initialTrackingNumber);
          setSelectedCourier(detected.code);
        }
        handleTrackShipment(initialTrackingNumber, initialCourierCode || 'auto');
      } else {
        setErrorMessage(null);
      }
    }
  }, [isOpen, initialTrackingNumber, initialCourierCode]);

  const currentCourierObj: CourierProvider =
    PAKISTAN_TRACK123_COURIERS.find((c) => c.code === selectedCourier) || PAKISTAN_TRACK123_COURIERS[0];

  const handleTrackShipment = async (
    overrideTrackNo?: string,
    overrideCourier?: string
  ) => {
    const queryNo = (overrideTrackNo !== undefined ? overrideTrackNo : trackNumber).trim();
    const queryCourier = overrideCourier !== undefined ? overrideCourier : selectedCourier;

    if (!queryNo) {
      setErrorMessage('Please enter a tracking number, consignment code, or Order ID.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setResult(null);
    setMatchedOrder(null);

    try {
      const url = `/api/tracking/live?trackNo=${encodeURIComponent(queryNo)}&courierCode=${encodeURIComponent(queryCourier)}`;

      const res = await fetch(url);
      const data = await res.json();

      if (res.ok && data.success && data.tracking) {
        setResult({
          success: true,
          tracking: data.tracking,
        });
        if (data.order) {
          setMatchedOrder(data.order);
        }
      } else {
        setErrorMessage(data.error || 'No live tracking records found for this tracking code. Please verify the consignment number and selected courier.');
      }
    } catch (err: any) {
      console.error('Tracking fetch error:', err);
      setErrorMessage(err?.message || 'Network error occurred while contacting tracking logistics gateway.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = () => {
    const shareUrl = `${window.location.origin}?track=${encodeURIComponent(trackNumber)}&courier=${encodeURIComponent(selectedCourier)}`;
    navigator.clipboard?.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleCopyFullReport = () => {
    if (!result?.tracking) return;
    const t = result.tracking;
    const lines = [
      `📦 APEXRIG CONSIGNMENT TRACKING REPORT`,
      `Tracking Number: ${t.trackingNumber}`,
      `Carrier: ${t.courierName}`,
      `Current Status: ${t.transitStatusDisplay || t.transitStatus}`,
      `Origin: ${t.originCity || 'N/A'}`,
      `Destination: ${t.destinationCity || 'N/A'}`,
      `Service: ${t.serviceType || 'Standard Express'}`,
      `Weight: ${t.weight || 'N/A'}`,
      `Latest Event: ${t.latestEvent || 'N/A'}`,
      `Last Updated: ${t.lastUpdated ? formatDateTime(t.lastUpdated) : 'Live'}`,
      ``,
      `--- CHECKPOINT LOG (${t.checkpoints?.length || 0} scans) ---`,
      ...(t.checkpoints || []).map(
        (cp) => `• [${formatDateTime(cp.time)}] ${cp.status} - ${cp.location || cp.city || ''} ${cp.details ? `(${cp.details})` : ''}`
      ),
    ];
    navigator.clipboard?.writeText(lines.join('\n'));
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  const getStatusBadge = (status?: string) => {
    switch ((status || '').toUpperCase()) {
      case 'DELIVERED':
        return {
          label: 'Delivered Successfully',
          bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
          dot: 'bg-emerald-400',
          step: 5,
        };
      case 'OUT_FOR_DELIVERY':
        return {
          label: 'Out for Delivery (Final Mile)',
          bg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
          dot: 'bg-cyan-400',
          step: 4,
        };
      case 'IN_TRANSIT':
        return {
          label: 'In Transit & Sorting Hub',
          bg: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
          dot: 'bg-blue-400',
          step: 3,
        };
      case 'PICKED_UP':
        return {
          label: 'Picked Up by Carrier',
          bg: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
          dot: 'bg-indigo-400',
          step: 2,
        };
      case 'PENDING_PICKUP':
      default:
        return {
          label: 'Booked / Manifest Created',
          bg: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          dot: 'bg-amber-400',
          step: 1,
        };
    }
  };

  const currentStatusInfo = getStatusBadge(result?.tracking?.transitStatus);

  const officialCarrierPortalUrl =
    result?.tracking?.directTrackingUrl ||
    (currentCourierObj.directTrackingUrl ? currentCourierObj.directTrackingUrl(trackNumber) : `https://www.track123.com/tracking?nums=${encodeURIComponent(trackNumber)}`);

  // Filtered and sorted checkpoints
  const displayedCheckpoints = useMemo(() => {
    if (!result?.tracking?.checkpoints) return [];
    let list = [...result.tracking.checkpoints];
    if (checkpointSearch.trim()) {
      const q = checkpointSearch.toLowerCase();
      list = list.filter(
        (cp) =>
          cp.status.toLowerCase().includes(q) ||
          (cp.location && cp.location.toLowerCase().includes(q)) ||
          (cp.city && cp.city.toLowerCase().includes(q)) ||
          (cp.details && cp.details.toLowerCase().includes(q))
      );
    }
    if (sortOrder === 'oldest') {
      list.reverse();
    }
    return list;
  }, [result?.tracking?.checkpoints, checkpointSearch, sortOrder]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden print:m-0 print:border-none print:shadow-none print:max-w-none print:w-full">
        {/* Modal Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/90 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Logistics & Shipment Details
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Live Logistics Scans
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  🇵🇰 Pakistan Real-Time
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Detailed consignment checkpoints, parcel telemetry, and milestone tracking
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/60 hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6 custom-scrollbar">
          {/* Tracking Search Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleTrackShipment();
            }}
            className="space-y-3 bg-slate-950/70 p-4 rounded-2xl border border-slate-800/90 print:hidden shadow-inner"
          >
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              {/* Courier Selection Dropdown */}
              <div className="sm:col-span-5 space-y-1">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                  Courier Provider
                </label>
                <div className="relative">
                  <select
                    value={selectedCourier}
                    onChange={(e) => {
                      setSelectedCourier(e.target.value);
                      if (result) setResult(null);
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 font-semibold focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer appearance-none pr-8"
                  >
                    {PAKISTAN_TRACK123_COURIERS.map((courier) => (
                      <option key={courier.code} value={courier.code}>
                        {courier.name}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                      <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Tracking Number Input */}
              <div className="sm:col-span-7 space-y-1">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                  Tracking Number / Consignment Code (CN)
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      required
                      value={trackNumber}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTrackNumber(val);
                        if (selectedCourier === 'auto' && val.trim().length >= 3) {
                          const detected = detectCourierFromTrackingNumber(val);
                          if (detected.code !== 'auto') {
                            setSelectedCourier(detected.code);
                          }
                        }
                      }}
                      placeholder={currentCourierObj.placeholder || 'Tracking number or order ID (e.g. LCS-1001-PK)'}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500"
                    />
                    {trackNumber && (
                      <button
                        type="button"
                        onClick={() => {
                          setTrackNumber('');
                          setResult(null);
                          setErrorMessage(null);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || !trackNumber.trim()}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold text-xs shadow-lg shadow-indigo-600/25 disabled:opacity-50 flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                  >
                    {isLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    <span>{isLoading ? 'Searching...' : 'Track'}</span>
                  </button>
                </div>
              </div>
            </div>
          </form>

          {/* Error Feedback */}
          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Consignment Lookup Notice</p>
                <p className="text-rose-300/80 mt-0.5">{errorMessage}</p>
                <div className="mt-3 flex items-center gap-2">
                  <a
                    href={officialCarrierPortalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 text-xs font-bold transition-colors"
                  >
                    <span>Verify directly on {currentCourierObj.shortName}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Live Tracking Result View */}
          {result?.tracking && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Executive Status Header Card */}
              <div className="p-5 sm:p-6 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-5 shadow-xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-mono text-lg sm:text-xl font-black text-white tracking-wider">
                        {result.tracking.trackingNumber}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${currentStatusInfo.bg}`}>
                        <span className={`w-2 h-2 rounded-full animate-pulse ${currentStatusInfo.dot}`} />
                        {result.tracking.transitStatusDisplay || currentStatusInfo.label}
                      </span>
                      {result.tracking.isLiveApi && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-emerald-400" />
                          Live Carrier API Scans
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-2 flex-wrap">
                      <span className="font-bold text-slate-200 flex items-center gap-1">
                        <Truck className="w-3.5 h-3.5 text-indigo-400" />
                        {result.tracking.courierName}
                      </span>
                      {result.tracking.carrierPhone && (
                        <span>• Helpline: <strong className="text-slate-300">{result.tracking.carrierPhone}</strong></span>
                      )}
                      {result.tracking.lastUpdated && (
                        <span>• Updated: <span className="font-mono text-slate-300">{formatDateTime(result.tracking.lastUpdated)}</span></span>
                      )}
                    </div>
                  </div>

                  {/* Actions Toolbar */}
                  <div className="flex items-center gap-2 flex-wrap print:hidden">
                    <button
                      onClick={handleCopyFullReport}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700 cursor-pointer"
                      title="Copy Full Detailed Tracking Report"
                    >
                      {copiedReport ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <FileText className="w-3.5 h-3.5" />}
                      <span>{copiedReport ? 'Report Copied!' : 'Copy Scans'}</span>
                    </button>

                    <button
                      onClick={handleCopyLink}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700 cursor-pointer"
                      title="Copy Direct Tracking Link"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Link Copied!' : 'Share'}</span>
                    </button>

                    <button
                      onClick={handlePrint}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700 cursor-pointer"
                      title="Print Consignment Sheet"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-300" />
                      <span>Print</span>
                    </button>
                  </div>
                </div>

                {/* 5-Phase Interactive Visual Stepper */}
                <div className="pt-2 pb-1">
                  <div className="relative flex items-center justify-between">
                    {/* Background track line */}
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-800 rounded-full" />
                    {/* Active progress line */}
                    <div
                      className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-gradient-to-r from-indigo-500 via-cyan-500 to-emerald-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${((currentStatusInfo.step - 1) / 4) * 100}%`,
                      }}
                    />

                    {/* Step Nodes */}
                    {[
                      { num: 1, name: 'Manifest Created', short: 'Booked' },
                      { num: 2, name: 'Courier Pickup', short: 'Picked Up' },
                      { num: 3, name: 'Linehaul Transit', short: 'In Transit' },
                      { num: 4, name: 'Out for Delivery', short: 'Final Mile' },
                      { num: 5, name: 'Delivered', short: 'Delivered' },
                    ].map((step) => {
                      const isComplete = currentStatusInfo.step > step.num;
                      const isCurrent = currentStatusInfo.step === step.num;
                      return (
                        <div key={step.num} className="relative z-10 flex flex-col items-center">
                          <div
                            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-md ${
                              isComplete
                                ? 'bg-emerald-500 text-slate-950 ring-4 ring-emerald-500/20'
                                : isCurrent
                                ? 'bg-indigo-600 text-white ring-4 ring-indigo-500/30 scale-110'
                                : 'bg-slate-900 border border-slate-700 text-slate-500'
                            }`}
                          >
                            {isComplete ? <Check className="w-4 h-4 stroke-[3]" /> : step.num}
                          </div>
                          <span
                            className={`text-[10px] sm:text-[11px] font-bold mt-2 text-center whitespace-nowrap ${
                              isCurrent
                                ? 'text-indigo-300 font-extrabold'
                                : isComplete
                                ? 'text-emerald-400'
                                : 'text-slate-500'
                            }`}
                          >
                            {step.short}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Latest Event Banner */}
                {result.tracking.latestEvent && (
                  <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-800/50 flex items-start gap-3 text-xs text-indigo-200">
                    <Navigation className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-indigo-300 uppercase tracking-wider text-[10px] block">
                        Latest Waypoint Scan
                      </span>
                      <p className="text-slate-200 font-medium text-xs mt-0.5">
                        {result.tracking.latestEvent}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Detailed Metrics & Shipment Specifications Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                {/* 1. Origin Station */}
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-[10px] uppercase font-bold tracking-wider">Origin</span>
                  </div>
                  <p className="font-bold text-slate-100 text-xs sm:text-sm truncate">
                    {result.tracking.originCity || 'Apex Logistics, Lahore'}
                  </p>
                  <span className="text-[10px] text-slate-500">Departure Hub</span>
                </div>

                {/* 2. Destination Station */}
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[10px] uppercase font-bold tracking-wider">Destination</span>
                  </div>
                  <p className="font-bold text-emerald-300 text-xs sm:text-sm truncate">
                    {result.tracking.destinationCity || matchedOrder?.customer?.city || 'Pakistan'}
                  </p>
                  <span className="text-[10px] text-slate-500">Delivery Station</span>
                </div>

                {/* 3. Weight & Pieces */}
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Package className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[10px] uppercase font-bold tracking-wider">Weight & Units</span>
                  </div>
                  <p className="font-bold text-slate-100 text-xs sm:text-sm truncate">
                    {result.tracking.weight || '1.85 kg'}
                  </p>
                  <span className="text-[10px] text-slate-500">
                    {result.tracking.pieces ? `${result.tracking.pieces} Parcel Unit(s)` : `${matchedOrder?.items?.length || 1} Box`}
                  </span>
                </div>

                {/* 4. Service Type */}
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Layers className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-[10px] uppercase font-bold tracking-wider">Service Type</span>
                  </div>
                  <p className="font-bold text-slate-100 text-xs sm:text-sm truncate">
                    {result.tracking.serviceType || 'Express Air Cargo'}
                  </p>
                  <span className="text-[10px] text-slate-500">Doorstep Delivery</span>
                </div>

                {/* 5. Pickup / Estimated Date */}
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-[10px] uppercase font-bold tracking-wider">ETA / Delivered</span>
                  </div>
                  <p className="font-bold text-slate-100 text-xs sm:text-sm truncate">
                    {result.tracking.deliveryTime
                      ? formatDateTime(result.tracking.deliveryTime).split(',')[0]
                      : result.tracking.estimatedDelivery || 'In 24 - 48 Hours'}
                  </p>
                  <span className="text-[10px] text-slate-500">
                    {result.tracking.transitStatus === 'DELIVERED' ? 'Completed' : 'Expected Timeline'}
                  </span>
                </div>

                {/* 6. Recipient / Signed By */}
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[10px] uppercase font-bold tracking-wider">Consignee</span>
                  </div>
                  <p className="font-bold text-slate-100 text-xs sm:text-sm truncate">
                    {result.tracking.signedBy || matchedOrder?.customer?.fullName || 'Verified Customer'}
                  </p>
                  <span className="text-[10px] text-slate-500">
                    {result.tracking.signedBy ? 'Signed On Receipt' : 'Authorized Recipient'}
                  </span>
                </div>
              </div>

              {/* Matched Store Order Summary (if found) */}
              {matchedOrder && (
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs space-y-3">
                  <div className="flex items-center justify-between font-bold text-slate-200 pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-400" />
                      <span>Store Order #{matchedOrder.orderNumber || matchedOrder.id.slice(0, 8)}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        (matchedOrder.status || '').toLowerCase() === 'delivered'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        Status: {matchedOrder.status}
                      </span>
                    </div>
                    <span className="text-emerald-400 font-mono text-sm">{formatPkr(matchedOrder.total)}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-400">
                    <div>
                      <span className="text-slate-500 text-[10px] uppercase font-bold block">Delivery Address</span>
                      <p className="text-slate-200 mt-0.5">
                        <strong className="text-white">{matchedOrder.customer.fullName}</strong> ({matchedOrder.customer.phone})
                        <br />
                        {matchedOrder.customer.address}, {matchedOrder.customer.city}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] uppercase font-bold block">Purchased Products</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {matchedOrder.items.map((item, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300 text-[11px]">
                            {item.name} (x{item.quantity})
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Customer Bill Download Access - strictly upon Delivered status */}
                  <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    {(matchedOrder.status || '').toLowerCase() === 'delivered' ? (
                      <div className="flex items-center justify-between w-full">
                        <span className="text-emerald-400 text-[11px] font-semibold flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5" />
                          Order Delivered! Official Bill & Warranty Certificate Unlocked.
                        </span>
                        <button
                          type="button"
                          onClick={() => generateOrderInvoicePdf(matchedOrder)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/30 transition-all hover:scale-[1.02]"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download Official Bill (PDF)</span>
                        </button>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 w-full flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                          <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>
                            <strong>Official Bill of Sale & Warranty Paper:</strong> Accessible for download once order is marked as <span className="text-emerald-400 font-bold">Delivered</span> by the ApexRig owner.
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-medium whitespace-nowrap">
                          {matchedOrder.status}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Detailed Waypoint Scans & Checkpoints Timeline */}
              <div className="space-y-4 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-400" />
                    <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-200">
                      Checkpoint & Transit Log ({result.tracking.checkpoints.length} Scans)
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap print:hidden">
                    {/* Search inside scans */}
                    {result.tracking.checkpoints.length > 3 && (
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                          type="text"
                          value={checkpointSearch}
                          onChange={(e) => setCheckpointSearch(e.target.value)}
                          placeholder="Filter stations..."
                          className="bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-36"
                        />
                      </div>
                    )}

                    {/* Sort Order Toggle */}
                    <button
                      onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 text-[11px] font-semibold hover:bg-slate-700 transition-colors border border-slate-700"
                    >
                      {sortOrder === 'newest' ? '⬇ Newest First' : '⬆ Oldest First'}
                    </button>
                  </div>
                </div>

                {displayedCheckpoints.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 bg-slate-950/40 rounded-2xl border border-slate-800/80">
                    No scans match your search filter.
                  </div>
                ) : (
                  <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2.5 before:bottom-2.5 before:w-0.5 before:bg-slate-800">
                    {displayedCheckpoints.map((cp, idx) => {
                      const isFirst = idx === 0 && sortOrder === 'newest';
                      return (
                        <div key={idx} className="relative group">
                          {/* Timeline node */}
                          <div
                            className={`absolute -left-6 top-1.5 w-3.5 h-3.5 rounded-full border-2 transition-all ${
                              isFirst
                                ? 'bg-emerald-500 border-emerald-300 shadow-lg shadow-emerald-500/50 ring-4 ring-emerald-500/20 scale-110'
                                : 'bg-slate-900 border-slate-700 group-hover:border-indigo-400'
                            }`}
                          />
                          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/90 text-xs space-y-2 hover:border-slate-700 transition-colors shadow-sm">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-slate-100 text-xs sm:text-sm">
                                  {cp.status}
                                </span>
                                {isFirst && (
                                  <span className="px-2 py-0.2 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    Latest Status
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-400 font-mono">
                                {formatDateTime(cp.time)}
                              </span>
                            </div>

                            {/* Location & Station Badges */}
                            <div className="flex items-center gap-2 flex-wrap pt-0.5">
                              {cp.city && (
                                <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-[11px] font-bold flex items-center gap-1">
                                  <MapPin className="w-3 h-3 text-indigo-400" />
                                  <span>{cp.city}</span>
                                </span>
                              )}
                              {cp.location && (
                                <span className="text-slate-300 text-xs font-semibold flex items-center gap-1">
                                  <Building2 className="w-3 h-3 text-slate-400" />
                                  <span>{cp.location}</span>
                                </span>
                              )}
                            </div>

                            {cp.details && (
                              <p className="text-slate-400 text-xs leading-relaxed pt-1 border-t border-slate-900">
                                {cp.details}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/90 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-slate-400 print:hidden">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Pakistan Multi-Carrier Logistics Telemetry & Gateway Sync</span>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={officialCarrierPortalUrl}
              target="_blank"
              rel="noreferrer"
              className="text-indigo-400 hover:text-indigo-300 font-bold hover:underline flex items-center gap-1"
            >
              <span>{currentCourierObj.shortName} Portal</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
