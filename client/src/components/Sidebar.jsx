import { NavLink } from 'react-router-dom';
import {
  Wrench,
  LayoutDashboard,
  Upload,
  Package,
  FileText,
  ClipboardList,
  Users,
  Calendar,
  Settings,
  LogOut
} from 'lucide-react';
import NotificationBell from './NotificationBell.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';

const navItems = [
  { label: 'Dashboard',        icon: LayoutDashboard, to: '/dashboard', end: true, enabled: true },
  { label: 'Upload Statement', icon: Upload,           to: '/upload',    enabled: true },
  { label: 'Inventory',        icon: Package,          to: '/inventory', enabled: true },
  { label: 'Invoices',         icon: FileText,         to: '/invoices',  enabled: true },
  { label: 'Estimates',        icon: ClipboardList,    to: '/estimates', enabled: true },
  { label: 'Customers',        icon: Users,            to: '/customers', enabled: true },
  { label: 'Calendar',         icon: Calendar,         to: '/calendar',  enabled: true },
  { label: 'Settings',         icon: Settings,         to: '/settings',  enabled: true }
];

export default function Sidebar() {
  const { signOut } = useAuth();

  return (
    <aside className="w-64 flex-shrink-0 bg-[#0F172A] flex flex-col h-screen">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-700">
        <div className="bg-[#F97316] p-2 rounded-lg">
          <Wrench className="w-5 h-5 text-white" />
        </div>
        <span className="text-white text-xl font-bold tracking-tight">TradeFlow</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ label, icon: Icon, to, end, enabled }) => {
          if (!enabled) {
            return (
              <div key={label}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-500 cursor-not-allowed select-none">
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium">{label}</span>
                <span className="ml-auto text-xs bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded">Soon</span>
              </div>
            );
          }
          return (
            <NavLink key={label} to={to} end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-[#F97316] text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span>{label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-slate-700 flex items-center justify-between">
        <div>
          <p className="text-slate-500 text-xs">TradeFlow v1.0</p>
          <p className="text-slate-600 text-xs mt-0.5">Plumbing & Trades</p>
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <button
            onClick={signOut}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
