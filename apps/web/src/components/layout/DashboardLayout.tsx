import React, { useState } from 'react';
import { Outlet, Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useWallet } from '../../context/WalletContext';
import { SiLogo } from '../common/SiLogo';
import { PageTransition } from '../common/animations/PageTransition';
import { BottomNav } from './BottomNav';
import { ChatAssistant } from '../chatbot/ChatAssistant';
import {
  LayoutDashboard,
  PieChart,
  Activity,
  Wallet,
  Bell,
  HelpCircle,
  Settings,
  Shield,
  LogOut,
  Menu,
  X,
  ExternalLink,
  ShieldCheck,
  ShoppingBag,
  TrendingUp,
  User,
  Sparkles,
  Banknote,
  Send,
  CreditCard,
  Receipt,
} from 'lucide-react';

export const DashboardLayout: React.FC = () => {
  const { user, isLoading, logout, isStaff } = useAuth();
  const { coinBalance, referencePriceUsd, ratesLoaded } = useWallet();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7FAFF] text-[#64748B]">
        <img src="/logo.png" alt="Loading" className="w-14 h-14 animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Staff accounts work in the admin portal only; there is no second, customer-style workspace for them.
  if (isStaff) {
    return <Navigate to="/admin" replace />;
  }

  const menuItems = [
    { label: 'Overview', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Buy SIcoinX', path: '/dashboard/buy', icon: ShoppingBag, special: true },
    { label: 'Sell & Withdraw', path: '/dashboard/sell', icon: Banknote },
    { label: 'Ecosystem Transfers', path: '/dashboard/transfers', icon: Send },
    { label: 'Transactions', path: '/dashboard/transactions', icon: Receipt },
    { label: 'Payment History', path: '/dashboard/payments', icon: CreditCard },
    { label: 'Identity KYC', path: '/dashboard/kyc', icon: ShieldCheck },
    { label: 'Wallets & Balance', path: '/dashboard/wallets', icon: Wallet },
    { label: 'Customer Support', path: '/dashboard/support', icon: HelpCircle },
    { label: 'Security & 2FA', path: '/dashboard/security', icon: Shield },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path: string) => {
    if (path === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname.startsWith(path);
  };

  // The bottom padding reserves room for the fixed BottomNav, so it never covers
  // the sidebar footer (Sign Out) or the end of the page.
  return (
    <div className="h-[100dvh] flex overflow-hidden bg-[#F7FAFF] text-[#10213A] pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      {/* Desktop Sidebar: fixed to the viewport height, scrolls on its own */}
      <aside className="hidden lg:flex flex-col w-64 h-full border-r border-[#DFE8F5] bg-white flex-shrink-0">
        <div className="flex-shrink-0 p-6 pb-4 space-y-5">
          <div className="transition-transform duration-200 hover:scale-[1.02]">
            <SiLogo size="md" />
          </div>

          {/* User Brief Card */}
          <Link
            to="/dashboard/profile"
            className="p-3.5 rounded-2xl bg-[#F7FAFF] border border-[#DFE8F5] flex items-center gap-3 transition-all duration-200 hover:border-[#175CFF]/40 hover:bg-[#EDF4FF]/50 group"
          >
            <div className="w-10 h-10 rounded-full bg-[#175CFF] text-white flex items-center justify-center font-bold text-sm shadow-xs group-hover:scale-105 transition-transform">
              {user.name.charAt(0)}
            </div>
            <div className="overflow-hidden min-w-0 flex-1">
              <span className="font-bold text-xs text-[#10213A] truncate block group-hover:text-[#175CFF] transition-colors">{user.name}</span>
              <span className="text-[11px] text-[#64748B] truncate block">{coinBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} SI</span>
            </div>
          </Link>
        </div>

        {/* Navigation Links: the only part of the sidebar that scrolls */}
        <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-6 py-1 space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors duration-200 ${
                    active
                      ? 'bg-[#175CFF] text-white shadow-elevated'
                      : item.special
                      ? 'text-[#175CFF] bg-[#EDF4FF] hover:bg-[#DFE8F5] font-bold'
                      : 'text-[#64748B] hover:text-[#10213A] hover:bg-[#F7FAFF]'
                  }`}
                >
                  <Icon className={`w-4 h-4 transition-transform duration-200 ${active ? 'text-white' : item.special ? 'text-[#175CFF]' : 'text-[#64748B]'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
        </nav>

        {/* Bottom Actions: always visible */}
        <div className="flex-shrink-0 p-6 pt-4 border-t border-[#DFE8F5] space-y-2">
          <Link
            to="/"
            className="flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold text-[#64748B] hover:text-[#10213A] hover:bg-[#F7FAFF] transition-all duration-200"
          >
            <span>Public Website</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-[#DC2626] hover:bg-red-50 transition-all duration-200 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-18 flex-shrink-0 bg-white border-b border-[#DFE8F5] px-4 sm:px-8 flex items-center justify-between gap-4 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="p-2 rounded-lg text-[#10213A] hover:bg-[#F7FAFF] lg:hidden active:scale-95 transition-transform cursor-pointer"
              aria-label="Open Navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:block">
              <h2 className="text-sm font-bold text-[#10213A]">SI Coin Web Workspace</h2>
              <p className="text-[11px] text-[#64748B]">Verifiable Digital Asset Application</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Ticker Pill */}
            {ratesLoaded && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#EDF4FF] border border-[#DFE8F5] text-xs font-semibold text-[#123B9A] shadow-xs">
                <span className="w-2 h-2 rounded-full bg-[#15803D] animate-ping" />
                <span>1 SI = ${referencePriceUsd.toFixed(4)} USD</span>
              </div>
            )}

            {/* Quick Buy CTA Header Button */}
            <Link
              to="/dashboard/purchase"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#123B9A] to-[#175CFF] text-white text-xs font-bold shadow-xs hover:scale-105 active:scale-95 transition-all"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Buy SI</span>
            </Link>

            {/* Wallet Balance Pill */}
            <Link
              to="/dashboard/wallets"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#DFE8F5] text-xs font-bold text-[#10213A] hover:border-[#175CFF] hover:text-[#175CFF] bg-[#F7FAFF] transition-all duration-200"
            >
              <Wallet className="w-3.5 h-3.5 text-[#175CFF]" />
              <span className="font-mono">{coinBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} SI</span>
            </Link>

            {/* Notification Bell */}
            <Link
              to="/dashboard/notifications"
              className="p-2 rounded-xl border border-[#DFE8F5] text-[#64748B] hover:text-[#175CFF] hover:bg-[#F7FAFF] relative transition-all duration-200 active:scale-95"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#175CFF] animate-pulse" />
            </Link>

            {/* Profile Avatar Shortcut */}
            <Link
              to="/dashboard/profile"
              className="w-8 h-8 rounded-full bg-[#175CFF] text-white flex items-center justify-center font-bold text-xs hover:ring-2 hover:ring-[#175CFF]/30 transition-all"
              title="View Profile"
            >
              {user.name.charAt(0)}
            </Link>
          </div>
        </header>

        {/* Content Body - with bottom padding for fixed BottomNav */}
        <main data-scroll-root className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <div className="p-4 sm:p-8 max-w-7xl w-full mx-auto">
            <PageTransition>
              <Outlet />
            </PageTransition>
          </div>
        </main>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs animate-fade-in"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative flex flex-col w-72 max-w-[85vw] h-full bg-white z-10 shadow-2xl animate-fade-in">
            <div className="flex-shrink-0 p-5 pb-3 space-y-5">
              <div className="flex items-center justify-between">
                <SiLogo size="md" />
                <button
                  onClick={() => setMobileSidebarOpen(false)}
                  className="p-1 rounded-lg text-[#64748B] hover:text-[#10213A]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* User Identity in Drawer */}
              <Link
                to="/dashboard/profile"
                onClick={() => setMobileSidebarOpen(false)}
                className="p-3 rounded-2xl bg-[#F7FAFF] border border-[#DFE8F5] flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-full bg-[#175CFF] text-white flex items-center justify-center font-bold text-xs">
                  {user.name.charAt(0)}
                </div>
                <div className="overflow-hidden min-w-0">
                  <span className="font-bold text-xs text-[#10213A] block truncate">{user.name}</span>
                  <span className="text-[10px] text-[#175CFF] font-semibold">{coinBalance.toFixed(2)} SI</span>
                </div>
              </Link>
            </div>

            <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-5 py-1 space-y-1">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileSidebarOpen(false)}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                        active
                          ? 'bg-[#175CFF] text-white shadow-xs'
                          : item.special
                          ? 'text-[#175CFF] bg-[#EDF4FF] font-bold'
                          : 'text-[#64748B] hover:text-[#10213A]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
            </nav>

            <div className="flex-shrink-0 p-5 pt-3 border-t border-[#DFE8F5] space-y-2">
              <Link
                to="/"
                onClick={() => setMobileSidebarOpen(false)}
                className="flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold text-[#64748B] hover:text-[#10213A] hover:bg-[#F7FAFF]"
              >
                <span>Public Website</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-[#DC2626] hover:bg-red-50"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Web Application Bottom Navigation Bar */}
      <BottomNav />

      <ChatAssistant />
    </div>
  );
};
