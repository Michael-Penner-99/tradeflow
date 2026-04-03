import { useState, useEffect, useRef } from 'react';
import { Upload, Building2, Link2, Link2Off, Loader2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import Toast from '../components/Toast.jsx';
import { apiFetch } from '../lib/api.js';

const PROVINCES = [
  'Alberta', 'British Columbia', 'Manitoba', 'New Brunswick',
  'Newfoundland and Labrador', 'Northwest Territories', 'Nova Scotia',
  'Nunavut', 'Ontario', 'Prince Edward Island', 'Quebec', 'Saskatchewan', 'Yukon'
];

const Field = ({ label, children }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    {children}
  </div>
);

const Input = (props) => (
  <input
    {...props}
    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent"
  />
);

export default function Settings() {
  const [form, setForm] = useState({
    company_name: '', address_line1: '', address_line2: '', city: '',
    province: '', postal_code: '', phone: '', email: '', website: '',
    gst_number: '', pst_number: '', logo_url: '',
    default_labor_rate: '', default_markup_percent: '',
    etransfer_email: '', invoice_notes: ''
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState(null);
  const [qbStatus, setQbStatus] = useState(null); // null | { connected, realmId, isExpired }
  const [qbConnecting, setQbConnecting] = useState(false);
  const logoRef = useRef();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    apiFetch('/api/settings')
      .then(r => r.json())
      .then(data => { if (data && data.id) setForm(f => ({ ...f, ...data })); })
      .catch(() => {});
    apiFetch('/api/quickbooks/status')
      .then(r => r.json())
      .then(data => setQbStatus(data))
      .catch(() => {});
  }, []);

  // Handle QB OAuth callback result
  useEffect(() => {
    const qb = searchParams.get('qb');
    if (qb === 'connected') {
      setToast({ message: 'QuickBooks connected successfully', type: 'success' });
      apiFetch('/api/quickbooks/status').then(r => r.json()).then(setQbStatus).catch(() => {});
      setSearchParams({});
    } else if (qb === 'error') {
      setToast({ message: 'QuickBooks connection failed. Check your credentials.', type: 'error' });
      setSearchParams({});
    }
  }, [searchParams]);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleQbConnect = async () => {
    setQbConnecting(true);
    try {
      const res = await apiFetch('/api/quickbooks/connect');
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      setToast({ message: 'Failed to start QuickBooks connection', type: 'error' });
      setQbConnecting(false);
    }
  };

  const handleQbDisconnect = async () => {
    try {
      await apiFetch('/api/quickbooks/disconnect', { method: 'POST' });
      setQbStatus({ connected: false });
      setToast({ message: 'QuickBooks disconnected', type: 'success' });
    } catch {
      setToast({ message: 'Failed to disconnect', type: 'error' });
    }
  };

  const handleLogoUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('logo', file);
    try {
      const res = await apiFetch('/api/settings/logo', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForm(f => ({ ...f, logo_url: data.logo_url }));
      setToast({ message: 'Logo uploaded', type: 'success' });
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = { ...form };
      delete body.id;
      delete body.created_at;
      const res = await apiFetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForm(f => ({ ...f, ...data }));
      setToast({ message: 'Settings saved successfully', type: 'success' });
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Company Settings</h1>
        <p className="text-gray-500 mt-1">This information appears on your invoices.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#F97316]" /> Company Logo
            </h2>
            <div className="flex items-center gap-4">
              <div
                className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50 cursor-pointer hover:border-[#F97316] transition-colors overflow-hidden"
                onClick={() => logoRef.current?.click()}
              >
                {form.logo_url
                  ? <img src={form.logo_url} alt="Logo" className="w-full h-full object-contain p-1" />
                  : <Upload className="w-6 h-6 text-gray-400" />}
              </div>
              <div>
                <button
                  onClick={() => logoRef.current?.click()}
                  disabled={uploading}
                  className="text-sm text-[#F97316] font-medium hover:underline"
                >
                  {uploading ? 'Uploading...' : 'Upload logo'}
                </button>
                <p className="text-xs text-gray-400 mt-1">PNG, JPG, SVG — max 5MB</p>
              </div>
              <input
                ref={logoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => handleLogoUpload(e.target.files[0])}
              />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">Company Details</h2>
            <Field label="Company Name">
              <Input value={form.company_name} onChange={set('company_name')} placeholder="ABC Plumbing Ltd." />
            </Field>
            <Field label="Address Line 1">
              <Input value={form.address_line1} onChange={set('address_line1')} placeholder="123 Main St" />
            </Field>
            <Field label="Address Line 2">
              <Input value={form.address_line2} onChange={set('address_line2')} placeholder="Suite 100" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="City">
                <Input value={form.city} onChange={set('city')} placeholder="Vancouver" />
              </Field>
              <Field label="Postal Code">
                <Input value={form.postal_code} onChange={set('postal_code')} placeholder="V5K 1A1" />
              </Field>
            </div>
            <Field label="Province">
              <select
                value={form.province}
                onChange={set('province')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]"
              >
                <option value="">— Select province —</option>
                {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">Contact</h2>
            <Field label="Phone">
              <Input value={form.phone} onChange={set('phone')} placeholder="604-555-0100" />
            </Field>
            <Field label="Email">
              <Input type="email" value={form.email} onChange={set('email')} placeholder="info@company.com" />
            </Field>
            <Field label="Website">
              <Input value={form.website} onChange={set('website')} placeholder="www.company.com" />
            </Field>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">Tax & Billing</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="GST Number">
                <Input value={form.gst_number} onChange={set('gst_number')} placeholder="123456789 RT0001" />
              </Field>
              <Field label="PST Number">
                <Input value={form.pst_number} onChange={set('pst_number')} placeholder="PST-1234-5678" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Default Labor Rate ($/hr)">
                <Input type="number" value={form.default_labor_rate} onChange={set('default_labor_rate')} placeholder="95" min="0" step="0.01" />
              </Field>
              <Field label="Default Material Markup %">
                <Input type="number" value={form.default_markup_percent} onChange={set('default_markup_percent')} placeholder="20" min="0" step="0.1" />
              </Field>
            </div>
            <Field label="E-Transfer Email">
              <Input type="email" value={form.etransfer_email} onChange={set('etransfer_email')} placeholder="payments@company.com" />
            </Field>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Invoice Footer Notes</h2>
            <textarea
              value={form.invoice_notes}
              onChange={set('invoice_notes')}
              rows={4}
              placeholder="All material remains property of contractor until paid in full..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316] resize-none"
            />
          </div>
        </div>
      </div>

      {/* QuickBooks */}
      <div className="mt-6 bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-1">QuickBooks Online</h2>
        <p className="text-sm text-gray-500 mb-4">Export invoices directly to QuickBooks Online.</p>
        {qbStatus?.connected ? (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-green-600">
              <Link2 className="w-4 h-4" />
              <span className="font-medium">Connected</span>
              {qbStatus.isExpired && <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Token expired</span>}
            </div>
            <button onClick={handleQbDisconnect}
              className="flex items-center gap-1.5 text-sm text-gray-500 border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50">
              <Link2Off className="w-4 h-4" /> Disconnect
            </button>
          </div>
        ) : (
          <button onClick={handleQbConnect} disabled={qbConnecting}
            className="flex items-center gap-2 bg-[#2CA01C] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
            {qbConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
            Connect QuickBooks
          </button>
        )}
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#F97316] text-white px-6 py-2.5 rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
