import React, { useEffect, useState } from 'react';
import { LayoutDashboard, Receipt, Truck, Users, Building2, Landmark, BookOpen, BarChart3, ShieldCheck, Package, Settings2, Tags, SlidersHorizontal, ShoppingCart, UserCog, Store, Gamepad2 } from 'lucide-react';
import type { Product, Order } from '../../types';
import { can } from '../../utils/permissions';
import { LinkedWorkspace } from './LinkedWorkspace';
import { AccessControl } from './AccessControl';
import { BooksWorkspace } from './BooksWorkspace';
export type ERPModuleTab = 'dashboard' | 'sales' | 'purchases' | 'banking' | 'ledger' | 'reports' | 'books' | 'admin';
interface ERPSuiteProps { products: Product[]; orders?: Order[]; user?: any; onRefreshProducts?: () => void; onAddProductClick?: () => void; initialModule?: ERPModuleTab | string; managementModule?: string; onManagementNavigate?: (module?: string) => void; children?: React.ReactNode; }
export const ERPSuite: React.FC<ERPSuiteProps> = ({ products, orders = [], user, onRefreshProducts, initialModule, managementModule, onManagementNavigate, children }) => {
  const [active, setActive] = useState<string>((initialModule as string) === 'inventory_sn' || (initialModule as string) === 'inventory' ? 'reports' : initialModule === 'gl' ? 'ledger' : initialModule || 'dashboard');
  const [session, setSession] = useState<any>(() => {
    if (user) return user;
    try {
      const saved = localStorage.getItem('apex_admin_user') || localStorage.getItem('apex_user');
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });
  const [isVerifying, setIsVerifying] = useState<boolean>(!user && !session);

  useEffect(() => {
    if (user) {
      setSession(user);
      setIsVerifying(false);
      return;
    }
    let isMounted = true;
    const token = localStorage.getItem('apex_token');
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['x-apex-token'] = token;
    }
    fetch('/api/auth/me', { credentials: 'include', headers })
      .then(r => r.ok ? r.json() : { user: null })
      .then(d => {
        if (!isMounted) return;
        if (d.user) {
          setSession(d.user);
          try {
            localStorage.setItem('apex_admin_user', JSON.stringify(d.user));
          } catch {}
        } else {
          try {
            const cached = localStorage.getItem('apex_admin_user');
            if (!cached) setSession(null);
          } catch {}
        }
        setIsVerifying(false);
      })
      .catch(() => {
        if (isMounted) setIsVerifying(false);
      });
    return () => { isMounted = false; };
  }, [user]);
  const nav = [
    { id: 'books', label: 'Company books', icon: BookOpen, group: 'ACCOUNTING', allowed: true },
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard, group: 'WORKSPACE', allowed: true },
    { id: 'sales', label: 'Sales documents', icon: Receipt, group: 'SELL', allowed: can(session,'sales') },
    { id: 'customers', label: 'Customers', icon: Users, group: 'SELL', allowed: can(session,'sales') },
    { id: 'purchases', label: 'Purchase documents', icon: Truck, group: 'BUY', allowed: can(session,'purchases') },
    { id: 'suppliers', label: 'Suppliers', icon: Building2, group: 'BUY', allowed: can(session,'purchases') },
    { id: 'banking', label: 'Banking & settlements', icon: Landmark, group: 'ACCOUNTS', allowed: can(session,'banking') },
    { id: 'ledger', label: 'General ledger', icon: BookOpen, group: 'ACCOUNTS', allowed: can(session,'reports') },
    { id: 'reports', label: 'Reports', icon: BarChart3, group: 'ACCOUNTS', allowed: can(session,'reports') },
    ...(onManagementNavigate ? [
      { id: 'products', label: 'Products & pricing', icon: Package, group: 'STORE MANAGEMENT', allowed: can(session,'inventory') },
      { id: 'categories', label: 'Categories & brands', icon: Tags, group: 'STORE MANAGEMENT', allowed: can(session,'inventory') },
      { id: 'attributes', label: 'Product attributes', icon: SlidersHorizontal, group: 'STORE MANAGEMENT', allowed: can(session,'inventory') },
      { id: 'games', label: 'Bottleneck Games', icon: Gamepad2, group: 'STORE MANAGEMENT', allowed: can(session,'inventory') },
      { id: 'orders', label: 'Orders & fulfillment', icon: ShoppingCart, group: 'STORE MANAGEMENT', allowed: can(session,'orders') },
      { id: 'settings', label: 'Store settings', icon: Store, group: 'STORE MANAGEMENT', allowed: can(session,'settings') },
      { id: 'users', label: 'Users & administrators', icon: UserCog, group: 'OWNER', allowed: session?.isOwner === true },
    ] : []),
    { id: 'access', label: 'Administrator access', icon: ShieldCheck, group: 'OWNER', allowed: session?.isOwner === true },
    { id: 'controls', label: 'Period & audit controls', icon: Settings2, group: 'OWNER', allowed: session?.isOwner === true },
  ].filter(n => n.allowed);
  const managementIds = ['products','categories','attributes','games','orders','settings','users'];
  useEffect(() => { if (!managementModule && managementIds.includes(active)) setActive('dashboard'); }, [managementModule]);
  const selectedModule = managementModule || active;
  const safeActive = nav.some(n => n.id === selectedModule) ? selectedModule : 'dashboard';
  const navigate = (id: string) => {
    setActive(id);
    onManagementNavigate?.(managementIds.includes(id) ? id : undefined);
  };
  if (!session) {
    if (isVerifying) {
      return (
        <div className="p-12 flex flex-col items-center justify-center min-h-[300px] text-center space-y-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-slate-300">Connecting to ERP session…</p>
        </div>
      );
    }
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[340px] text-center space-y-4 bg-slate-900/60 border border-white/10 rounded-3xl max-w-lg mx-auto my-8">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-white">Administrator Access Required</h3>
        <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
          Please sign in with your store owner or administrator credentials to view and manage company books, inventory, and ledgers.
        </p>
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={() => onManagementNavigate?.('login')}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all active:scale-95"
          >
            Sign In as Administrator
          </button>
        </div>
      </div>
    );
  }
  return <div className="text-white space-y-4">
    <div className="rounded-2xl border border-white/10 bg-slate-900 p-4 flex flex-wrap gap-3 items-center justify-between"><div><p className="text-xs font-bold tracking-widest text-amber-400">APEX ERP SUITE</p><h1 className="text-lg font-bold mt-1">Store & accounting workspace</h1></div><div className="text-right"><p className="text-sm">{session.fullName}</p><p className="text-xs text-slate-400">{session.isOwner ? 'Owner · full control' : 'Access managed by owner'}</p></div></div>
    <div className="flex flex-col lg:flex-row gap-5 items-start">
      <nav aria-label="Suite navigation" className="w-full lg:w-56 lg:shrink-0 bg-slate-900/70 border border-white/10 rounded-2xl p-3 lg:sticky lg:top-0 lg:max-h-[72vh] lg:overflow-y-auto"><div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">{nav.map((n,i) => <React.Fragment key={n.id}>{(i === 0 || nav[i-1].group !== n.group) && <p className="hidden lg:block text-[10px] tracking-widest text-slate-500 px-3 pt-4 pb-2">{n.group}</p>}<button onClick={() => navigate(n.id)} aria-current={safeActive === n.id ? 'page' : undefined} className={`flex items-center gap-2 px-3 py-3 rounded-xl text-sm text-left whitespace-nowrap transition-colors ${safeActive === n.id ? 'bg-amber-500 text-slate-950 font-semibold' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}><n.icon className="w-4 h-4 shrink-0"/>{n.label}</button></React.Fragment>)}</div></nav>
      <main className="min-w-0 w-full">{safeActive === 'books' ? <BooksWorkspace/> : managementIds.includes(safeActive) ? <section><h2 className="text-2xl font-bold mb-5">{nav.find(n => n.id === safeActive)?.label}</h2>{children}</section> : safeActive === 'access' ? <AccessControl/> : <LinkedWorkspace view={safeActive as any} user={session} products={products} navigate={navigate}/>}</main>
    </div>
  </div>;
};
