import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, FileText, Eye, Pencil, Trash2, ArrowRight } from 'lucide-react';
import Toast from '../components/Toast.jsx';

const STATUS_STYLES = {
  draft:     'bg-gray-100 text-gray-600',
  sent:      'bg-blue-100 text-blue-700',
  viewed:    'bg-purple-100 text-purple-700',
  approved:  'bg-green-100 text-green-700',
  declined:  'bg-red-100 text-red-700',
  converted: 'bg-emerald-100 text-emerald-700'
};

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[status] || STATUS_STYLES.draft}`}>
      {status}
    </span>
  );
}

function fmt(n) { return `$${parseFloat(n || 0).toFixed(2)}`; }
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: '2-digit' });
}

export default function Estimates() {
  const [estimates, setEstimates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState(null);
  const [toast, setToast] = useState(null);

  const load = () => {
    fetch('/api/estimates')
      .then(r => r.json())
      .then(data => { setEstimates(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`/api/estimates/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      setDeleteId(null);
      load();
      setToast({ message: 'Estimate deleted', type: 'success' });
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estimates</h1>
          <p className="text-gray-500 mt-1">{estimates.length} estimate{estimates.length !== 1 ? 's' : ''}</p>
        </div>
        <Link
          to="/estimates/new"
          className="flex items-center gap-2 bg-[#F97316] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
        >
          <Plus className="w-4 h-4" /> New Estimate
        </Link>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-20 text-center">
          <div className="w-8 h-8 border-2 border-[#F97316] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading estimates...</p>
        </div>
      ) : estimates.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-20 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-700 font-medium mb-1">No estimates yet</p>
          <p className="text-gray-400 text-sm mb-4">Create your first estimate to get started.</p>
          <Link to="/estimates/new" className="bg-[#F97316] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors">
            New Estimate
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Estimate #</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Customer</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Job Description</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Valid Until</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Total</th>
                  <th className="w-28" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {estimates.map(est => (
                  <tr key={est.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-medium text-gray-900">{est.estimate_number}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {est.customers?.name || <span className="text-gray-400">No customer</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs">
                      <span className="line-clamp-1">{est.job_description || <span className="text-gray-400">—</span>}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(est.estimate_date || est.created_at)}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(est.valid_until)}</td>
                    <td className="px-4 py-3"><StatusBadge status={est.status} /></td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{fmt(est.total)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {est.converted_invoice_id && (
                          <Link
                            to={`/invoices/${est.converted_invoice_id}/edit`}
                            className="p-1.5 text-emerald-500 hover:text-emerald-700 rounded"
                            title="View Invoice"
                          >
                            <ArrowRight className="w-4 h-4" />
                          </Link>
                        )}
                        <Link to={`/estimates/${est.id}/edit`} className="p-1.5 text-gray-400 hover:text-gray-700 rounded" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => setDeleteId(est.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-semibold text-gray-900 mb-2">Delete Estimate?</h3>
            <p className="text-sm text-gray-500 mb-5">This will permanently delete the estimate and all its line items.</p>
            <div className="flex gap-3">
              <button onClick={() => handleDelete(deleteId)} className="flex-1 bg-red-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-600">Delete</button>
              <button onClick={() => setDeleteId(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
