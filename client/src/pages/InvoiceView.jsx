import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Printer, Download, ArrowLeft, Loader2 } from 'lucide-react';

const fmt = (n) => `$${parseFloat(n || 0).toFixed(2)}`;
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-CA', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

export default function InvoiceView() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/invoices/${id}`).then(r => r.json()),
      fetch('/api/settings').then(r => r.json())
    ]).then(([inv, s]) => {
      if (inv.error) throw new Error(inv.error);
      setInvoice(inv);
      setSettings(s || {});
      setLoading(false);
    }).catch(err => {
      setError(err.message);
      setLoading(false);
    });
  }, [id]);

  const handlePrint = () => window.print();

  const handleDownloadPDF = async () => {
    try {
      const res = await fetch(`/api/invoices/${id}/pdf`);
      if (!res.ok) throw new Error('PDF generation failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoice.invoice_number || id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.print();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <Loader2 className="w-8 h-8 animate-spin text-[#F97316]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 gap-4">
        <p className="text-red-600 font-medium">{error}</p>
        <Link to="/invoices" className="text-[#F97316] hover:underline text-sm">← Back to Invoices</Link>
      </div>
    );
  }

  const customer = invoice.customers || null;
  const lineItems = invoice.line_items || [];
  const subtotal = lineItems.reduce((s, i) => s + parseFloat(i.total || 0), 0);
  const gstEnabled = invoice.gst_enabled !== false;
  const pstRate = parseFloat(invoice.pst_rate) || 0;
  const gstAmount = gstEnabled ? Math.round(subtotal * 0.05 * 100) / 100 : 0;
  const pstAmount = pstRate > 0 ? Math.round(subtotal * (pstRate / 100) * 100) / 100 : 0;
  const total = Math.round((subtotal + gstAmount + pstAmount) * 100) / 100;

  const companyAddr = [
    settings.address_line1,
    settings.address_line2,
    [settings.city, settings.province].filter(Boolean).join(', '),
    settings.postal_code
  ].filter(Boolean);

  const custAddr = customer ? [
    customer.address_line1,
    [customer.city, customer.province].filter(Boolean).join(', '),
    customer.postal_code
  ].filter(Boolean) : [];

  return (
    <>
      {/* Print-only styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .invoice-page { box-shadow: none !important; margin: 0 !important; max-width: 100% !important; border-radius: 0 !important; }
        }
        @page { margin: 0.5in; size: letter; }
      `}</style>

      {/* Top action bar (hidden on print) */}
      <div className="no-print bg-[#0F172A] px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <Link
          to={`/invoices/${id}/edit`}
          className="flex items-center gap-2 text-slate-300 hover:text-white text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Editor
        </Link>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm transition-colors"
          >
            <Download className="w-4 h-4" /> Download PDF
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-[#F97316] hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm transition-colors"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>
      </div>

      {/* Page background */}
      <div className="no-print min-h-screen bg-gray-200 py-10 px-4">
        <InvoicePage
          settings={settings}
          invoice={invoice}
          customer={customer}
          lineItems={lineItems}
          companyAddr={companyAddr}
          custAddr={custAddr}
          subtotal={subtotal}
          gstEnabled={gstEnabled}
          gstAmount={gstAmount}
          pstRate={pstRate}
          pstAmount={pstAmount}
          total={total}
        />
      </div>

      {/* Print-visible page (shown only when printing) */}
      <div className="hidden print:block">
        <InvoicePage
          settings={settings}
          invoice={invoice}
          customer={customer}
          lineItems={lineItems}
          companyAddr={companyAddr}
          custAddr={custAddr}
          subtotal={subtotal}
          gstEnabled={gstEnabled}
          gstAmount={gstAmount}
          pstRate={pstRate}
          pstAmount={pstAmount}
          total={total}
          forPrint
        />
      </div>
    </>
  );
}

function InvoicePage({ settings, invoice, customer, lineItems, companyAddr, custAddr, subtotal, gstEnabled, gstAmount, pstRate, pstAmount, total, forPrint }) {
  // Collapse grouped items into one row per group_label
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
    <div className={`invoice-page bg-white font-sans text-gray-900 ${forPrint ? '' : 'max-w-[850px] mx-auto rounded-xl shadow-2xl'}`}>

      {/* ── Header band ── */}
      <div className="bg-[#0F172A] px-10 py-7 flex items-start justify-between">
        <div>
          {settings.logo_url ? (
            <img src={settings.logo_url} alt="logo" className="h-14 object-contain mb-3" />
          ) : null}
          <div className="text-white font-bold text-lg leading-tight">
            {settings.company_name || 'Your Company'}
          </div>
          {companyAddr.map((line, i) => (
            <div key={i} className="text-slate-400 text-sm">{line}</div>
          ))}
          {settings.phone && <div className="text-slate-400 text-sm mt-1">{settings.phone}</div>}
          {settings.email && <div className="text-slate-400 text-sm">{settings.email}</div>}
          {settings.website && <div className="text-slate-400 text-sm">{settings.website}</div>}
        </div>

        <div className="text-right">
          <div className="text-[#F97316] text-4xl font-extrabold uppercase tracking-wider">Invoice</div>
          <div className="mt-3 space-y-1 text-sm">
            <div className="flex items-baseline justify-end gap-2">
              <span className="text-slate-400">Number</span>
              <span className="text-white font-mono font-semibold">{invoice.invoice_number || '—'}</span>
            </div>
            <div className="flex items-baseline justify-end gap-2">
              <span className="text-slate-400">Date</span>
              <span className="text-white">{fmtDate(invoice.invoice_date)}</span>
            </div>
            {invoice.po_number && (
              <div className="flex items-baseline justify-end gap-2">
                <span className="text-slate-400">P.O. #</span>
                <span className="text-white">{invoice.po_number}</span>
              </div>
            )}
            <div className="flex items-baseline justify-end gap-2 mt-2 pt-2 border-t border-slate-600">
              <span className="text-slate-400 text-xs uppercase tracking-wider">Amount Due</span>
              <span className="text-[#F97316] text-xl font-bold">{fmt(total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bill To + Job Description ── */}
      <div className="px-10 py-7 grid grid-cols-2 gap-8 border-b border-gray-100">
        <div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Bill To</div>
          {customer ? (
            <div className="space-y-0.5">
              <div className="font-semibold text-gray-900 text-base">{customer.name}</div>
              {customer.company_name && <div className="text-gray-600">{customer.company_name}</div>}
              {custAddr.map((line, i) => (
                <div key={i} className="text-gray-500 text-sm">{line}</div>
              ))}
              {customer.phone && <div className="text-gray-500 text-sm mt-1">{customer.phone}</div>}
              {customer.email && <div className="text-gray-500 text-sm">{customer.email}</div>}
            </div>
          ) : (
            <div className="text-gray-400 italic">No customer</div>
          )}
        </div>

        {invoice.job_description && (
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Job Description</div>
            <p className="text-gray-700 text-sm leading-relaxed">{invoice.job_description}</p>
          </div>
        )}
      </div>

      {/* ── Line Items Table ── */}
      <div className="px-10 py-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-[#0F172A]">
              <th className="pb-3 text-left font-semibold text-gray-700 w-1/2">Description</th>
              <th className="pb-3 text-center font-semibold text-gray-700 w-16">Qty</th>
              <th className="pb-3 text-right font-semibold text-gray-700 w-28">Unit Price</th>
              <th className="pb-3 text-right font-semibold text-gray-700 w-28">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {displayItems.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-gray-400 italic">No line items</td>
              </tr>
            ) : displayItems.map((entry, i) =>
              entry.isGroup ? (
                <tr key={entry.label} className={i % 2 === 1 ? 'bg-gray-50/60' : ''}>
                  <td className="py-3 pr-4">
                    <span className="font-medium text-gray-800">{entry.label}</span>
                  </td>
                  <td className="py-3 text-center text-gray-400">—</td>
                  <td className="py-3 text-right text-gray-400">—</td>
                  <td className="py-3 text-right font-medium text-gray-900">{fmt(entry.total)}</td>
                </tr>
              ) : (
                <tr key={entry.item.id || i} className={i % 2 === 1 ? 'bg-gray-50/60' : ''}>
                  <td className="py-3 pr-4">
                    <div className="flex items-baseline gap-2">
                      {entry.item.sku && (
                        <span className="font-mono text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0">
                          {entry.item.sku}
                        </span>
                      )}
                      <span className="text-gray-800">{entry.item.description || <span className="text-gray-400 italic">—</span>}</span>
                    </div>
                    {entry.item.type && entry.item.type !== 'material' && (
                      <div className="text-xs text-gray-400 mt-0.5 capitalize">{entry.item.type.replace('_', ' ')}</div>
                    )}
                  </td>
                  <td className="py-3 text-center text-gray-700">{entry.item.quantity}</td>
                  <td className="py-3 text-right text-gray-700">{fmt(entry.item.unit_price)}</td>
                  <td className="py-3 text-right font-medium text-gray-900">{fmt(entry.item.total)}</td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>

      {/* ── Totals ── */}
      <div className="px-10 pb-8 flex justify-end">
        <div className="w-60">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>{fmt(subtotal)}</span>
            </div>
            {gstEnabled && (
              <div className="flex justify-between text-gray-600">
                <span>GST (5%)</span>
                <span>{fmt(gstAmount)}</span>
              </div>
            )}
            {pstRate > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>PST ({pstRate}%)</span>
                <span>{fmt(pstAmount)}</span>
              </div>
            )}
          </div>
          <div className="border-t-2 border-[#0F172A] mt-3 pt-3 flex justify-between items-baseline">
            <span className="font-bold text-[#0F172A] text-base">Balance Due</span>
            <span className="font-extrabold text-[#F97316] text-xl">{fmt(total)}</span>
          </div>
        </div>
      </div>

      {/* ── Tax Numbers + Payment Info ── */}
      {(settings.gst_number || settings.pst_number || settings.etransfer_email) && (
        <div className="px-10 py-5 bg-gray-50 border-t border-gray-100 grid grid-cols-2 gap-6 text-xs text-gray-500">
          {(settings.gst_number || settings.pst_number) && (
            <div className="space-y-1">
              {settings.gst_number && <div><span className="font-medium text-gray-600">GST #:</span> {settings.gst_number}</div>}
              {settings.pst_number && <div><span className="font-medium text-gray-600">PST #:</span> {settings.pst_number}</div>}
            </div>
          )}
          {settings.etransfer_email && (
            <div>
              <div className="font-medium text-gray-600 mb-0.5">Payment — E-Transfer</div>
              <div>{settings.etransfer_email}</div>
            </div>
          )}
        </div>
      )}

      {/* ── Footer Notes ── */}
      {settings.invoice_notes && (
        <div className="px-10 py-5 border-t border-gray-100">
          <p className="text-xs text-gray-400 leading-relaxed">{settings.invoice_notes}</p>
        </div>
      )}

      {/* ── Bottom accent bar ── */}
      <div className="h-1.5 bg-gradient-to-r from-[#0F172A] via-[#F97316] to-[#0F172A]" />
    </div>
  );
}
