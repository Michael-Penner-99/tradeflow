import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload as UploadIcon,
  X,
  Check,
  RefreshCw,
  Loader2,
  AlertCircle,
  Plus,
  Link as LinkIcon
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../lib/api.js';

const STATES = { IDLE: 'idle', UPLOADING: 'uploading', REVIEWING: 'reviewing', CONFIRMED: 'confirmed' };

const FIELDS = [
  { key: 'sku', label: 'SKU', type: 'text', width: 'w-28' },
  { key: 'description', label: 'Description', type: 'text', width: 'flex-1' },
  { key: 'quantity', label: 'Qty', type: 'number', width: 'w-20' },
  { key: 'unit', label: 'Unit', type: 'text', width: 'w-20' },
  { key: 'unitCost', label: 'Unit Cost', type: 'number', width: 'w-28', step: '0.01' },
  { key: 'totalCost', label: 'Total Cost', type: 'number', width: 'w-28', step: '0.01' }
];

export default function Upload() {
  const [flowState, setFlowState] = useState(STATES.IDLE);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);

  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [showNewSupplierForm, setShowNewSupplierForm] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierAccount, setNewSupplierAccount] = useState('');
  const [savingSupplier, setSavingSupplier] = useState(false);

  const [statementId, setStatementId] = useState(null);
  const [lineItems, setLineItems] = useState([]);
  const [confirming, setConfirming] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    apiFetch('/api/suppliers')
      .then(r => r.json())
      .then(data => setSuppliers(Array.isArray(data) ? data : []))
      .catch(() => setError('Failed to load suppliers'));
  }, []);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    const allowed = ['application/pdf', 'image/png', 'image/jpeg'];
    if (!allowed.includes(file.type)) {
      setError('Only PDF, PNG, or JPEG files are accepted.');
      return;
    }
    setError(null);
    setFlowState(STATES.UPLOADING);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiFetch('/api/statements/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      const itemsWithIds = (data.lineItems || []).map((item, i) => ({ ...item, _id: i }));
      setStatementId(data.statementId);
      setLineItems(itemsWithIds);
      setFlowState(STATES.REVIEWING);
    } catch (err) {
      setError(err.message);
      setFlowState(STATES.IDLE);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const handleDragOver = useCallback((e) => { e.preventDefault(); setDragOver(true); }, []);
  const handleDragLeave = useCallback(() => setDragOver(false), []);
  const handleInputChange = useCallback((e) => handleFile(e.target.files[0]), [handleFile]);

  const updateLineItem = useCallback((id, field, value) => {
    setLineItems(prev => prev.map(item => item._id === id ? { ...item, [field]: value } : item));
  }, []);

  const removeLineItem = useCallback((id) => {
    setLineItems(prev => prev.filter(item => item._id !== id));
  }, []);

  const handleSaveNewSupplier = async () => {
    if (!newSupplierName.trim()) return;
    setSavingSupplier(true);
    try {
      const res = await apiFetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSupplierName.trim(), account_number: newSupplierAccount.trim() || null })
      });
      const supplier = await res.json();
      if (!res.ok) throw new Error(supplier.error);

      setSuppliers(prev => [...prev, supplier].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedSupplierId(supplier.id);
      setShowNewSupplierForm(false);
      setNewSupplierName('');
      setNewSupplierAccount('');
    } catch (err) {
      setError('Failed to save supplier: ' + err.message);
    } finally {
      setSavingSupplier(false);
    }
  };

  const handleConfirm = async () => {
    setError(null);
    setConfirming(true);
    try {
      const res = await apiFetch(`/api/statements/confirm/${statementId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineItems, supplierId: selectedSupplierId || null })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFlowState(STATES.CONFIRMED);
    } catch (err) {
      setError(err.message);
    } finally {
      setConfirming(false);
    }
  };

  const handleReset = () => {
    setFlowState(STATES.IDLE);
    setLineItems([]);
    setStatementId(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Upload Supplier Statement</h1>
        <p className="text-gray-500 mt-1">
          Upload a PDF or image and AI will extract the line items for review.
        </p>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span className="text-sm flex-1">{error}</span>
          <button onClick={() => setError(null)} className="flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* IDLE */}
      {flowState === STATES.IDLE && (
        <div className="space-y-4">
          {/* Supplier selector */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Supplier <span className="text-gray-400 font-normal">(optional — can be assigned later)</span>
            </label>
            <div className="space-y-3">
              <select
                value={selectedSupplierId}
                onChange={(e) => {
                  if (e.target.value === '__new__') {
                    setShowNewSupplierForm(true);
                    setSelectedSupplierId('');
                  } else {
                    setSelectedSupplierId(e.target.value);
                    setShowNewSupplierForm(false);
                  }
                }}
                className="w-full sm:w-80 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent"
              >
                <option value="">-- Select supplier --</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
                <option value="__new__">+ Add new supplier...</option>
              </select>

              {showNewSupplierForm && (
                <div className="border border-orange-200 bg-orange-50 rounded-lg p-4 space-y-2 max-w-sm">
                  <p className="text-sm font-medium text-orange-800">New Supplier</p>
                  <input
                    type="text"
                    placeholder="Supplier name *"
                    value={newSupplierName}
                    onChange={(e) => setNewSupplierName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                  />
                  <input
                    type="text"
                    placeholder="Account number (optional)"
                    value={newSupplierAccount}
                    onChange={(e) => setNewSupplierAccount(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveNewSupplier}
                      disabled={savingSupplier || !newSupplierName.trim()}
                      className="flex items-center gap-1.5 bg-[#F97316] text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-orange-600 transition-colors"
                    >
                      {savingSupplier ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                      Save Supplier
                    </button>
                    <button
                      onClick={() => { setShowNewSupplierForm(false); setNewSupplierName(''); setNewSupplierAccount(''); }}
                      className="px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-colors ${
              dragOver
                ? 'border-[#F97316] bg-orange-50'
                : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50'
            }`}
          >
            <UploadIcon className={`w-12 h-12 mx-auto mb-4 ${dragOver ? 'text-[#F97316]' : 'text-gray-400'}`} />
            <p className="text-gray-700 font-medium text-lg">Drop your file here, or click to browse</p>
            <p className="text-gray-400 text-sm mt-2">Supports PDF, PNG, JPG — max 10MB</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={handleInputChange}
              className="hidden"
            />
          </div>
        </div>
      )}

      {/* UPLOADING */}
      {flowState === STATES.UPLOADING && (
        <div className="bg-white rounded-xl border border-gray-200 p-20 text-center">
          <Loader2 className="w-12 h-12 animate-spin text-[#F97316] mx-auto mb-4" />
          <p className="text-gray-800 font-semibold text-lg">Analysing document with AI...</p>
          <p className="text-gray-400 text-sm mt-2">This may take 10–30 seconds</p>
        </div>
      )}

      {/* REVIEWING */}
      {flowState === STATES.REVIEWING && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-gray-900">{lineItems.length}</span> line items extracted.
              Review and edit before saving.
            </p>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Re-upload
            </button>
          </div>

          {/* Supplier selector in review state */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Assign to Supplier</label>
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="w-full sm:w-80 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]"
            >
              <option value="">-- No supplier --</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Editable table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {FIELDS.map(f => (
                      <th key={f.key} className="text-left px-3 py-3 font-medium text-gray-700 whitespace-nowrap">
                        {f.label}
                      </th>
                    ))}
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lineItems.map((item) => (
                    <tr key={item._id} className="hover:bg-gray-50 group">
                      {FIELDS.map(({ key, type, step }) => (
                        <td key={key} className="px-2 py-1.5">
                          <input
                            type={type}
                            value={item[key] ?? ''}
                            onChange={(e) => updateLineItem(item._id, key, e.target.value)}
                            step={step}
                            className="w-full border border-transparent rounded-md px-2 py-1.5 focus:outline-none focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] bg-transparent hover:bg-white hover:border-gray-200 text-sm transition-colors"
                            placeholder="—"
                          />
                        </td>
                      ))}
                      <td className="px-2 py-1.5 text-center">
                        <button
                          onClick={() => removeLineItem(item._id)}
                          className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleConfirm}
              disabled={lineItems.length === 0 || confirming}
              className="flex items-center gap-2 bg-[#F97316] text-white px-6 py-2.5 rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              {confirming
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Check className="w-4 h-4" />}
              Confirm & Save to Inventory
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Re-upload
            </button>
          </div>
        </div>
      )}

      {/* CONFIRMED */}
      {flowState === STATES.CONFIRMED && (
        <div className="bg-white rounded-xl border border-gray-200 p-20 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Statement Confirmed!</h2>
          <p className="text-gray-500 mb-8">
            {lineItems.length} item{lineItems.length !== 1 ? 's' : ''} saved to inventory with updated weighted average costs.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handleReset}
              className="bg-[#F97316] text-white px-5 py-2.5 rounded-lg font-medium hover:bg-orange-600 transition-colors"
            >
              Upload Another Statement
            </button>
            <Link
              to="/inventory"
              className="px-5 py-2.5 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              View Inventory
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
