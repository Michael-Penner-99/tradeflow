import React, { useState, useEffect, useMemo } from 'react';
import { Search, Download, Package, AlertTriangle, Pencil, Trash2, Check, X, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../lib/api.js';

const LOW_STOCK_THRESHOLD = 5;

function formatCurrency(value) {
  const num = parseFloat(value);
  if (isNaN(num)) return '—';
  return `$${num.toFixed(4)}`;
}

function formatStock(value) {
  const num = parseFloat(value);
  if (isNaN(num)) return '0';
  return num % 1 === 0 ? num.toFixed(0) : num.toFixed(2);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    Promise.all([
      apiFetch('/api/inventory').then(r => r.json()),
      apiFetch('/api/inventory/suppliers').then(r => r.json())
    ])
      .then(([inv, sup]) => {
        setItems(Array.isArray(inv) ? inv : []);
        setSuppliers(Array.isArray(sup) ? sup : []);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load inventory');
        setLoading(false);
      });
  }, []);

  const filteredItems = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return items;
    return items.filter(item =>
      item.sku?.toLowerCase().includes(q) ||
      item.description?.toLowerCase().includes(q) ||
      item.suppliers?.name?.toLowerCase().includes(q)
    );
  }, [items, search]);

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditData({
      sku: item.sku || '',
      description: item.description || '',
      supplier_id: item.supplier_id || '',
      current_stock: item.current_stock ?? 0,
      unit: item.unit || '',
      weighted_avg_cost: item.weighted_avg_cost ?? 0
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      const res = await apiFetch(`/api/inventory/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const updated = await res.json();
      setItems(prev => prev.map(i => i.id === editingId ? updated : i));
      setEditingId(null);
      setEditData({});
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await apiFetch(`/api/inventory/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      setItems(prev => prev.filter(i => i.id !== id));
      setDeleteId(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleExportCSV = () => {
    const headers = ['SKU', 'Description', 'Supplier', 'Stock on Hand', 'Unit', 'Weighted Avg Cost', 'Last Updated'];
    const rows = filteredItems.map(item => [
      item.sku ?? '',
      item.description ?? '',
      item.suppliers?.name ?? '',
      item.current_stock ?? 0,
      item.unit ?? '',
      item.weighted_avg_cost ?? 0,
      item.last_updated ? new Date(item.last_updated).toISOString().split('T')[0] : ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row =>
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tradeflow-inventory-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const inp = 'w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#F97316] focus:border-transparent';

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-gray-500 mt-1">
            {loading ? 'Loading...' : `${filteredItems.length} of ${items.length} items`}
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={filteredItems.length === 0}
          className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search by SKU, description, or supplier..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-80 border border-gray-300 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-20 text-center">
          <div className="w-8 h-8 border-2 border-[#F97316] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading inventory...</p>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-20 text-center">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-700 font-medium mb-1">No inventory yet</p>
          <p className="text-gray-400 text-sm mb-4">Upload a supplier statement to get started.</p>
          <Link
            to="/upload"
            className="inline-flex items-center gap-2 bg-[#F97316] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
          >
            Upload Statement
          </Link>
        </div>
      )}

      {!loading && items.length > 0 && filteredItems.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Search className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500">No items match &ldquo;{search}&rdquo;</p>
        </div>
      )}

      {!loading && filteredItems.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-medium text-gray-700">SKU</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Description</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Supplier</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Stock</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Unit</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Wtd. Avg Cost</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Last Updated</th>
                  <th className="w-24" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredItems.map(item => {
                  const isEditing = editingId === item.id;
                  const isLowStock = parseFloat(item.current_stock) < LOW_STOCK_THRESHOLD;

                  if (isEditing) {
                    return (
                      <tr key={item.id} className="bg-orange-50/50">
                        <td className="px-3 py-2">
                          <input className={inp} value={editData.sku} onChange={e => setEditData(d => ({ ...d, sku: e.target.value }))} />
                        </td>
                        <td className="px-3 py-2">
                          <input className={inp} value={editData.description} onChange={e => setEditData(d => ({ ...d, description: e.target.value }))} />
                        </td>
                        <td className="px-3 py-2">
                          <select className={inp} value={editData.supplier_id} onChange={e => setEditData(d => ({ ...d, supplier_id: e.target.value }))}>
                            <option value="">—</option>
                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" className={inp + ' text-right'} value={editData.current_stock} onChange={e => setEditData(d => ({ ...d, current_stock: e.target.value }))} />
                        </td>
                        <td className="px-3 py-2">
                          <input className={inp} value={editData.unit} onChange={e => setEditData(d => ({ ...d, unit: e.target.value }))} />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" step="0.0001" className={inp + ' text-right'} value={editData.weighted_avg_cost} onChange={e => setEditData(d => ({ ...d, weighted_avg_cost: e.target.value }))} />
                        </td>
                        <td className="px-3 py-2 text-gray-400 text-xs">{formatDate(item.last_updated)}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={saveEdit} disabled={saving} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Save">
                              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            </button>
                            <button onClick={cancelEdit} className="p-1.5 text-gray-400 hover:text-gray-700 rounded" title="Cancel">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={item.id} className="hover:bg-gray-50 group">
                      <td className="px-4 py-3">
                        <span className="font-mono font-medium text-gray-900">{item.sku}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-xs">
                        <span className="line-clamp-1">{item.description || <span className="text-gray-400">—</span>}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {item.suppliers?.name || <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-medium ${isLowStock ? 'text-orange-600' : 'text-gray-900'}`}>
                          {formatStock(item.current_stock)}
                        </span>
                        {isLowStock && (
                          <span className="ml-2 inline-flex items-center gap-0.5 bg-orange-100 text-orange-700 text-xs px-1.5 py-0.5 rounded-full font-medium">
                            <AlertTriangle className="w-3 h-3" />
                            Low
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {item.unit || <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-900">
                        {formatCurrency(item.weighted_avg_cost)}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {formatDate(item.last_updated)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => startEdit(item)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded" title="Edit">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDeleteId(item.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-semibold text-gray-900 mb-2">Delete Inventory Item?</h3>
            <p className="text-sm text-gray-500 mb-5">This will permanently delete the item and its stock movement history.</p>
            <div className="flex gap-3">
              <button onClick={() => handleDelete(deleteId)} className="flex-1 bg-red-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-600">Delete</button>
              <button onClick={() => setDeleteId(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
