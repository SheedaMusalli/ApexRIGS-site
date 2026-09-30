import React, { useState } from 'react';
import { Package, AlertTriangle, Search, TrendingUp, CheckCircle, RefreshCw } from 'lucide-react';
import { Product, Order } from '../types';
import { formatPkr } from '../utils/formatters';

interface InventoryDashboardProps {
  products: Product[];
  orders?: Order[];
  onRefreshProducts?: () => void;
}

export const InventoryDashboard: React.FC<InventoryDashboardProps> = ({
  products,
  orders = [],
  onRefreshProducts,
}) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all');

  const totalStock = products.reduce((acc, p) => acc + (p.stock || 0), 0);
  const outOfStock = products.filter((p) => (p.stock || 0) <= 0).length;
  const lowStock = products.filter((p) => (p.stock || 0) > 0 && (p.stock || 0) <= 3).length;
  const totalValue = products.reduce((acc, p) => acc + (p.pricePkr || 0) * (p.stock || 0), 0);

  const filtered = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase())) ||
      p.category.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;
    if (filter === 'low') return (p.stock || 0) > 0 && (p.stock || 0) <= 3;
    if (filter === 'out') return (p.stock || 0) <= 0;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Package className="w-5 h-5 text-indigo-400" />
            Inventory & Stock Hub
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time stock monitoring, valuation, and threshold alerts.
          </p>
        </div>
        {onRefreshProducts && (
          <button
            onClick={onRefreshProducts}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="text-xs text-slate-400 font-medium">Total Products</div>
          <div className="text-2xl font-bold text-slate-100 mt-1">{products.length}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="text-xs text-slate-400 font-medium">Total Stock Units</div>
          <div className="text-2xl font-bold text-indigo-400 mt-1">{totalStock}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="text-xs text-slate-400 font-medium">Out of Stock</div>
          <div className="text-2xl font-bold text-red-400 mt-1">{outOfStock}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="text-xs text-slate-400 font-medium">Inventory Valuation</div>
          <div className="text-xl font-bold text-emerald-400 mt-1">{formatPkr(totalValue)}</div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between mb-4">
          <div className="relative w-full md:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search products or SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({products.length})
            </button>
            <button
              onClick={() => setFilter('low')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === 'low' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              Low Stock ({lowStock})
            </button>
            <button
              onClick={() => setFilter('out')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === 'out' ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              Out of Stock ({outOfStock})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3">Product</th>
                <th className="p-3">SKU</th>
                <th className="p-3">Category</th>
                <th className="p-3">Unit Price</th>
                <th className="p-3">Stock Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.slice(0, 50).map((p) => {
                const stock = p.stock || 0;
                return (
                  <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 font-medium text-slate-100">{p.name}</td>
                    <td className="p-3 font-mono text-slate-400">{p.sku || '-'}</td>
                    <td className="p-3 text-slate-400">{p.category}</td>
                    <td className="p-3 font-medium text-slate-200">{formatPkr(p.pricePkr)}</td>
                    <td className="p-3">
                      {stock <= 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 font-semibold text-[10px]">
                          Out of Stock (0)
                        </span>
                      ) : stock <= 3 ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-semibold text-[10px]">
                          Low Stock ({stock})
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold text-[10px]">
                          In Stock ({stock})
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
