import React, { useState, useMemo } from 'react';
import { localDate } from './SourceDocumentForm';
import { Product } from '../../types';
import { TrendingUp, Search, DollarSign, Tag, ArrowUpRight, Percent, ArrowDownRight } from 'lucide-react';

const pkr = (n: number) => `PKR ${Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function AccountingReportSummary({
  lines,
  sales,
  purchases,
  products = [],
}: {
  lines: any[];
  sales: any[];
  purchases: any[];
  products?: Product[];
}) {
  const [productSearch, setProductSearch] = useState('');
  const [marginFilter, setMarginFilter] = useState<'ALL' | 'HEALTHY' | 'LOW' | 'NEGATIVE'>('ALL');

  const net = (prefix: string) =>
    lines.filter((l) => l.account.startsWith(prefix)).reduce((s, l) => s + l.debit - l.credit, 0);
  const revenue = -net('4'),
    cost = net('5'),
    expenses = net('6');

  const aging = (docs: any[], type: string) => {
    const result = [0, 0, 0, 0, 0];
    for (const d of docs.filter(
      (doc) => doc.type === type && !['DRAFT', 'CANCELLED', 'REJECTED'].includes(doc.status) && doc.issueDate <= localDate()
    )) {
      const due = d.dueDate || d.deliveryDueDate || d.issueDate;
      const days = Math.floor((Date.parse(localDate()) - Date.parse(due)) / 86400000);
      result[days <= 0 ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : days <= 90 ? 3 : 4] += Number(
        d.balanceDuePkr ?? d.balancePayablePkr ?? 0
      );
    }
    return result;
  };

  // Product Pricing & Cost vs. Selling Price calculation
  const productPricingAnalysis = useMemo(() => {
    return products.map((p) => {
      const purchaseCost = Number(p.costPrice || 0);
      const sellingPrice = Number(p.price || 0);
      const grossMargin = sellingPrice - purchaseCost;
      const marginPercent = sellingPrice > 0 ? (grossMargin / sellingPrice) * 100 : 0;
      const markupPercent = purchaseCost > 0 ? (grossMargin / purchaseCost) * 100 : 0;

      return {
        id: p.id,
        name: p.name,
        sku: p.sku || 'N/A',
        category: p.category,
        stockCount: p.stockCount || 0,
        purchaseCost,
        sellingPrice,
        grossMargin,
        marginPercent,
        markupPercent,
      };
    });
  }, [products]);

  const filteredProducts = useMemo(() => {
    return productPricingAnalysis.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.sku.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.category.toLowerCase().includes(productSearch.toLowerCase());
      if (!matchesSearch) return false;

      if (marginFilter === 'HEALTHY') return p.marginPercent >= 15;
      if (marginFilter === 'LOW') return p.marginPercent > 0 && p.marginPercent < 15;
      if (marginFilter === 'NEGATIVE') return p.marginPercent <= 0;
      return true;
    });
  }, [productPricingAnalysis, productSearch, marginFilter]);

  const totalCatalogValueCost = useMemo(() => {
    return productPricingAnalysis.reduce((s, p) => s + p.purchaseCost * p.stockCount, 0);
  }, [productPricingAnalysis]);

  const totalCatalogValueRetail = useMemo(() => {
    return productPricingAnalysis.reduce((s, p) => s + p.sellingPrice * p.stockCount, 0);
  }, [productPricingAnalysis]);

  return (
    <div className="space-y-6">
      {/* 1. Profit & Loss Overview */}
      <div>
        <h3 className="font-bold text-base text-white mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-amber-400" />
          Profit & Loss · Selected Activity
        </h3>
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {[
            ['Revenue & Sales Income', revenue, 'text-emerald-400'],
            ['Cost of Goods Sold (COGS)', cost, 'text-blue-400'],
            ['Operating Expenses', expenses, 'text-amber-400'],
            ['Net Profit / (Loss)', revenue - cost - expenses, revenue - cost - expenses >= 0 ? 'text-emerald-300 font-black' : 'text-red-400 font-black'],
          ].map(([label, value, colorClass]) => (
            <div key={label as string} className="bg-slate-900 border border-white/10 rounded-2xl p-4">
              <p className="text-xs text-slate-400">{label}</p>
              <p className={`text-xl font-bold mt-2 ${colorClass}`}>{pkr(Number(value))}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 2. PRODUCT PRICING: Purchase Cost vs. Selling Price Matrix */}
      <div className="bg-slate-900 border border-white/10 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div>
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-amber-400" />
              Product Pricing & Margin Matrix (Purchase Cost vs. Selling Price)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live comparison of supplier purchase cost against retail selling price and profitability margins.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right text-xs">
              <span className="text-slate-400">Total Stock Cost: </span>
              <span className="font-bold text-white mr-3">{pkr(totalCatalogValueCost)}</span>
              <span className="text-slate-400">Retail Value: </span>
              <span className="font-bold text-amber-300">{pkr(totalCatalogValueRetail)}</span>
            </div>
          </div>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search product, SKU, or category..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-amber-500 focus:outline-none"
            />
          </div>

          <select
            value={marginFilter}
            onChange={(e) => setMarginFilter(e.target.value as any)}
            className="p-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-amber-500 focus:outline-none"
          >
            <option value="ALL">All Margin Tiers ({productPricingAnalysis.length})</option>
            <option value="HEALTHY">Healthy Margins (&ge; 15%)</option>
            <option value="LOW">Low Margins (&lt; 15%)</option>
            <option value="NEGATIVE">Zero / Loss Margins</option>
          </select>
        </div>

        {/* Pricing Table */}
        <div className="overflow-x-auto rounded-xl border border-white/5 bg-slate-950/60">
          <table className="w-full text-xs min-w-[760px]">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-white/10">
              <tr>
                <th className="p-3 text-left min-w-48">Product & SKU</th>
                <th className="p-3 text-left w-28">Category</th>
                <th className="p-3 text-center w-20">Stock</th>
                <th className="p-3 text-right w-32 bg-blue-500/5 text-blue-300">Purchase Cost (PKR)</th>
                <th className="p-3 text-right w-32 bg-amber-500/5 text-amber-300">Selling Price (PKR)</th>
                <th className="p-3 text-right w-28">Profit / Unit</th>
                <th className="p-3 text-right w-24">Margin %</th>
                <th className="p-3 text-right w-24">Markup %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredProducts.slice(0, 50).map((p) => {
                const isHealthy = p.marginPercent >= 15;
                const isNegative = p.grossMargin <= 0;

                return (
                  <tr key={p.id} className="hover:bg-white/[0.02]">
                    <td className="p-3 font-semibold text-white">
                      <div>{p.name}</div>
                      <div className="text-[11px] text-slate-500 font-normal">SKU: {p.sku}</div>
                    </td>
                    <td className="p-3 text-slate-400">{p.category}</td>
                    <td className="p-3 text-center font-bold text-slate-300">{p.stockCount}</td>
                    <td className="p-3 text-right font-semibold text-blue-300 bg-blue-500/5">
                      {pkr(p.purchaseCost)}
                    </td>
                    <td className="p-3 text-right font-bold text-amber-300 bg-amber-500/5">
                      {pkr(p.sellingPrice)}
                    </td>
                    <td className={`p-3 text-right font-bold ${isNegative ? 'text-red-400' : 'text-emerald-400'}`}>
                      {pkr(p.grossMargin)}
                    </td>
                    <td className="p-3 text-right">
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                          isNegative
                            ? 'bg-red-500/20 text-red-300'
                            : isHealthy
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {p.marginPercent.toFixed(1)}%
                      </span>
                    </td>
                    <td className="p-3 text-right text-slate-400">
                      {p.markupPercent.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredProducts.length > 50 && (
            <p className="p-2 text-center text-slate-500 text-[11px]">
              Showing top 50 products. Narrow search for more.
            </p>
          )}
          {!filteredProducts.length && (
            <p className="p-8 text-center text-slate-400">No products found matching filters.</p>
          )}
        </div>
      </div>

      {/* 3. Aging Analysis */}
      <div>
        <h3 className="font-bold text-base text-white mb-2">Current Outstanding Aging · {localDate()}</h3>
        <p className="text-xs text-slate-400 mb-3">
          Aging groups open payables and receivables across credit periods to track due dates and cash flow.
        </p>
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900">
          <table className="w-full text-sm min-w-[650px]">
            <thead className="bg-slate-950 text-slate-400">
              <tr>
                {['Type', 'Not Due (Current)', '1–30 Days Overdue', '31–60 Days Overdue', '61–90 Days Overdue', '90+ Days Overdue'].map(
                  (h, i) => (
                    <th className="p-3 text-left" key={i}>
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {[
                ['Customer Receivables (Invoices)', aging(sales, 'INVOICE')],
                ['Supplier Payables (Bills)', aging(purchases, 'SUPPLIER_BILL')],
              ].map(([label, buckets]: any) => (
                <tr key={label} className="border-t border-white/5 hover:bg-white/5">
                  <td className="p-3 font-semibold text-white">{label}</td>
                  {buckets.map((n: number, i: number) => (
                    <td key={i} className="p-3 whitespace-nowrap text-slate-300 font-medium">
                      {pkr(n)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <h3 className="font-bold text-base text-white">Trial Balance · Selected Activity</h3>
    </div>
  );
}
