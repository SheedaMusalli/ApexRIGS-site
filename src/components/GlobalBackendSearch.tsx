import React, { useState } from 'react';
import { Search } from 'lucide-react';

interface GlobalBackendSearchProps {
  onNavigateToTab: (tab: string, subTab?: string) => void;
}

export const GlobalBackendSearch: React.FC<GlobalBackendSearchProps> = ({ onNavigateToTab }) => {
  const [query, setQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    const q = query.toLowerCase();
    if (q.includes('order') || q.includes('track') || q.includes('ship')) {
      onNavigateToTab('operations', 'orders');
    } else if (q.includes('invoice') || q.includes('sale') || q.includes('ledger') || q.includes('voucher') || q.includes('bank')) {
      onNavigateToTab('erp');
    } else {
      onNavigateToTab('products');
    }
  };

  return (
    <form onSubmit={handleSearch} className="relative w-full">
      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        type="text"
        placeholder="Search orders, sales invoices, bills, products, or SKUs..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
      />
    </form>
  );
};
