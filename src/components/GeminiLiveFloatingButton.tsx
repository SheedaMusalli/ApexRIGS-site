import React from 'react';
import { Radio, Sparkles, Tv } from 'lucide-react';

interface GeminiLiveFloatingButtonProps {
  onOpenLive: () => void;
}

export const GeminiLiveFloatingButton: React.FC<GeminiLiveFloatingButtonProps> = ({ onOpenLive }) => {
  return (
    <div className="fixed bottom-24 right-6 z-40">
      <button
        onClick={onOpenLive}
        aria-label="Apex rig AI"
        className="group relative flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-600 via-purple-600 to-emerald-500 text-white shadow-xl shadow-purple-600/35 transition-all duration-300 hover:scale-110 active:scale-95 ring-2 ring-purple-400/40"
      >
        {/* Glowing ping indicator */}
        <span className="absolute -top-1 -right-1 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-slate-950"></span>
        </span>

        {/* Live Pulse Icon */}
        <div className="relative flex items-center justify-center">
          <Radio className="w-6 h-6 animate-pulse" />
        </div>

        {/* Mini Pill Label */}
        <span className="absolute -bottom-2 bg-slate-900 border border-purple-500/40 text-[9px] font-black uppercase tracking-wider text-purple-300 px-1.5 py-0.2 rounded-full shadow-md">
          LIVE AI
        </span>

        {/* Hover Tooltip */}
        <span className="absolute right-full mr-3 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold whitespace-nowrap shadow-2xl border border-slate-800 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span>Apex rig AI</span>
        </span>
      </button>
    </div>
  );
};
