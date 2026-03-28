import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react';

const fmt = (n) => `$${parseFloat(n || 0).toFixed(2)}`;
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function EstimateApproval() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [responding, setResponding] = useState(false);
  const [result, setResult] = useState(null); // 'approved' | 'declined'

  useEffect(() => {
    fetch(`/api/public/estimates/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setData(d);
        // Already responded
        if (['approved', 'declined', 'converted'].includes(d.status)) {
          setResult(d.status === 'declined' ? 'declined' : 'approved');
        }
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [token]);

  const respond = async (action) => {
    setResponding(true);
    try {
      const res = await fetch(`/api/public/estimates/${token}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setResult(d.status);
    } catch (err) {
      setError(err.message);
    } finally {
      setResponding(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#F97316]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-xl text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Estimate Not Found</h2>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const { estimate_number, job_description, valid_until, total, gst_enabled, pst_rate, subtotal, line_items = [], settings = {}, customers } = data;

  // Collapse grouped items
  const displayItems = [];
  const seenGroups = new Set();
  for (const item of line_items) {
    if (!item.group_label) {
      displayItems.push({ isGroup: false, item });
    } else if (!seenGroups.has(item.group_label)) {
      seenGroups.add(item.group_label);
      const grpItems = line_items.filter(i => i.group_label === item.group_label);
      const grpTotal = grpItems.reduce((s, i) => s + (parseFloat(i.total) || 0), 0);
      displayItems.push({ isGroup: true, label: item.group_label, total: grpTotal, count: grpItems.length });
    }
  }

  const gstAmount = gst_enabled ? Math.round(parseFloat(subtotal) * 0.05 * 100) / 100 : 0;
  const pstAmount = parseFloat(pst_rate) > 0 ? Math.round(parseFloat(subtotal) * (parseFloat(pst_rate) / 100) * 100) / 100 : 0;

  if (result) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-xl text-center">
          {result === 'approved' ? (
            <>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-9 h-9 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Estimate Approved!</h2>
              <p className="text-gray-500">Thank you. We'll be in touch shortly to confirm the next steps.</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-9 h-9 text-red-400" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Estimate Declined</h2>
              <p className="text-gray-500">We've been notified. Feel free to reach out if you'd like to discuss.</p>
            </>
          )}
          {settings.phone && (
            <p className="mt-4 text-sm text-gray-500">
              Questions? Call us at <a href={`tel:${settings.phone}`} className="text-[#F97316] font-medium">{settings.phone}</a>
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Company header */}
        <div className="bg-[#0F172A] rounded-t-2xl px-8 py-6 flex items-center justify-between">
          <div>
            {settings.logo_url && (
              <img src={settings.logo_url} alt="logo" className="h-10 object-contain mb-2" />
            )}
            <div className="text-white font-bold text-lg">{settings.company_name || 'Your Company'}</div>
            {settings.phone && <div className="text-slate-400 text-sm mt-0.5">{settings.phone}</div>}
          </div>
          <div className="text-right">
            <div className="text-[#F97316] text-2xl font-extrabold uppercase tracking-wider">Estimate</div>
            <div className="text-white font-mono font-semibold mt-1">{estimate_number}</div>
          </div>
        </div>

        {/* Body */}
        <div className="bg-white rounded-b-2xl shadow-xl overflow-hidden">
          {/* Info strip */}
          <div className="px-8 py-4 bg-gray-50 border-b border-gray-100 flex flex-wrap gap-6 text-sm">
            {valid_until && (
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Valid Until</div>
                <div className="font-medium text-gray-800">{fmtDate(valid_until)}</div>
              </div>
            )}
            {customers?.name && (
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Prepared For</div>
                <div className="font-medium text-gray-800">{customers.name}</div>
              </div>
            )}
            {job_description && (
              <div className="flex-1 min-w-[200px]">
                <div className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Job Description</div>
                <div className="text-gray-700">{job_description}</div>
              </div>
            )}
          </div>

          {/* Line items */}
          <div className="px-8 py-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-[#0F172A]">
                  <th className="pb-3 text-left font-semibold text-gray-700">Description</th>
                  <th className="pb-3 text-center font-semibold text-gray-700 w-16">Qty</th>
                  <th className="pb-3 text-right font-semibold text-gray-700 w-28">Unit Price</th>
                  <th className="pb-3 text-right font-semibold text-gray-700 w-28">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayItems.length === 0 ? (
                  <tr><td colSpan={4} className="py-8 text-center text-gray-400 italic">No line items</td></tr>
                ) : displayItems.map((entry, i) =>
                  entry.isGroup ? (
                    <tr key={entry.label} className={i % 2 === 1 ? 'bg-gray-50/60' : ''}>
                      <td className="py-3 pr-4 font-medium text-gray-800">{entry.label}</td>
                      <td className="py-3 text-center text-gray-400">—</td>
                      <td className="py-3 text-right text-gray-400">—</td>
                      <td className="py-3 text-right font-medium text-gray-900">{fmt(entry.total)}</td>
                    </tr>
                  ) : (
                    <tr key={entry.item.id || i} className={i % 2 === 1 ? 'bg-gray-50/60' : ''}>
                      <td className="py-3 pr-4">
                        <div className="font-medium text-gray-800">{entry.item.description || '—'}</div>
                        {entry.item.type && entry.item.type !== 'material' && (
                          <div className="text-xs text-gray-400 capitalize">{entry.item.type.replace('_', ' ')}</div>
                        )}
                      </td>
                      <td className="py-3 text-center text-gray-600">{entry.item.quantity}</td>
                      <td className="py-3 text-right text-gray-600">{fmt(entry.item.unit_price)}</td>
                      <td className="py-3 text-right font-medium text-gray-900">{fmt(entry.item.total)}</td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="px-8 pb-6 flex justify-end">
            <div className="w-56">
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
                {gst_enabled && <div className="flex justify-between text-gray-600"><span>GST (5%)</span><span>{fmt(gstAmount)}</span></div>}
                {parseFloat(pst_rate) > 0 && <div className="flex justify-between text-gray-600"><span>PST ({pst_rate}%)</span><span>{fmt(pstAmount)}</span></div>}
              </div>
              <div className="border-t-2 border-[#0F172A] mt-3 pt-3 flex justify-between items-baseline">
                <span className="font-bold text-[#0F172A]">Total</span>
                <span className="font-extrabold text-[#F97316] text-xl">{fmt(total)}</span>
              </div>
            </div>
          </div>

          {/* Approval buttons */}
          <div className="px-8 py-6 bg-gray-50 border-t border-gray-100">
            <p className="text-sm text-gray-600 mb-4 text-center">
              Please review the estimate above and approve or decline.
            </p>
            <div className="flex gap-3 max-w-sm mx-auto">
              <button
                onClick={() => respond('approve')}
                disabled={responding}
                className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50"
              >
                {responding ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Approve
              </button>
              <button
                onClick={() => respond('decline')}
                disabled={responding}
                className="flex-1 flex items-center justify-center gap-2 border-2 border-gray-300 hover:border-red-300 hover:text-red-600 text-gray-600 py-3 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                Decline
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Powered by TradeFlow · {settings.company_name}
        </p>
      </div>
    </div>
  );
}
