import { Link, Navigate } from 'react-router-dom';
import { Wrench, FileText, Package, Calendar, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';

const features = [
  {
    icon: FileText,
    title: 'Invoices & Estimates',
    desc: 'Create professional invoices and estimates. Send them to customers for approval in one click.',
  },
  {
    icon: Package,
    title: 'Inventory Tracking',
    desc: 'Upload supplier statements and let AI extract line items. Track stock with weighted average costing.',
  },
  {
    icon: Calendar,
    title: 'Job Scheduling',
    desc: 'Keep your calendar organized with job bookings, deadlines, and follow-ups all in one place.',
  },
];

export default function Landing() {
  const { session, loading } = useAuth();
  if (!loading && session) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-[#0F172A]">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="bg-[#F97316] p-2 rounded-lg">
            <Wrench className="w-5 h-5 text-white" />
          </div>
          <span className="text-white text-xl font-bold tracking-tight">TradeFlow</span>
        </div>
        <Link
          to="/login"
          className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
        >
          Sign In
        </Link>
      </nav>

      {/* Hero */}
      <section className="px-6 pt-16 pb-20 max-w-3xl mx-auto text-center">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight">
          Run your trades business
          <br />
          <span className="text-[#F97316]">without the paperwork</span>
        </h1>
        <p className="mt-4 text-lg text-slate-400 max-w-xl mx-auto">
          Invoices, estimates, inventory, and scheduling — built for plumbers,
          electricians, and every trade in between.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/login"
            className="inline-flex items-center justify-center gap-2 bg-[#F97316] hover:bg-orange-600
                       text-white font-semibold px-6 py-3 rounded-xl text-sm transition-colors"
          >
            Get Started <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center justify-center gap-2 border border-slate-600
                       hover:border-slate-400 text-slate-300 hover:text-white font-semibold
                       px-6 py-3 rounded-xl text-sm transition-colors"
          >
            Sign In
          </Link>
        </div>
      </section>

      {/* Feature cards */}
      <section className="px-6 pb-20 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {features.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6"
            >
              <div className="bg-[#F97316]/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Icon className="w-6 h-6 text-[#F97316]" />
              </div>
              <h3 className="font-semibold text-white mb-2">{title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 px-6 py-6 text-center">
        <p className="text-xs text-slate-500">TradeFlow v1.0 &middot; Built for the trades</p>
      </footer>
    </div>
  );
}
