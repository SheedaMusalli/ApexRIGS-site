import React from 'react';
import { MessageCircle } from 'lucide-react';
import { StoreSettings } from '../types';

interface WhatsAppFloatingButtonProps {
  storeSettings: StoreSettings;
}

export const WhatsAppFloatingButton: React.FC<WhatsAppFloatingButtonProps> = ({ storeSettings }) => {
  const handleOpenWhatsApp = () => {
    const rawNumber = storeSettings.whatsappNumber || storeSettings.phone || '+447597030688';
    const cleanNumber = rawNumber.replace(/[^0-9]/g, '');
    const message = encodeURIComponent(
      `Assalam-o-Alaikum! I have an inquiry regarding custom PC builds and hardware at ${storeSettings.storeName || 'ApexRig'}.`
    );
    window.open(`https://wa.me/${cleanNumber}?text=${message}`, '_blank');
  };

  return (
    <div className="fixed bottom-6 right-6 z-40">
      <button
        onClick={handleOpenWhatsApp}
        aria-label="Chat on WhatsApp"
        className="group relative flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white shadow-xl shadow-emerald-500/30 transition-all duration-300 hover:scale-110 active:scale-95"
      >
        <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-400 border-2 border-slate-900"></span>
        </span>
        <MessageCircle className="w-7 h-7 fill-white/20" />
        
        {/* Tooltip */}
        <span className="absolute right-full mr-3 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium whitespace-nowrap shadow-lg border border-slate-800 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200">
          Chat with Hardware Specialist
        </span>
      </button>
    </div>
  );
};
