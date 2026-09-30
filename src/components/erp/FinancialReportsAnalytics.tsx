import { salesProfit, receivableAging, csvText, isPostedSale } from '../../utils/accounting';
import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  FileSpreadsheet,
  TrendingUp,
  Download,
  Printer,
  Calendar,
  Layers,
  DollarSign,
  PieChart,
  Activity,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { BranchLocationId } from '../../types/erp';
import { erpStorage } from '../../services/erpStorage';
import { formatPkr } from '../../utils/formatters';
import { ProductPurchaseSalesAuditReport } from './ProductPurchaseSalesAuditReport';

interface ReportsAnalyticsProps {
  activeBranchId: BranchLocationId;
}

export const FinancialReportsAnalytics: React.FC<ReportsAnalyticsProps> = ({ activeBranchId }) => {
  const [reportType, setReportType] = useState<'pnl' | 'balance_sheet' | 'trial_balance' | 'aging' | 'inventory_turnover' | 'traceability'>('pnl');
  const [startDate, setStartDate] = useState(new Date().getFullYear() + '-01-01');
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [, refresh] = useState(0);
  useEffect(() => {
    const update = () => refresh(n => n + 1);
    window.addEventListener('apex:erp_updated', update);
    window.addEventListener('storage', update);
    return () => { window.removeEventListener('apex:erp_updated', update); window.removeEventListener('storage', update); };
  }, []);
  const [notification, setNotification] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const handleExportCsv = () => {
    let rows: string[][] = [];
    let filename = '';

    if (reportType === 'pnl') {
      filename = `Apex_Profit_and_Loss_${new Date().toISOString().split('T')[0]}.csv`;
      rows = [
        ['Account Line Item', 'Amount (PKR)'],
        ['Gross Sales Revenue', pnlData.grossRevenue.toString()],
        ['Less: Sales Returns & Discounts', `-${pnlData.salesReturns}`],
        ['Net Turnover', pnlData.netRevenue.toString()],
        ['Less: Cost of Goods Sold (COGS)', `-${pnlData.cogs}`],
        ['Gross Profit', pnlData.grossProfit.toString()],
        ['Operating Expenses (OPEX)', ''],
        ['  Salaries & Wages', pnlData.operatingExpenses.salaries.toString()],
        ['  Rent & Showroom Lease', pnlData.operatingExpenses.rent.toString()],
        ['  Utilities & Commercial Power', pnlData.operatingExpenses.utilitiesElectricity.toString()],
        ['  Marketing & Campaigns', pnlData.operatingExpenses.marketingAds.toString()],
        ['  Depreciation Expense', pnlData.operatingExpenses.depreciation.toString()],
        ['  Packaging & Courier Freight', pnlData.operatingExpenses.packagingAndCourier.toString()],
        ['Other Expenses', String(otherExpenses)],
        ['Total Operating Expenses', pnlData.totalOpex.toString()],
        ['Operating Profit (EBIT)', pnlData.operatingProfitEbit.toString()],
        
        ['Net Profit before income tax', pnlData.netProfitAfterTax.toString()],
      ];
    } else if (reportType === 'aging') {
      filename = `Apex_Receivables_Aging_${endDate}.csv`;
      rows = [['Invoice', 'Customer', 'Due date', 'Days overdue', 'Outstanding PKR'], ...aging.rows.map(d => [d.docNumber, d.customerName, d.dueDate, String(d.daysOverdue), String(d.balanceDuePkr)])];
    } else {
      filename = `Apex_Financial_Statement_${reportType}_${new Date().toISOString().split('T')[0]}.csv`;
      rows = [
        ['Section', 'Item', 'Amount (PKR)'],
        ['Current Assets', 'Cash & Bank Balances', balanceSheetData.assets.current.cashAndBank.toString()],
        ['Current Assets', 'Trade Receivables', balanceSheetData.assets.current.tradeReceivables.toString()],
        ['Current Assets', 'Inventory Stock Asset', balanceSheetData.assets.current.inventories.toString()],
        ['Non-current Assets', 'Fixed assets (net)', String(totalNonCurrentAssets)],
        ['Total Assets', 'Total Balance', String(totalAssets)],
        ['Liabilities', 'Trade payables', String(tradePayables)],
        ['Liabilities', 'Tax and other current liabilities', String(totalCurrentLiabilities - tradePayables)],
        ['Total Liabilities', 'Total', String(totalLiabilities)],
        ['Equity', 'Capital', String(shareCapital)],
        ['Equity', 'Retained earnings', String(retainedEarnings)],
        ['Total Liabilities and Equity', 'Total', String(totalLiabilities + totalEquity)],
        ['Reconciliation', 'Unreconciled difference', String(totalAssets - totalLiabilities - totalEquity)],
      ];
    }

    const url = URL.createObjectURL(new Blob([csvText(rows)], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(`Financial report downloaded (${filename})`);
  };

  const allSales = erpStorage.getSalesDocuments().filter(d => d.branchId === activeBranchId);
  const inPeriod = (date: string) => date >= startDate && date <= endDate;
  const invoices = allSales.filter(d => d.type === 'INVOICE' && isPostedSale(d) && inPeriod(d.issueDate));
  const purchases = erpStorage.getPurchaseDocuments().filter(d => d.branchId === activeBranchId && d.type === 'SUPPLIER_BILL' && !['DRAFT', 'REJECTED'].includes(d.status) && inPeriod(d.issueDate));
  const vouchers = erpStorage.getVouchers().filter(v => v.branchId === activeBranchId && inPeriod(v.date));
  const bankAccounts = erpStorage.getBankAccounts();
  const customers = erpStorage.getCustomers();
  const vendors = erpStorage.getVendors();
  const coa = erpStorage.getChartOfAccounts();
  const aging = receivableAging(allSales, endDate);
  const { grossRevenue, salesReturns, netRevenue, cogs } = salesProfit(allSales.filter(d => inPeriod(d.issueDate)));
  const grossProfit = netRevenue - cogs;
  const grossMarginPercent = netRevenue > 0 ? Math.round((grossProfit / netRevenue) * 100) : 0;

  // Operating expenses from payment vouchers
  // Supplier settlements and transfers are not operating expenses.
  const paymentVouchers = vouchers.filter(v => ['CPV', 'BPV'].includes(v.type) &&
    (v.partyType === 'GENERAL_EXPENSE' || v.partyType === 'EMPLOYEE'));
  const expense = (code: string) => paymentVouchers.filter(v => v.debitAccountCode === code).reduce((s, v) => s + v.amountPkr, 0);
  const salaries = expense('6020');
  const rent = expense('6010');
  const utilitiesElectricity = expense('6030');
  const marketingAds = expense('6040');
  const depreciation = 0;
  const packagingAndCourier = expense('5030');
  const categorizedSum = salaries + rent + utilitiesElectricity + marketingAds + packagingAndCourier;
  const otherExpenses = paymentVouchers.reduce((s, v) => s + v.amountPkr, 0) - categorizedSum;
  const totalOpex = salaries + rent + utilitiesElectricity + marketingAds + depreciation + packagingAndCourier + otherExpenses;
  const operatingProfitEbit = grossProfit - totalOpex;
  const taxExpenseFBR = 0 // Income tax requires a separately recorded provision; no assumed tax rate.;
  const netProfitAfterTax = operatingProfitEbit - taxExpenseFBR;

  const pnlData = {
    grossRevenue,
    salesReturns,
    netRevenue,
    cogs,
    grossProfit,
    grossMarginPercent,
    operatingExpenses: {
      salaries,
      rent,
      utilitiesElectricity,
      marketingAds,
      depreciation,
      packagingAndCourier,
    },
    totalOpex,
    operatingProfitEbit,
    taxExpenseFBR,
    netProfitAfterTax,
  };

  // Balance sheet dynamically computed
  const cashAndBank = bankAccounts.reduce((sum, b) => sum + (b.currentBalancePkr || 0), 0);
  const tradeReceivables = customers.reduce((sum, c) => sum + (c.currentBalancePkr || 0), 0);
  const inventories = coa.find(a => a.code === '1200')?.netBalancePkr || 0;
  const advancesAndPrepayments = 0;
  const totalCurrentAssets = cashAndBank + tradeReceivables + inventories + advancesAndPrepayments;
  const fixedAssetsPropertyPlant = erpStorage.getFixedAssets().filter(a => a.status !== 'DISPOSED').reduce((sum, a) => sum + a.purchaseCostPkr, 0);
  const accumulatedDepreciation = -erpStorage.getFixedAssets().filter(a => a.status !== 'DISPOSED').reduce((sum, a) => sum + a.accumulatedDepreciationPkr, 0);
  const securityDeposits = 0;
  const totalNonCurrentAssets = fixedAssetsPropertyPlant + accumulatedDepreciation + securityDeposits;
  const totalAssets = totalCurrentAssets + totalNonCurrentAssets;

  const tradePayables = vendors.reduce((sum, v) => sum + (v.currentPayableBalancePkr || 0), 0);
  const accruedExpenses = 0;
  const outputGstTotal = invoices.reduce((sum, inv) => sum + (inv.totalGstTaxPkr || 0), 0);
  const inputGstTotal = purchases.reduce((sum, p) => sum + (p.inputGstPkr || 0), 0);
  const salesTaxPayableFBR = coa.find(a => a.code === '2020')?.netBalancePkr || 0;
  const withholdingTaxPayable = coa.find(a => a.code === '2030')?.netBalancePkr || 0;
  const totalCurrentLiabilities = tradePayables + accruedExpenses + salesTaxPayableFBR + withholdingTaxPayable;
  const longTermLoans = 0;
  const totalNonCurrentLiabilities = longTermLoans;
  const totalLiabilities = totalCurrentLiabilities + totalNonCurrentLiabilities;

  const shareCapital = coa.find((a) => a.code === '3010')?.netBalancePkr || 0;
  const retainedEarnings = coa.find(a => a.code === '3020')?.netBalancePkr || 0;
  const totalEquity = shareCapital + retainedEarnings;

  const balanceSheetData = {
    assets: {
      current: {
        cashAndBank,
        tradeReceivables,
        inventories,
        advancesAndPrepayments,
        totalCurrent: totalCurrentAssets,
      },
      nonCurrent: {
        fixedAssetsPropertyPlant,
        accumulatedDepreciation,
        securityDeposits,
        totalNonCurrent: totalNonCurrentAssets,
      },
      totalAssets,
    },
    liabilities: {
      current: {
        tradePayables,
        accruedExpenses,
        salesTaxPayableFBR,
        withholdingTaxPayable,
        totalCurrentLiabilities,
      },
      nonCurrent: {
        longTermLoans,
        totalNonCurrentLiabilities,
      },
      totalLiabilities,
    },
    equity: {
      shareCapital,
      retainedEarnings,
      totalEquity,
    },
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between gap-2 text-emerald-300 text-xs shadow-lg animate-fade-in">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-emerald-400/60 hover:text-emerald-300 text-xs font-bold">✕</button>
        </div>
      )}

      <div className="flex flex-wrap gap-4 text-sm text-slate-300">
        <label>From <input aria-label="Report start date" type="date" value={startDate} max={endDate} onChange={e => setStartDate(e.target.value)} className="bg-slate-900 p-2 rounded" /></label>
        <label>Through <input aria-label="Report end date" type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} className="bg-slate-900 p-2 rounded" /></label>
      </div>
      <p className="text-xs text-amber-300">Provisional management reports. P&amp;L uses invoice line costs and recorded expense payments. Balance sheet uses current balances, not historical balances. Aging uses current outstanding amounts as of the selected date; reconcile unallocated credits separately.</p>
      {/* Top Metric Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-emerald-500/20 rounded-2xl p-4 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Net Revenue (selected period)</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-300 font-mono">
            {formatPkr(pnlData.netRevenue)}
          </div>
          <div className="text-[11px] text-emerald-400/80 mt-1 flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" /> Recorded invoices less credit notes
          </div>
        </div>

        <div className="bg-slate-900/80 border border-blue-500/20 rounded-2xl p-4 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Gross Profit ({grossMarginPercent}%)</span>
            <TrendingUp className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-blue-300 font-mono">
            {formatPkr(pnlData.grossProfit)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Hardware margins after landed COGS</div>
        </div>

        <div className="bg-slate-900/80 border border-purple-500/20 rounded-2xl p-4 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Net Profit</span>
            <Activity className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-purple-300 font-mono">
            {formatPkr(pnlData.netProfitAfterTax)}
          </div>
          <div className="text-[11px] text-purple-400/80 mt-1">Before income tax provision</div>
        </div>

        <div className="bg-slate-900/80 border border-amber-500/20 rounded-2xl p-4 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Total Balance Sheet Assets</span>
            <Layers className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-300 font-mono">
            {formatPkr(balanceSheetData.assets.totalAssets)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Provisional balances; reconcile before reporting</div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-white/10">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setReportType('pnl')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              reportType === 'pnl'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Profit & Loss Statement (P&L)</span>
          </button>

          <button
            onClick={() => setReportType('balance_sheet')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              reportType === 'balance_sheet'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Balance Sheet (Statement of Financial Position)</span>
          </button>

          <button
            onClick={() => setReportType('aging')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              reportType === 'aging'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Aging Analysis (30 / 60 / 90+ Days)</span>
          </button>

          <button
            onClick={() => setReportType('traceability')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              reportType === 'traceability'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
            <span>Purchase & Sales Traceability Ledger</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
          <button
            disabled={reportType === 'traceability'}
            onClick={handleExportCsv}
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Main Statement Viewer */}
      {reportType === 'pnl' ? (
        <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-6 shadow-xl space-y-4 font-mono text-xs">
          <div className="flex justify-between items-center border-b border-white/10 pb-4">
            <div>
              <h2 className="text-base font-bold font-sans text-white uppercase tracking-wider">Statement of Profit or Loss (Income Statement)</h2>
              <p className="text-slate-400 text-[11px] font-sans">{startDate} to {endDate} (All figures in PKR)</p>
            </div>
            <span className="bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full text-xs font-bold font-sans border border-emerald-500/30">
              PROVISIONAL
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between py-1.5 border-b border-white/5 text-slate-300">
              <span className="font-sans font-bold">Gross Sales Revenue</span>
              <span>{formatPkr(pnlData.grossRevenue)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/5 text-red-400">
              <span className="font-sans">Less: Sales Returns & Allowances</span>
              <span>({formatPkr(pnlData.salesReturns)})</span>
            </div>
            <div className="flex justify-between py-2 border-b border-white/10 font-bold text-white text-sm bg-white/[0.02] px-2 rounded">
              <span className="font-sans">NET REVENUE</span>
              <span className="text-emerald-400">{formatPkr(pnlData.netRevenue)}</span>
            </div>

            <div className="flex justify-between py-1.5 border-b border-white/5 text-red-400">
              <span className="font-sans">Less: Cost of Goods Sold (COGS - Landed Hardware)</span>
              <span>({formatPkr(pnlData.cogs)})</span>
            </div>

            <div className="flex justify-between py-2.5 border-b border-white/10 font-bold text-white text-sm bg-blue-500/10 px-2 rounded border border-blue-500/20">
              <span className="font-sans">GROSS PROFIT (GP Margin: {grossMarginPercent}%)</span>
              <span className="text-blue-300">{formatPkr(pnlData.grossProfit)}</span>
            </div>

            {invoices.some(d => d.items.some(i => !i.unitCostPkr)) && <p className="text-amber-300">Some invoice lines have no recorded cost. Gross profit may be overstated.</p>}
            {/* Operating Expenses */}
            <div className="pt-2">
              <div className="flex justify-between"><span>Courier and packaging</span><span>{formatPkr(packagingAndCourier)}</span></div>
              <div className="flex justify-between"><span>Other expenses</span><span>{formatPkr(otherExpenses)}</span></div>
              <div className="font-sans font-bold text-slate-400 uppercase text-[10px] tracking-wider mb-1">Operating & Administrative Expenses</div>
              <div className="pl-4 space-y-1 text-slate-300">
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="font-sans">Technician & Staff Salaries</span>
                  <span>{formatPkr(pnlData.operatingExpenses.salaries)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="font-sans">Retail Store Rent (Hafeez Center)</span>
                  <span>{formatPkr(pnlData.operatingExpenses.rent)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="font-sans">Commercial Electricity & HVAC</span>
                  <span>{formatPkr(pnlData.operatingExpenses.utilitiesElectricity)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="font-sans">Digital Marketing & Esports Sponsorships</span>
                  <span>{formatPkr(pnlData.operatingExpenses.marketingAds)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="font-sans">Depreciation expense (not recorded)</span>
                  <span>{formatPkr(pnlData.operatingExpenses.depreciation)}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between py-2 border-b border-white/10 font-bold text-red-400 bg-white/[0.02] px-2 rounded">
              <span className="font-sans">TOTAL OPERATING EXPENSES</span>
              <span>({formatPkr(pnlData.totalOpex)})</span>
            </div>

            <div className="flex justify-between py-2 border-b border-white/10 font-bold text-white text-sm bg-white/[0.02] px-2 rounded">
              <span className="font-sans">OPERATING PROFIT</span>
              <span className="text-emerald-400">{formatPkr(pnlData.operatingProfitEbit)}</span>
            </div>

            <div className="flex justify-between py-1.5 border-b border-white/5 text-red-400">
              <span className="font-sans">Income tax provision (not recorded)</span>
              <span>({formatPkr(pnlData.taxExpenseFBR)})</span>
            </div>

            <div className="flex justify-between py-3 font-black text-white text-base bg-emerald-500/20 px-3 rounded-xl border border-emerald-500/40">
              <span className="font-sans">NET PROFIT</span>
              <span className="text-emerald-300">{formatPkr(pnlData.netProfitAfterTax)}</span>
            </div>
          </div>
        </div>
      ) : reportType === 'balance_sheet' ? (
        /* BALANCE SHEET */
        <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-6 shadow-xl space-y-4 font-mono text-xs">
          <div className="flex justify-between items-center border-b border-white/10 pb-4">
            <div>
              <h2 className="text-base font-bold font-sans text-white uppercase tracking-wider">Statement of Financial Position (Balance Sheet)</h2>
              <p className="text-slate-400 text-[11px] font-sans">Current recorded balances (PKR)</p>
              <p className="text-amber-300">Unreconciled difference: {formatPkr(totalAssets - totalLiabilities - totalEquity)}</p>
            </div>
            <span className="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-xs font-bold font-sans border border-blue-500/30">
              ASSETS = LIABILITIES + EQUITY
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column: Assets */}
            <div className="space-y-3">
              <h3 className="font-sans font-bold text-amber-400 uppercase text-xs border-b border-amber-500/30 pb-1">1. ASSETS</h3>
              
              <div className="space-y-1 pl-2">
                <div className="font-sans font-bold text-slate-400 text-[10px]">CURRENT ASSETS:</div>
                <div className="flex justify-between py-1 border-b border-white/5 text-slate-300">
                  <span className="font-sans">Cash & Bank Balances</span>
                  <span>{formatPkr(balanceSheetData.assets.current.cashAndBank)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5 text-slate-300">
                  <span className="font-sans">Trade Receivables (Debtors)</span>
                  <span>{formatPkr(balanceSheetData.assets.current.tradeReceivables)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5 text-slate-300">
                  <span className="font-sans">Hardware Inventories & Rigs</span>
                  <span>{formatPkr(balanceSheetData.assets.current.inventories)}</span>
                </div>
                <div className="flex justify-between py-1.5 font-bold text-white bg-white/[0.02] px-2 rounded">
                  <span className="font-sans">Total Current Assets:</span>
                  <span className="text-emerald-400">{formatPkr(balanceSheetData.assets.current.totalCurrent)}</span>
                </div>
              </div>

              <div className="space-y-1 pl-2 pt-2">
                <div className="font-sans font-bold text-slate-400 text-[10px]">NON-CURRENT ASSETS:</div>
                <div className="flex justify-between py-1 border-b border-white/5 text-slate-300">
                  <span className="font-sans">Property, Plant & Equipment</span>
                  <span>{formatPkr(balanceSheetData.assets.nonCurrent.fixedAssetsPropertyPlant)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5 text-red-400">
                  <span className="font-sans">Accumulated Depreciation</span>
                  <span>({formatPkr(Math.abs(balanceSheetData.assets.nonCurrent.accumulatedDepreciation))})</span>
                </div>
                <div className="flex justify-between py-1.5 font-bold text-white bg-white/[0.02] px-2 rounded">
                  <span className="font-sans">Total Non-Current Assets:</span>
                  <span className="text-emerald-400">{formatPkr(balanceSheetData.assets.nonCurrent.totalNonCurrent)}</span>
                </div>
              </div>

              <div className="flex justify-between py-2.5 bg-amber-500/20 border border-amber-500/40 px-3 rounded-xl font-bold text-white text-sm">
                <span className="font-sans">TOTAL ASSETS:</span>
                <span className="text-amber-300">{formatPkr(balanceSheetData.assets.totalAssets)}</span>
              </div>
            </div>

            {/* Right Column: Liabilities & Equity */}
            <div className="space-y-3">
              <h3 className="font-sans font-bold text-blue-400 uppercase text-xs border-b border-blue-500/30 pb-1">2. LIABILITIES & EQUITY</h3>
              
              <div className="space-y-1 pl-2">
                <div className="font-sans font-bold text-slate-400 text-[10px]">CURRENT LIABILITIES:</div>
                <div className="flex justify-between py-1 border-b border-white/5 text-slate-300">
                  <span className="font-sans">Trade Payables (Suppliers)</span>
                  <span>{formatPkr(balanceSheetData.liabilities.current.tradePayables)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5 text-slate-300">
                  <span className="font-sans">Sales Tax Payable</span>
                  <span>{formatPkr(balanceSheetData.liabilities.current.salesTaxPayableFBR + balanceSheetData.liabilities.current.withholdingTaxPayable)}</span>
                </div>
                <div className="flex justify-between py-1.5 font-bold text-white bg-white/[0.02] px-2 rounded">
                  <span className="font-sans">Total Current Liabilities:</span>
                  <span className="text-red-400">{formatPkr(balanceSheetData.liabilities.current.totalCurrentLiabilities)}</span>
                </div>
              </div>

              <div className="space-y-1 pl-2 pt-2">
                <div className="font-sans font-bold text-slate-400 text-[10px]">SHAREHOLDERS' EQUITY:</div>
                <div className="flex justify-between py-1 border-b border-white/5 text-slate-300">
                  <span className="font-sans">Issued & Paid-up Share Capital</span>
                  <span>{formatPkr(balanceSheetData.equity.shareCapital)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5 text-slate-300">
                  <span className="font-sans">Retained Earnings (Accumulated Profit)</span>
                  <span>{formatPkr(balanceSheetData.equity.retainedEarnings)}</span>
                </div>
                <div className="flex justify-between py-1.5 font-bold text-white bg-white/[0.02] px-2 rounded">
                  <span className="font-sans">Total Shareholders' Equity:</span>
                  <span className="text-blue-300">{formatPkr(balanceSheetData.equity.totalEquity)}</span>
                </div>
              </div>

              <div className="flex justify-between py-2.5 bg-blue-500/20 border border-blue-500/40 px-3 rounded-xl font-bold text-white text-sm">
                <span className="font-sans">TOTAL LIABILITIES & EQUITY:</span>
                <span className="text-blue-300">{formatPkr(balanceSheetData.liabilities.totalLiabilities + balanceSheetData.equity.totalEquity)}</span>
              </div>
            </div>
          </div>
        </div>
      ) : reportType === 'aging' ? (
        <div className="space-y-4 text-slate-200">
          <h3 className="font-bold">Customer receivables by days overdue</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {['Not due', '1–30 days', '31–60 days', '61–90 days', 'Over 90 days'].map((label, i) => (
              <div key={label} className="bg-slate-900 p-4 rounded-xl"><div>{label}</div><strong>{formatPkr(aging.buckets[i])}</strong></div>
            ))}
          </div>
          <div className="overflow-x-auto"><table className="w-full text-sm text-left">
            <thead><tr>{['Invoice', 'Customer', 'Due date', 'Days overdue', 'Outstanding'].map(h => <th key={h} className="p-2">{h}</th>)}</tr></thead>
            <tbody>{aging.rows.map(d => <tr key={d.id}><td className="p-2">{d.docNumber}</td><td>{d.customerName}</td><td>{d.dueDate}</td><td>{d.daysOverdue}</td><td>{formatPkr(d.balanceDuePkr)}</td></tr>)}</tbody>
          </table>{aging.rows.length === 0 && <p className="p-4">No outstanding invoices.</p>}</div>
        </div>
      ) : null}

      {reportType === 'traceability' && (
        <ProductPurchaseSalesAuditReport activeBranchId={activeBranchId} />
      )}
    </div>
  );
};
