import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Users } from 'lucide-react';
import SlideOver from '../components/SlideOver.jsx';
import Toast from '../components/Toast.jsx';
import { apiFetch } from '../lib/api.js';

const PROVINCES = [
  'Alberta', 'British Columbia', 'Manitoba', 'New Brunswick',
  'Newfoundland and Labrador', 'Northwest Territories', 'Nova Scotia',
  'Nunavut', 'Ontario', 'Prince Edward Island', 'Quebec', 'Saskatchewan', 'Yukon'
];

const EMPTY = {
  name: '', company_name: '', address_line1: '', city: '',
  province: '', postal_code: '', phone: '', email: ''
};

const Input = ({ label, ...props }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <input
      {...props}
      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]"
    />
  </div>
);

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [toast, setToast] = useState(null);

  const load = useCallback(() => {
    apiFetch('/api/customers')
      .then(r => r.json())
      .then(data => { setCustomers(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setForm(EMPTY); setEditId(null); setOpen(true); };
  const openEdit = (c) => { setForm(c); setEditId(c.id); setOpen(true); };
  const set = (f) => (e) => setForm(prev => ({ ...prev, [f]: e.target.value }));

  const handleSave = async () => {
    if (!form.name?.trim()) return;
    setSaving(true);
    try {
      const url = editId ? `/api/customers/${editId}` : '/api/customers';
      const method = editId ? 'PUT' : 'POST';
      const body = { ...form };
      delete body.id; delete body.created_at;
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOpen(false);
      load();
      setToast({ message: editId ? 'Customer updated' : 'Customer added', type: 'success' });
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await apiFetch(`/api/customers/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      setDeleteId(null);
      load();
      setToast({ message: 'Customer deleted', type: 'success' });
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-500 mt-1">{customers.length} customer{customers.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-[#F97316] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Customer
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-20 text-center">
          <div className="w-8 h-8 border-2 border-[#F97316] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading customers...</p>
        </div>
      ) : customers.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-20 text-center">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-700 font-medium mb-1">No customers yet</p>
          <p className="text-gray-400 text-sm mb-4">Add your first customer to get started.</p>
          <button onClick={openNew} className="bg-[#F97316] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors">
            Add Customer
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-700">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Company</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Email</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.map(c => (
                <tr
                  key={c.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => openEdit(c)}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                  <td className="px-4 py-3 text-gray-600">{c.company_name || <span className="text-gray-400">—</span>}</td>
                  <td className="px-4 py-3 text-gray-600">{c.phone || <span className="text-gray-400">—</span>}</td>
                  <td className="px-4 py-3 text-gray-600">{c.email || <span className="text-gray-400">—</span>}</td>
                  <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(c)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteId(c.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded"
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
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-semibold text-gray-900 mb-2">Delete Customer?</h3>
            <p className="text-sm text-gray-500 mb-5">This cannot be undone. Any invoices linked to this customer will be affected.</p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(deleteId)}
                className="flex-1 bg-red-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-600"
              >
                Delete
              </button>
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slide-over form */}
      <SlideOver open={open} onClose={() => setOpen(false)} title={editId ? 'Edit Customer' : 'New Customer'}>
        <div className="space-y-4">
          <Input label="Full Name *" value={form.name} onChange={set('name')} placeholder="John Smith" />
          <Input label="Company Name" value={form.company_name} onChange={set('company_name')} placeholder="Smith Contracting" />
          <Input label="Address" value={form.address_line1} onChange={set('address_line1')} placeholder="123 Main St" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="City" value={form.city} onChange={set('city')} placeholder="Vancouver" />
            <Input label="Postal Code" value={form.postal_code} onChange={set('postal_code')} placeholder="V5K 1A1" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Province</label>
            <select
              value={form.province}
              onChange={set('province')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]"
            >
              <option value="">— Select —</option>
              {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <Input label="Phone" value={form.phone} onChange={set('phone')} placeholder="604-555-0100" />
          <Input label="Email" type="email" value={form.email} onChange={set('email')} placeholder="john@example.com" />

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving || !form.name?.trim()}
              className="flex-1 bg-[#F97316] text-white py-2.5 rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : editId ? 'Update Customer' : 'Add Customer'}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </SlideOver>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
