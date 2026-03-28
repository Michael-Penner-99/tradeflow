import React, { useState, useEffect, useMemo } from 'react';
import { Search, Download, Package, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/inventory')
      .then(r => r.json())
      .then(data => {
        setItems(Array.isArray(data) ? data : []);
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
      item.description?.toLowerCase().includes(q)
    );
  }, [items, search]);

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
          placeholder="Search by SKU or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-80 border border-gray-300 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
          {error}
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
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-medium text-gray-700">SKU</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Description</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Supplier</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Stock on Hand</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Unit</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Wtd. Avg Cost</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Last Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredItems.map(item => {
                  const isLowStock = parseFloat(item.current_stock) < LOW_STOCK_THRESHOLD;
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
