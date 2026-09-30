import React, { useState, useEffect } from 'react';
import { X, User, Mail, Phone, MapPin, Shield, LogOut, Package, KeyRound, AlertCircle, CheckCircle, Truck, Download, Lock } from 'lucide-react';
import { UserAccount, Order } from '../types';
import { formatPkr, formatDateTime } from '../utils/formatters';
import { generateOrderInvoicePdf } from '../utils/generateInvoicePdf';

interface UserAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount | null;
  setCurrentUser: (user: UserAccount | null) => void;
  onOpenAdmin: () => void;
  onOpenTracking?: (trackNo?: string, courierCode?: string) => void;
}

export const UserAccountModal: React.FC<UserAccountModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  setCurrentUser,
  onOpenAdmin,
  onOpenTracking,
}) => {
  const [tab, setTab] = useState<'profile' | 'orders' | 'login' | 'register'>('profile');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authCity, setAuthCity] = useState('');
  const [authAddress, setAuthAddress] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editAddress, setEditAddress] = useState('');

  useEffect(() => {
    if (!currentUser) {
      setTab('login');
      setIsEditingProfile(false);
    } else {
      setTab('profile');
      setEditName(currentUser.fullName || '');
      setEditPhone(currentUser.phone || '');
      setEditCity(currentUser.city || 'Lahore');
      setEditAddress(currentUser.address || '');
      loadOrders();
    }
    setAuthError(null);
    setAuthSuccess(null);
  }, [currentUser, isOpen]);

  const loadOrders = async () => {
    setLoadingOrders(true);
    try {
      const token = localStorage.getItem('apex_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const params = new URLSearchParams();
      if (currentUser?.id) params.set('userId', currentUser.id);
      if (currentUser?.email) params.set('email', currentUser.email);
      if (currentUser?.phone) params.set('phone', currentUser.phone);

      const url = `/api/orders${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url, { headers });
      if (res.ok) {
        const orders: Order[] = await res.json();
        if (currentUser) {
          const userEmail = (currentUser.email || '').trim().toLowerCase();
          const userPhone = (currentUser.phone || '').replace(/[^0-9]/g, '');
          const userId = currentUser.id;

          const userSpecific = orders.filter((o) => {
            if (o.userId && o.userId === userId) return true;
            if (userEmail && o.customer?.email?.trim().toLowerCase() === userEmail) return true;
            if (userPhone && o.customer?.phone) {
              const orderPhone = o.customer.phone.replace(/[^0-9]/g, '');
              if (orderPhone && (orderPhone === userPhone || orderPhone.endsWith(userPhone) || userPhone.endsWith(orderPhone))) {
                return true;
              }
            }
            return false;
          });
          setUserOrders(userSpecific.length > 0 ? userSpecific : orders);
        } else {
          setUserOrders(orders);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoadingOrders(false);
    }
  };

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    setAuthSuccess(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrUsername: authEmail, password: authPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed. Please check credentials.');
      }

      if (data.token) {
        localStorage.setItem('apex_token', data.token);
      }
      if (data.user) {
        localStorage.setItem('apex_user', JSON.stringify(data.user));
        if (data.user.role === 'admin') {
          localStorage.setItem('apex_admin_user', JSON.stringify(data.user));
        }
        setCurrentUser(data.user);
      }
      onClose();
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authName.trim() || !authEmail.trim() || !authPassword.trim() || !authPhone.trim() || !authCity.trim() || !authAddress.trim()) {
      setAuthError('Please fill in all registration fields: Full Name, Email, Password, Phone, City, and Delivery Address.');
      return;
    }

    setAuthLoading(true);
    setAuthError(null);
    setAuthSuccess(null);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: authName.trim(),
          email: authEmail.trim(),
          password: authPassword.trim(),
          phone: authPhone.trim(),
          city: authCity.trim(),
          address: authAddress.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      if (data.token) {
        localStorage.setItem('apex_token', data.token);
      }
      if (data.user) {
        localStorage.setItem('apex_user', JSON.stringify(data.user));
        setCurrentUser(data.user);
      }
      onClose();
    } catch (err: any) {
      setAuthError(err.message || 'Registration failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!editName.trim() || !editPhone.trim() || !editCity.trim() || !editAddress.trim()) {
      setAuthError('Full Name, Phone Number, City, and Delivery Address are required.');
      return;
    }

    setAuthLoading(true);
    setAuthError(null);
    setAuthSuccess(null);

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentUser.id,
          email: currentUser.email,
          fullName: editName.trim(),
          phone: editPhone.trim(),
          city: editCity.trim(),
          address: editAddress.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      if (data.user) {
        localStorage.setItem('apex_user', JSON.stringify(data.user));
        setCurrentUser(data.user);
        setIsEditingProfile(false);
        setAuthSuccess('Delivery & profile details updated successfully!');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Failed to update profile');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('apex_token');
    localStorage.removeItem('apex_user');
    localStorage.removeItem('apex_admin_user');
    setCurrentUser(null);
    window.dispatchEvent(new Event('apex:logout'));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {currentUser ? `Welcome, ${currentUser.fullName}` : 'Customer Account & Login'}
              </h2>
              <p className="text-xs text-slate-400">
                {currentUser ? currentUser.email : 'Sign in to track orders and save builds'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation if logged in */}
        {currentUser && (
          <div className="flex border-b border-slate-800 bg-slate-900/50 px-6">
            <button
              onClick={() => setTab('profile')}
              className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
                tab === 'profile'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              Account Details
            </button>
            <button
              onClick={() => setTab('orders')}
              className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
                tab === 'orders'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              My Orders ({userOrders.length})
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6">
          {authError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {authSuccess && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{authSuccess}</span>
            </div>
          )}

          {/* Profile View */}
          {currentUser && tab === 'profile' && (
            <div className="space-y-5">
              {!isEditingProfile ? (
                <div className="bg-slate-800/50 border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-700/50">
                    <span className="text-slate-300 font-bold flex items-center gap-2">
                      <Truck className="w-4 h-4 text-emerald-400" /> Default Shipping & Delivery Details
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEditingProfile(true)}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-[11px] font-semibold transition-colors"
                    >
                      Edit Delivery Details
                    </button>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-700/50">
                    <span className="text-slate-400 flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-500" /> Full Name
                    </span>
                    <span className="font-semibold text-white">{currentUser.fullName}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-slate-700/50">
                    <span className="text-slate-400 flex items-center gap-2">
                      <Mail className="w-4 h-4 text-slate-500" /> Email Address
                    </span>
                    <span className="font-semibold text-white">{currentUser.email}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-slate-700/50">
                    <span className="text-slate-400 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-slate-500" /> Phone Number
                    </span>
                    <span className="font-semibold text-white">{currentUser.phone || 'Not provided'}</span>
                  </div>
                  <div className="flex items-start justify-between py-1 border-b border-slate-700/50">
                    <span className="text-slate-400 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-slate-500" /> Delivery Address
                    </span>
                    <span className="font-semibold text-white text-right max-w-[280px]">
                      {currentUser.city ? `${currentUser.city} • ` : ''}{currentUser.address || 'Not provided'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-400 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-slate-500" /> Account Role
                    </span>
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                      {currentUser.role}
                    </span>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleUpdateProfile} className="bg-slate-800/50 border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-700/50">
                    <span className="text-white font-bold flex items-center gap-2">
                      <Truck className="w-4 h-4 text-indigo-400" /> Edit Delivery & Profile Info
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEditingProfile(false)}
                      className="text-slate-400 hover:text-white text-xs underline"
                    >
                      Cancel
                    </button>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">Phone Number *</label>
                      <input
                        type="tel"
                        required
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">City *</label>
                      <input
                        type="text"
                        required
                        value={editCity}
                        onChange={(e) => setEditCity(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Complete Delivery Address *</label>
                    <textarea
                      required
                      rows={2}
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingProfile(false)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={authLoading}
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold"
                    >
                      {authLoading ? 'Saving...' : 'Save Delivery Details'}
                    </button>
                  </div>
                </form>
              )}

              {currentUser.role === 'admin' && (
                <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-800/40 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-indigo-200">Staff & Management Access</h4>
                    <p className="text-[11px] text-indigo-400">Launch ERP inventory & product editing dashboard</p>
                  </div>
                  <button
                    onClick={onOpenAdmin}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-md transition-colors"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    Open ERP Portal
                  </button>
                </div>
              )}

              <div className="pt-2 flex justify-between items-center">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-red-500/20 text-slate-300 hover:text-red-400 border border-slate-700 text-xs font-medium transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          )}

          {/* Orders View */}
          {currentUser && tab === 'orders' && (
            <div className="space-y-3">
              {loadingOrders ? (
                <p className="text-xs text-slate-400 py-8 text-center">Loading orders...</p>
              ) : userOrders.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">No past orders found for this account.</p>
                </div>
              ) : (
                userOrders.map((o) => (
                  <div key={o.id} className="p-3.5 bg-slate-800/50 border border-slate-800 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white">#{o.orderNumber || o.id.slice(0, 8)}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {o.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Date: {formatDateTime(o.createdAt)} • {o.items?.length || 0} items
                    </div>
                    {o.trackingNumber && (
                      <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] flex items-center justify-between">
                        <span className="text-slate-400 font-mono">
                          {o.courierName ? `${o.courierName}: ` : 'Tracking: '}
                          <strong className="text-slate-200">{o.trackingNumber}</strong>
                        </span>
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-700/60 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">Total:</span>
                        <span className="font-bold text-emerald-400">{formatPkr(o.total)}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {onOpenTracking && (
                          <button
                            type="button"
                            onClick={() => {
                              onOpenTracking(o.trackingNumber || o.orderNumber, o.courierName);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                          >
                            <Truck className="w-3 h-3 text-amber-400" />
                            <span>Track</span>
                          </button>
                        )}

                        {(o.status || '').toLowerCase() === 'delivered' ? (
                          <button
                            type="button"
                            onClick={() => generateOrderInvoicePdf(o)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] flex items-center gap-1 shadow-md transition-colors"
                            title="Download Official Invoice & Warranty Bill"
                          >
                            <Download className="w-3 h-3" />
                            <span>Download Bill</span>
                          </button>
                        ) : (
                          <span
                            className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-500 text-[10px] font-medium flex items-center gap-1"
                            title="Official bill is accessible once order is marked as Delivered by store owner"
                          >
                            <Lock className="w-2.5 h-2.5 text-slate-500" />
                            <span>Bill Locked (Delivered Only)</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Login Form */}
          {!currentUser && tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Email or Username</label>
                <input
                  type="text"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="Your email or username"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs shadow-lg transition-all"
              >
                {authLoading ? 'Signing in...' : 'Sign In'}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setTab('register')}
                  className="text-xs text-indigo-400 hover:underline"
                >
                  Don't have an account? Register here
                </button>
              </div>
            </form>
          )}

          {/* Register Form */}
          {!currentUser && tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div className="p-3 bg-indigo-950/40 border border-indigo-800/40 rounded-xl text-xs text-indigo-200 flex items-start gap-2">
                <Truck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span>
                  Provide your complete contact & delivery details. They will be saved to your account and automatically pre-filled whenever you checkout.
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  placeholder="e.g. Ali Raza"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="e.g. ali.raza@gmail.com"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Password * (min 6 chars)</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={authPhone}
                    onChange={(e) => setAuthPhone(e.target.value)}
                    placeholder="e.g. 0300-1234567"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">City *</label>
                  <input
                    type="text"
                    required
                    value={authCity}
                    onChange={(e) => setAuthCity(e.target.value)}
                    placeholder="e.g. Lahore, Karachi, Rawalpindi"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Complete Delivery Address *</label>
                <textarea
                  required
                  rows={2}
                  value={authAddress}
                  onChange={(e) => setAuthAddress(e.target.value)}
                  placeholder="e.g. House 24, Street 5, Phase 5 DHA"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-xs shadow-lg transition-all"
              >
                {authLoading ? 'Creating Account...' : 'Register & Save Delivery Details'}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setTab('login')}
                  className="text-xs text-indigo-400 hover:underline"
                >
                  Already have an account? Sign in
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
