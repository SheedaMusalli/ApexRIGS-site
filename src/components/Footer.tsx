import React from 'react';
import { Cpu, Phone, Mail, MapPin, Shield, Truck, Clock, Sparkles } from 'lucide-react';
import { StoreSettings } from '../types';

interface FooterProps {
  onOpenBuilder: () => void;
  onOpenAI: () => void;
  onOpenAdmin: () => void;
  onOpenTracking?: () => void;
  storeSettings: StoreSettings;
}

export const Footer: React.FC<FooterProps> = ({
  onOpenBuilder,
  onOpenAI,
  onOpenAdmin,
  onOpenTracking,
  storeSettings,
}) => {
  return (
    <footer className="bg-slate-950 border-t border-slate-800 text-slate-400 text-sm mt-20">
      {/* Value props */}
      <div className="border-b border-slate-900/50 bg-slate-950/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="group flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-900/40 transition-all border border-transparent hover:border-white/5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/5 group-hover:scale-110 transition-transform">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-slate-100 text-sm tracking-tight uppercase">Safe Delivery</p>
                <p className="text-[11px] text-slate-500 font-medium">Insured nationwide shipping</p>
              </div>
            </div>
            <div className="group flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-900/40 transition-all border border-transparent hover:border-white/5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/5 group-hover:scale-110 transition-transform">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-slate-100 text-sm tracking-tight uppercase">Genuine Parts</p>
                <p className="text-[11px] text-slate-500 font-medium">Local distributor warranty</p>
              </div>
            </div>
            <div className="group flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-900/40 transition-all border border-transparent hover:border-white/5">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0 shadow-lg shadow-purple-500/5 group-hover:scale-110 transition-transform">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-slate-100 text-sm tracking-tight uppercase">Expert Builds</p>
                <p className="text-[11px] text-slate-500 font-medium">Stress-tested & optimized</p>
              </div>
            </div>
            <div className="group flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-900/40 transition-all border border-transparent hover:border-white/5">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/5 group-hover:scale-110 transition-transform">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-slate-100 text-sm tracking-tight uppercase">Live Support</p>
                <p className="text-[11px] text-slate-500 font-medium">Expert technical assistance</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links & Info */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center text-white">
                <Cpu className="w-5 h-5" />
              </div>
              <span className="text-lg font-bold text-white tracking-tight">
                {storeSettings.storeName || 'ApexRig PC Store'}
              </span>
            </div>
            <p className="text-sm text-slate-400 mb-4 max-w-sm">
              {storeSettings.tagline || "Pakistan's premier custom gaming PC builder and computer hardware superstore located at Hafeez Centre, Lahore."}
            </p>
            <div className="space-y-2 text-xs text-slate-400">
              <p className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{storeSettings.address || 'Hafeez Centre, Main Boulevard Gulberg III, Lahore'}</span>
              </p>
              <p className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{storeSettings.phone || storeSettings.whatsappNumber}</span>
              </p>
              <p className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{storeSettings.email || 'bhaiisheeda@gmail.com'}</span>
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200 mb-4 font-black">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <button onClick={onOpenBuilder} className="hover:text-indigo-400 transition-colors flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-indigo-500" />
                  Custom PC Builder
                </button>
              </li>
              <li>
                <button onClick={onOpenAI} className="hover:text-indigo-400 transition-colors flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-indigo-500" />
                  AI Build Assistant
                </button>
              </li>
              {onOpenTracking && (
                <li>
                  <button onClick={onOpenTracking} className="text-amber-400 font-bold hover:text-amber-300 transition-colors flex items-center gap-2">
                    <Truck className="w-3.5 h-3.5" />
                    Track Shipment
                  </button>
                </li>
              )}
              <li className="flex items-center gap-2 text-slate-500 italic">
                <div className="w-1 h-1 rounded-full bg-slate-700" />
                Pre-Built Gaming PCs
              </li>
              <li className="flex items-center gap-2 text-slate-500 italic">
                <div className="w-1 h-1 rounded-full bg-slate-700" />
                Flash Deals
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200 mb-4 font-black">Top Categories</h3>
            <ul className="space-y-2 text-sm">
              <li className="hover:text-slate-200 cursor-pointer flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-emerald-500" />
                Graphics Cards
              </li>
              <li className="hover:text-slate-200 cursor-pointer flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-emerald-500" />
                Processors (CPU)
              </li>
              <li className="hover:text-slate-200 cursor-pointer flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-emerald-500" />
                Gaming Monitors
              </li>
              <li className="hover:text-slate-200 cursor-pointer flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-emerald-500" />
                Mechanical Keyboards
              </li>
              <li className="hover:text-slate-200 cursor-pointer flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-emerald-500" />
                Gaming Headsets
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200 mb-4 font-black">Help & Support</h3>
            <ul className="space-y-2 text-sm">
              <li className="hover:text-slate-200 cursor-pointer">Warranty Policy</li>
              <li className="hover:text-slate-200 cursor-pointer">Shipping & Logistics</li>
              <li className="hover:text-slate-200 cursor-pointer">Return & Exchange</li>
              <li className="hover:text-slate-200 cursor-pointer">Corporate Sales</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-900 bg-slate-950 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex flex-col items-center md:items-start gap-4 text-center md:text-left">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Official Payment Partners</p>
            <div className="flex flex-wrap justify-center md:justify-start items-center gap-6 grayscale opacity-40 hover:grayscale-0 hover:opacity-100 transition-all duration-500">
               {/* Using descriptive text placeholders for logos as we don't have external SVGs/Images ready */}
               <span className="text-white font-black text-sm italic">HBL</span>
               <span className="text-white font-black text-sm italic">Meezan Bank</span>
               <span className="text-white font-black text-sm italic">EasyPaisa</span>
               <span className="text-white font-black text-sm italic">JazzCash</span>
            </div>
          </div>
          
          <div className="flex flex-col items-center md:items-end gap-4 text-center md:text-right">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Logistics Network</p>
            <div className="flex flex-wrap justify-center md:justify-end items-center gap-6 grayscale opacity-40 hover:grayscale-0 hover:opacity-100 transition-all duration-500">
               <span className="text-white font-black text-sm italic tracking-tighter">Leopards</span>
               <span className="text-white font-black text-sm italic tracking-tighter">TCS Express</span>
               <span className="text-white font-black text-sm italic tracking-tighter">M&P</span>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-900/50 bg-slate-950 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} {storeSettings.storeName}. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span className="hover:text-slate-300 cursor-pointer transition-colors">Privacy Policy</span>
            <span className="hover:text-slate-300 cursor-pointer transition-colors">Terms of Service</span>
            <span className="hover:text-slate-300 cursor-pointer transition-colors">Refund Policy</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
