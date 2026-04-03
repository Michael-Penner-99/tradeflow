import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Plus, Save, Send, Eye, Loader2, Clock, Package } from 'lucide-react';
import Toast from '../components/Toast.jsx';
import { calcItem, makeItem, LineItemsHeader, ItemRow, BundleBox } from '../components/LineItemTable.jsx';
import { apiFetch } from '../lib/api.js';

const fmt = (n) => `$${parseFloat(n || 0).toFixed(2)}`;
const today = () => new Date().toISOString().split('T')[0];

// ── Live Invoice Preview ─────────────────────────────────────────────
function InvoicePreview({ settings, customer, invoiceNumber, invoiceDate, poNumber, jobDescription, lineItems, gstEnabled, pstEnabled, pstRate, subtotal, gstAmount, pstAmount, total }) {
  const addr = [settings.address_line1, settings.city, settings.province].filter(Boolean).join(', ');
  const custAddr = customer ? [customer.address_line1, customer.city, customer.province].filter(Boolean).join(', ') : '';

  // Collapse grouped items
  const displayItems = [];
  const seenGroups = new Set();
  for (const item of lineItems) {
    if (!item.group_label) {
      displayItems.push({ isGroup: false, item });
    } else if (!seenGroups.has(item.group_label)) {
      seenGroups.add(item.group_label);
      const grpItems = lineItems.filter(i => i.group_label === item.group_label);
      const grpTotal = grpItems.reduce((s, i) => s + (parseFloat(i.total) || 0), 0);
      displayItems.push({ isGroup: true, label: item.group_label, total: grpTotal, count: grpItems.length });
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 text-xs font-sans overflow-hidden">
      <div className="bg-[#0F172A] px-5 py-3 flex items-center justify-between">
        <span className="text-white text-sm font-medium">Preview</span>
        <span className="text-slate-400 text-xs">Updates live as you type</span>
      </div>

      <div className="p-6 space-y-4">
        {/* Company + Invoice title */}
        <div className="flex justify-between items-start">
          <div>
            {settings.logo_url && (
              <img src={settings.logo_url} alt="logo" className="h-10 mb-2 object-contain" />
            )}
            <div className="font-bold text-sm text-gray-900">{settings.company_name || 'Your Company'}</div>
            {addr && <div className="text-gray-500 text-xs mt-0.5">{addr}</div>}
            {settings.phone && <div className="text-gray-500 text-xs">{settings.phone}</div>}
            {settings.email && <div className="text-gray-500 text-xs">{settings.email}</div>}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-[#0F172A] uppercase tracking-wide">Invoice</div>
            <div className="text-gray-600 mt-1 space-y-0.5">
              <div><span className="text-gray-400">No. </span><span className="font-medium">{invoiceNumber || '—'}</span></div>
              <div><span className="text-gray-400">Date: </span>{invoiceDate || today()}</div>
              {poNumber && <div><span className="text-gray-400">P.O.: </span>{poNumber}</div>}
            </div>
          </div>
        </div>

        {/* Bill To + Job */}
        <div className="grid grid-cols-2 gap-3">
          <div className="border border-gray-100 rounded-lg p-3 bg-gray-50">
            <div className="text-gray-400 uppercase text-[9px] tracking-widest mb-1">Bill To</div>
            {customer ? (
              <>
                <div className="font-semibold text-gray-900">{customer.name}</div>
                {customer.company_name && <div className="text-gray-600">{customer.company_name}</div>}
                {customer.address_line1 && <div className="text-gray-500">{customer.address_line1}</div>}
                {custAddr && <div className="text-gray-500">{custAddr}</div>}
              </>
            ) : <div className="text-gray-400 italic">No customer selected</div>}
          </div>
          {jobDescription && (
            <div className="border border-gray-100 rounded-lg p-3 bg-gray-50">
              <div className="text-gray-400 uppercase text-[9px] tracking-widest mb-1">Job Description</div>
              <div className="text-gray-700">{jobDescription}</div>
            </div>
          )}
        </div>

        {/* Line items table */}
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#0F172A] text-white">
              <th className="py-2 px-2 text-left">Description</th>
              <th className="py-2 px-2 text-right w-10">Qty</th>
              <th className="py-2 px-2 text-right w-20">Unit Price</th>
              <th className="py-2 px-2 text-right w-20">Total</th>
            </tr>
          </thead>
          <tbody>
            {displayItems.length === 0 ? (
              <tr><td colSpan={4} className="py-4 text-center text-gray-400 italic">No line items yet</td></tr>
            ) : displayItems.map((entry, i) =>
              entry.isGroup ? (
                <tr key={entry.label} className={i % 2 === 1 ? 'bg-gray-50' : ''}>
                  <td className="py-1.5 px-2">
                    <span className="font-medium">{entry.label}</span>
                    <span className="text-gray-400 ml-1 text-[10px]">({entry.count} items)</span>
                  </td>
                  <td className="py-1.5 px-2 text-right text-gray-400">—</td>
                  <td className="py-1.5 px-2 text-right text-gray-400">—</td>
                  <td className="py-1.5 px-2 text-right font-medium">{fmt(entry.total)}</td>
                </tr>
              ) : (
                <tr key={entry.item._id} className={i % 2 === 1 ? 'bg-gray-50' : ''}>
                  <td className="py-1.5 px-2">
                    {entry.item.sku && <span className="text-gray-400 font-mono mr-1">{entry.item.sku}</span>}
                    {entry.item.description || <span className="text-gray-400 italic">—</span>}
                  </td>
                  <td className="py-1.5 px-2 text-right">{entry.item.quantity}</td>
                  <td className="py-1.5 px-2 text-right">{fmt(entry.item.unit_price)}</td>
                  <td className="py-1.5 px-2 text-right font-medium">{fmt(entry.item.total)}</td>
                </tr>
              )
            )}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-48 space-y-1">
            <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
            {gstEnabled && <div className="flex justify-between text-gray-600"><span>GST (5%)</span><span>{fmt(gstAmount)}</span></div>}
            {pstEnabled && <div className="flex justify-between text-gray-600"><span>PST ({pstRate}%)</span><span>{fmt(pstAmount)}</span></div>}
            <div className="flex justify-between font-bold text-sm text-[#0F172A] border-t border-gray-200 pt-1.5 mt-1.5">
              <span>Balance Due</span>
              <span className="text-[#F97316]">{fmt(total)}</span>
            </div>
          </div>
        </div>

        {settings.invoice_notes && (
          <div className="border-t border-gray-100 pt-3 text-gray-400 text-[10px]">{settings.invoice_notes}</div>
        )}
      </div>
    </div>
  );
}

// ── Main InvoiceBuilder ──────────────────────────────────────────────
export default function InvoiceBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [settings, setSettings] = useState({});
  const [customers, setCustomers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);

  const [invoiceId, setInvoiceId] = useState(id || null);
  const [customerId, setCustomerId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [poNumber, setPoNumber] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [lineItems, setLineItems] = useState([]);
  const [gstEnabled, setGstEnabled] = useState(true);
  const [pstEnabled, setPstEnabled] = useState(false);
  const [pstRate, setPstRate] = useState(7);
  const [status, setStatus] = useState('draft');

  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [toast, setToast] = useState(null);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [skuSearch, setSkuSearch] = useState({});

  const savedStateRef = useRef(null);

  // Computed totals
  const subtotal = lineItems.reduce((s, i) => s + (parseFloat(i.total) || 0), 0);
  const gstAmount = gstEnabled ? Math.round(subtotal * 0.05 * 100) / 100 : 0;
  const pstAmount = pstEnabled ? Math.round(subtotal * (parseFloat(pstRate) / 100) * 100) / 100 : 0;
  const total = Math.round((subtotal + gstAmount + pstAmount) * 100) / 100;

  const selectedCustomer = customers.find(c => c.id === customerId) || null;

  // Build render order: interleave individual items and group boxes
  const renderOrder = useMemo(() => {
    const seen = new Set();
    return lineItems.reduce((acc, item) => {
      if (!item.group_label) {
        acc.push({ kind: 'item', item });
      } else if (!seen.has(item.group_label)) {
        seen.add(item.group_label);
        acc.push({
          kind: 'group',
          label: item.group_label,
          items: lineItems.filter(i => i.group_label === item.group_label)
        });
      }
      return acc;
    }, []);
  }, [lineItems]);

  // Load initial data
  useEffect(() => {
    Promise.all([
      apiFetch('/api/settings').then(r => r.json()),
      apiFetch('/api/customers').then(r => r.json()),
      apiFetch('/api/inventory').then(r => r.json()),
      id ? apiFetch(`/api/invoices/${id}`).then(r => r.json()) : Promise.resolve(null)
    ]).then(([s, c, inv, existing]) => {
      setSettings(s || {});
      setCustomers(Array.isArray(c) ? c : []);
      setInventory(Array.isArray(inv) ? inv : []);

      if (existing && !existing.error) {
        setCustomerId(existing.customer_id || '');
        setInvoiceNumber(existing.invoice_number || '');
        setInvoiceDate(existing.invoice_date || today());
        setPoNumber(existing.po_number || '');
        setJobDescription(existing.job_description || '');
        setStatus(existing.status || 'draft');
        setGstEnabled(existing.gst_enabled !== false);
        setPstEnabled(parseFloat(existing.pst_rate) > 0);
        setPstRate(existing.pst_rate || 7);
        const items = (existing.line_items || []).map((li, i) => ({ ...li, _id: i + 1 }));
        setLineItems(items);
      } else if (!id) {
        const defaultMarkup = parseFloat(s?.default_markup_percent) || 0;
        setLineItems([makeItem({ markup: defaultMarkup })]);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  // Auto-save every 30s
  useEffect(() => {
    if (!invoiceId) return;
    const interval = setInterval(async () => {
      const currentState = JSON.stringify({ customerId, invoiceNumber, invoiceDate, lineItems });
      if (savedStateRef.current !== currentState) {
        await doSave(true);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [invoiceId, customerId, invoiceNumber, invoiceDate, lineItems, poNumber, jobDescription, gstEnabled, pstEnabled, pstRate]);

  const buildPayload = useCallback(() => ({
    customer_id: customerId || null,
    invoice_number: invoiceNumber || undefined,
    invoice_date: invoiceDate,
    po_number: poNumber || null,
    job_description: jobDescription || null,
    status,
    notes: null,
    lineItems: lineItems.map(({ _id, ...rest }) => rest),
    gstEnabled,
    pstRate: pstEnabled ? parseFloat(pstRate) : 0
  }), [customerId, invoiceNumber, invoiceDate, poNumber, jobDescription, status, lineItems, gstEnabled, pstEnabled, pstRate]);

  const doSave = async (isAutoSave = false) => {
    setSaving(true);
    try {
      const payload = buildPayload();
      const url = invoiceId ? `/api/invoices/${invoiceId}` : '/api/invoices';
      const method = invoiceId ? 'PUT' : 'POST';
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (!invoiceId) {
        setInvoiceId(data.id);
        setInvoiceNumber(data.invoice_number);
        navigate(`/invoices/${data.id}/edit`, { replace: true });
      }

      savedStateRef.current = JSON.stringify({ customerId, invoiceNumber: data.invoice_number, invoiceDate, lineItems });
      setLastSaved(new Date());
      if (!isAutoSave) setToast({ message: 'Invoice saved', type: 'success' });
    } catch (err) {
      if (!isAutoSave) setToast({ message: err.message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async () => {
    if (!invoiceId) { await doSave(); return; }
    setSending(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/send`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStatus('sent');
      setToast({ message: 'Invoice marked as sent' + (selectedCustomer?.email ? ' and emailed' : ''), type: 'success' });
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setSending(false);
    }
  };

  // ── Line item operations ────────────────────────────────────────────

  const addLineItem = (type = 'material', group_label = null) => {
    const overrides = { type };
    if (type === 'labor') {
      overrides.description = 'Labor';
      overrides.unit_cost = parseFloat(settings.default_labor_rate) || 0;
      overrides.markup_percent = 0;
    }
    setLineItems(prev => [...prev, makeItem({
      markup: parseFloat(settings.default_markup_percent) || 0,
      group_label,
      _overrides: overrides
    })]);
  };

  const addBundle = () => {
    const existingGroups = new Set(lineItems.filter(i => i.group_label).map(i => i.group_label));
    let name = 'Materials';
    let n = 2;
    while (existingGroups.has(name)) name = `Materials ${n++}`;
    setLineItems(prev => [...prev, makeItem({
      markup: parseFloat(settings.default_markup_percent) || 0,
      group_label: name
    })]);
  };

  const addItemToBundle = (groupLabel) => {
    setLineItems(prev => {
      const indices = prev.map((item, idx) => ({ item, idx })).filter(({ item }) => item.group_label === groupLabel);
      const insertAfter = indices.length > 0 ? indices[indices.length - 1].idx : prev.length - 1;
      const newItem = makeItem({
        markup: parseFloat(settings.default_markup_percent) || 0,
        group_label: groupLabel
      });
      const result = [...prev];
      result.splice(insertAfter + 1, 0, newItem);
      return result;
    });
  };

  const renameGroup = (oldLabel, newLabel) => {
    if (!newLabel.trim() || newLabel === oldLabel) return;
    setLineItems(prev => prev.map(i => i.group_label === oldLabel ? { ...i, group_label: newLabel } : i));
  };

  const removeGroup = (label) => {
    setLineItems(prev => prev.filter(i => i.group_label !== label));
  };

  const updateItem = (localId, field, value) => {
    setLineItems(prev => prev.map(item => {
      if (item._id !== localId) return item;
      return calcItem({ ...item, [field]: value });
    }));
  };

  const removeItem = (localId) => setLineItems(prev => prev.filter(i => i._id !== localId));

  const selectSKU = (localId, invItem) => {
    setLineItems(prev => prev.map(item => {
      if (item._id !== localId) return item;
      return calcItem({
        ...item,
        sku: invItem.sku,
        description: invItem.description || '',
        unit_cost: parseFloat(invItem.weighted_avg_cost) || 0,
        unit: invItem.unit || ''
      });
    }));
    setSkuSearch(prev => ({ ...prev, [localId]: '' }));
  };

  const addQuickCustomer = async () => {
    if (!newCustomerName.trim()) return;
    try {
      const res = await apiFetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCustomerName.trim() })
      });
      const c = await res.json();
      if (!res.ok) throw new Error(c.error);
      setCustomers(prev => [...prev, c].sort((a, b) => a.name.localeCompare(b.name)));
      setCustomerId(c.id);
      setShowNewCustomer(false);
      setNewCustomerName('');
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-[#F97316]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link to="/invoices" className="text-gray-400 hover:text-gray-600 text-sm">← Invoices</Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-900 font-medium text-sm">
            {invoiceId ? (invoiceNumber || 'Edit Invoice') : 'New Invoice'}
          </span>
          {lastSaved && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Clock className="w-3 h-3" /> Saved {lastSaved.toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {invoiceId && (
            <Link to={`/invoices/${invoiceId}/view`} target="_blank"
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
              <Eye className="w-4 h-4" /> Preview
            </Link>
          )}
          <button
            onClick={() => doSave()}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
          <button
            onClick={handleSend}
            disabled={sending}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-[#F97316] text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send
          </button>
        </div>
      </div>

      <div className="flex gap-6 p-6 max-w-[1400px] mx-auto">
        {/* ── LEFT: Builder ── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Header fields */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Customer */}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
                <select
                  value={customerId}
                  onChange={e => {
                    if (e.target.value === '__new__') { setShowNewCustomer(true); }
                    else { setCustomerId(e.target.value); setShowNewCustomer(false); }
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                >
                  <option value="">— Select customer —</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.company_name ? ` (${c.company_name})` : ''}</option>)}
                  <option value="__new__">+ Add new customer...</option>
                </select>
                {showNewCustomer && (
                  <div className="flex gap-2 mt-2">
                    <input
                      type="text"
                      placeholder="Customer name"
                      value={newCustomerName}
                      onChange={e => setNewCustomerName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addQuickCustomer()}
                      className="flex-1 border border-orange-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                    />
                    <button onClick={addQuickCustomer} className="bg-[#F97316] text-white px-3 py-1.5 rounded-lg text-sm font-medium">Add</button>
                    <button onClick={() => { setShowNewCustomer(false); setNewCustomerName(''); }} className="text-gray-500 px-2 text-sm hover:text-gray-700">✕</button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Invoice #</label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={e => setInvoiceNumber(e.target.value)}
                  placeholder="Auto-generated on save"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={e => setInvoiceDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">P.O. Number</label>
                <input
                  type="text"
                  value={poNumber}
                  onChange={e => setPoNumber(e.target.value)}
                  placeholder="Optional"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                >
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="approved">Approved</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Job Description / Message</label>
                <textarea
                  value={jobDescription}
                  onChange={e => setJobDescription(e.target.value)}
                  rows={2}
                  placeholder="Describe the work or job site..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316] resize-none"
                />
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Line Items</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => addLineItem('labor')}
                  className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  + Labor
                </button>
                <button
                  onClick={addBundle}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 border border-orange-300 text-orange-600 rounded-lg hover:bg-orange-50"
                >
                  <Package className="w-3 h-3" /> Bundle
                </button>
                <button
                  onClick={() => addLineItem('material')}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 bg-[#F97316] text-white rounded-lg hover:bg-orange-600"
                >
                  <Plus className="w-3 h-3" /> Add Line
                </button>
              </div>
            </div>

            {renderOrder.length === 0 ? (
              <div className="p-10 text-center text-gray-400 text-sm">
                No line items. Click "+ Add Line" or "Bundle" to start.
              </div>
            ) : (
              <>
                <LineItemsHeader />
                <div>
                  {renderOrder.map((entry, i) =>
                    entry.kind === 'item' ? (
                      <div key={entry.item._id} className={`border-b border-gray-100 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                        <ItemRow
                          item={entry.item}
                          inventory={inventory}
                          skuSearch={skuSearch}
                          setSkuSearch={setSkuSearch}
                          onUpdate={updateItem}
                          onRemove={removeItem}
                          onSelectSKU={selectSKU}
                        />
                      </div>
                    ) : (
                      <div key={entry.label} className="p-3 border-b border-gray-100">
                        <BundleBox
                          label={entry.label}
                          items={entry.items}
                          inventory={inventory}
                          skuSearch={skuSearch}
                          setSkuSearch={setSkuSearch}
                          onRename={renameGroup}
                          onAddItem={addItemToBundle}
                          onUpdateItem={updateItem}
                          onRemoveItem={removeItem}
                          onRemoveGroup={removeGroup}
                          onSelectSKU={selectSKU}
                        />
                      </div>
                    )
                  )}
                </div>
              </>
            )}

            <div className="px-4 py-2 border-t border-gray-100">
              <button
                onClick={() => addLineItem('material')}
                className="flex items-center gap-1.5 text-xs text-[#F97316] hover:text-orange-600 font-medium"
              >
                <Plus className="w-3.5 h-3.5" /> Add Line Item
              </button>
            </div>
          </div>

          {/* Tax section */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Tax</h2>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={gstEnabled}
                  onChange={e => setGstEnabled(e.target.checked)}
                  className="w-4 h-4 accent-[#F97316]"
                />
                <span className="text-sm text-gray-700">GST (5%)</span>
                {gstEnabled && <span className="text-sm text-gray-500 ml-auto">{fmt(gstAmount)}</span>}
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pstEnabled}
                  onChange={e => setPstEnabled(e.target.checked)}
                  className="w-4 h-4 accent-[#F97316]"
                />
                <span className="text-sm text-gray-700">PST</span>
                {pstEnabled && (
                  <>
                    <input
                      type="number"
                      value={pstRate}
                      onChange={e => setPstRate(e.target.value)}
                      min="0" max="30" step="0.5"
                      className="w-16 border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                    />
                    <span className="text-sm text-gray-500">%</span>
                    <span className="text-sm text-gray-500 ml-auto">{fmt(pstAmount)}</span>
                  </>
                )}
              </label>
            </div>

            <div className="border-t border-gray-100 mt-4 pt-4 space-y-1.5">
              <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
              {gstEnabled && <div className="flex justify-between text-sm text-gray-600"><span>GST (5%)</span><span>{fmt(gstAmount)}</span></div>}
              {pstEnabled && <div className="flex justify-between text-sm text-gray-600"><span>PST ({pstRate}%)</span><span>{fmt(pstAmount)}</span></div>}
              <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-200 pt-2 mt-2">
                <span>Total</span><span className="text-[#F97316]">{fmt(total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Live Preview ── */}
        <div className="w-[380px] flex-shrink-0">
          <div className="sticky top-[57px]">
            <InvoicePreview
              settings={settings}
              customer={selectedCustomer}
              invoiceNumber={invoiceNumber}
              invoiceDate={invoiceDate}
              poNumber={poNumber}
              jobDescription={jobDescription}
              lineItems={lineItems}
              gstEnabled={gstEnabled}
              pstEnabled={pstEnabled}
              pstRate={pstRate}
              subtotal={subtotal}
              gstAmount={gstAmount}
              pstAmount={pstAmount}
              total={total}
            />
          </div>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
