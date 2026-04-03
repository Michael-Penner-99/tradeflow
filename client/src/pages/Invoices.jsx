import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, FileText, Eye, Pencil, Trash2, Upload, Loader2 } from 'lucide-react';
import Toast from '../components/Toast.jsx';
import { apiFetch } from '../lib/api.js';

const STATUS_STYLES = {
  draft:    'bg-gray-100 text-gray-600',
  sent:     'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  paid:     'bg-emerald-100 text-emerald-700'
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
  return new Date(d).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: '2-digit' });
}

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState(null);
  const [toast, setToast] = useState(null);
  const [qbConnected, setQbConnected] = useState(false);
  const [syncingId, setSyncingId] = useState(null);

  const load = () => {
    apiFetch('/api/invoices')
      .then(r => r.json())
      .then(data => { setInvoices(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    apiFetch('/api/quickbooks/status').then(r => r.json())
      .then(data => setQbConnected(data.connected))
      .catch(() => {});
  }, []);

  const handleSyncToQBO = async (id) => {
    setSyncingId(id);
    try {
      const res = await apiFetch(`/api/quickbooks/export/${id}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setToast({ message: `Synced to QuickBooks (ID: ${data.qbInvoiceId})`, type: 'success' });
    } catch (err) {
      setToast({ message: `QBO sync failed: ${err.message}`, type: 'error' });
    } finally {
      setSyncingId(null);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await apiFetch(`/api/invoices/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      setDeleteId(null);
      load();
      setToast({ message: 'Invoice deleted', type: 'success' });
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-500 mt-1">{invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</p>
        </div>
        <Link
          to="/invoices/new"
          className="flex items-center gap-2 bg-[#F97316] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
        >
          <Plus className="w-4 h-4" /> New Invoice
        </Link>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-20 text-center">
          <div className="w-8 h-8 border-2 border-[#F97316] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading invoices...</p>
        </div>
      ) : invoices.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-20 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-700 font-medium mb-1">No invoices yet</p>
          <p className="text-gray-400 text-sm mb-4">Create your first invoice to get started.</p>
          <Link to="/invoices/new" className="bg-[#F97316] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors">
            New Invoice
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Invoice #</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Customer</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Job Description</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Total</th>
                  <th className="w-36" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-medium text-gray-900">{inv.invoice_number}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {inv.customers?.name || <span className="text-gray-400">No customer</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs">
                      <span className="line-clamp-1">{inv.job_description || <span className="text-gray-400">—</span>}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {fmtDate(inv.invoice_date || inv.created_at)}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{fmt(inv.total)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link to={`/invoices/${inv.id}/view`} className="p-1.5 text-gray-400 hover:text-gray-700 rounded" title="View">
                          <Eye className="w-4 h-4" />
                        </Link>
                        <Link to={`/invoices/${inv.id}/edit`} className="p-1.5 text-gray-400 hover:text-gray-700 rounded" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </Link>
                        {qbConnected && (
                          <button
                            onClick={() => handleSyncToQBO(inv.id)}
                            disabled={syncingId === inv.id}
                            className="p-1.5 text-gray-400 hover:text-green-600 rounded disabled:opacity-50"
                            title="Sync to QuickBooks"
                          >
                            {syncingId === inv.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteId(inv.id)}
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
            <h3 className="font-semibold text-gray-900 mb-2">Delete Invoice?</h3>
            <p className="text-sm text-gray-500 mb-5">This will permanently delete the invoice and all its line items.</p>
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
