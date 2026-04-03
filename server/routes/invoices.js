import { Router } from 'express';
import nodemailer from 'nodemailer';
import { supabase } from '../supabase.js';

const router = Router();

const fmt = (n) => `$${parseFloat(n || 0).toFixed(2)}`;

async function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const { data } = await supabase
    .from('invoices')
    .select('invoice_number')
    .like('invoice_number', `INV-${year}-%`)
    .order('invoice_number', { ascending: false })
    .limit(1);

  let nextNum = 1;
  if (data && data.length > 0) {
    const parts = data[0].invoice_number.split('-');
    nextNum = (parseInt(parts[2]) || 0) + 1;
  }
  return `INV-${year}-${String(nextNum).padStart(4, '0')}`;
}

function calcTotals(lineItems, gstEnabled, pstRate) {
  const subtotal = lineItems.reduce((s, i) => s + (parseFloat(i.total) || 0), 0);
  const gstAmount = gstEnabled ? Math.round(subtotal * 0.05 * 100) / 100 : 0;
  const pstAmount = pstRate > 0 ? Math.round(subtotal * (parseFloat(pstRate) / 100) * 100) / 100 : 0;
  const total = Math.round((subtotal + gstAmount + pstAmount) * 100) / 100;
  return { subtotal: Math.round(subtotal * 100) / 100, gstAmount, pstAmount, total };
}

function prepareLineItems(lineItems, invoiceId) {
  return lineItems.map((item, idx) => ({
    invoice_id: invoiceId,
    type: item.type || 'other',
    description: item.description || '',
    sku: item.sku || null,
    quantity: parseFloat(item.quantity) || 0,
    unit_cost: parseFloat(item.unit_cost) || 0,
    markup_percent: parseFloat(item.markup_percent) || 0,
    unit_price: parseFloat(item.unit_price) || 0,
    total: parseFloat(item.total) || 0,
    group_label: item.group_label || null,
    sort_order: idx
  }));
}

// GET /api/invoices
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select('*, customers(id, name, company_name)')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/invoices/:id
router.get('/:id', async (req, res) => {
  try {
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('*, customers(*)')
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .single();
    if (error) throw error;

    const { data: lineItems } = await supabase
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', req.params.id)
      .order('sort_order');

    const { data: settings } = await supabase
      .from('company_settings')
      .select('*')
      .eq('user_id', req.userId)
      .maybeSingle();

    res.json({ ...invoice, line_items: lineItems || [], settings: settings || {} });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/invoices
router.post('/', async (req, res) => {
  try {
    const { lineItems = [], gstEnabled = true, pstRate = 0, ...rest } = req.body;
    const invoiceNumber = rest.invoice_number || await generateInvoiceNumber();
    const { subtotal, gstAmount, pstAmount, total } = calcTotals(lineItems, gstEnabled, pstRate);

    const { data: invoice, error } = await supabase
      .from('invoices')
      .insert({
        ...rest,
        invoice_number: invoiceNumber,
        subtotal,
        gst_enabled: gstEnabled,
        pst_rate: pstRate,
        total,
        user_id: req.userId
      })
      .select()
      .single();
    if (error) throw error;

    if (lineItems.length > 0) {
      const { error: liErr } = await supabase
        .from('invoice_line_items')
        .insert(prepareLineItems(lineItems, invoice.id).map(li => ({ ...li, user_id: req.userId })));
      if (liErr) throw liErr;
    }

    res.status(201).json({ ...invoice, line_items: lineItems });
  } catch (err) {
    console.error('POST /api/invoices error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/invoices/:id
router.put('/:id', async (req, res) => {
  try {
    const { lineItems = [], gstEnabled = true, pstRate = 0, ...rest } = req.body;
    const { subtotal, gstAmount, pstAmount, total } = calcTotals(lineItems, gstEnabled, pstRate);

    // Remove fields that shouldn't be updated
    delete rest.id;
    delete rest.created_at;
    delete rest.customers;
    delete rest.settings;
    delete rest.line_items;

    const { data: invoice, error } = await supabase
      .from('invoices')
      .update({
        ...rest,
        subtotal,
        gst_enabled: gstEnabled,
        pst_rate: pstRate,
        total
      })
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .select()
      .single();
    if (error) throw error;

    // Replace line items
    await supabase.from('invoice_line_items').delete().eq('invoice_id', req.params.id);
    if (lineItems.length > 0) {
      await supabase.from('invoice_line_items').insert(prepareLineItems(lineItems, req.params.id).map(li => ({ ...li, user_id: req.userId })));
    }

    res.json({ ...invoice, line_items: lineItems });
  } catch (err) {
    console.error('PUT /api/invoices/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/invoices/:id
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('invoices').delete().eq('id', req.params.id).eq('user_id', req.userId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/invoices/:id/send
router.post('/:id/send', async (req, res) => {
  try {
    const { data: invoice } = await supabase
      .from('invoices')
      .select('*, customers(*)')
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .single();

    const { data: settings } = await supabase
      .from('company_settings')
      .select('*')
      .eq('user_id', req.userId)
      .maybeSingle();

    if (invoice?.customers?.email && process.env.SMTP_USER && process.env.SMTP_PASS) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      });

      const companyName = settings?.company_name || 'TradeFlow';
      const viewUrl = `${process.env.APP_URL || 'http://localhost:5173'}/invoices/${req.params.id}/view`;

      await transporter.sendMail({
        from: `"${companyName}" <${process.env.SMTP_USER}>`,
        to: invoice.customers.email,
        bcc: settings?.email || undefined,
        subject: `Invoice ${invoice.invoice_number} from ${companyName}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
            <div style="background:#0F172A;padding:20px 24px;border-radius:8px 8px 0 0">
              <span style="color:white;font-size:20px;font-weight:bold">${companyName}</span>
            </div>
            <div style="background:#f9fafb;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
              <h2 style="margin:0 0 8px">Invoice ${invoice.invoice_number}</h2>
              <p style="color:#6b7280;margin:0 0 20px">Hi ${invoice.customers.name}, please find your invoice below.</p>
              <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
                <tr><td style="padding:8px 0;color:#6b7280;border-bottom:1px solid #e5e7eb">Job Description</td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb">${invoice.job_description || '—'}</td></tr>
                <tr><td style="padding:8px 0;color:#6b7280">Balance Due</td><td style="padding:8px 0;font-weight:bold;font-size:20px;color:#0F172A">${fmt(invoice.total)}</td></tr>
              </table>
              <a href="${viewUrl}" style="display:inline-block;background:#F97316;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px">View Invoice</a>
              ${settings?.etransfer_email ? `<p style="margin-top:20px;color:#6b7280;font-size:13px">E-transfer payment accepted at: <strong>${settings.etransfer_email}</strong></p>` : ''}
              ${settings?.invoice_notes ? `<p style="margin-top:16px;color:#9ca3af;font-size:12px">${settings.invoice_notes}</p>` : ''}
            </div>
          </div>`
      });
    }

    const { data, error } = await supabase
      .from('invoices')
      .update({ status: 'sent' })
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('POST /api/invoices/:id/send error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/invoices/:id/pdf
router.get('/:id/pdf', async (req, res) => {
  try {
    const { data: invoice } = await supabase
      .from('invoices')
      .select('*, customers(*)')
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .single();

    const { data: lineItems } = await supabase
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', req.params.id)
      .order('sort_order');

    const { data: settings } = await supabase
      .from('company_settings')
      .select('*')
      .eq('user_id', req.userId)
      .maybeSingle();

    const html = buildInvoiceHTML(invoice, lineItems || [], settings || {});

    try {
      const { default: puppeteer } = await import('puppeteer');
      const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' }
      });
      await browser.close();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Invoice-${invoice.invoice_number}.pdf"`);
      res.send(Buffer.from(pdf));
    } catch {
      // Fallback: return printable HTML
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function buildInvoiceHTML(invoice, lineItems, settings) {
  const customer = invoice.customers || {};
  const addr = [settings.address_line1, settings.city, settings.province, settings.postal_code].filter(Boolean).join(', ');

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

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; padding: 40px; }
.header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
.company-info { font-size: 11px; color: #6b7280; margin-top: 6px; line-height: 1.6; }
.invoice-label { font-size: 36px; font-weight: bold; color: #0F172A; text-transform: uppercase; letter-spacing: 2px; }
.meta { font-size: 11px; color: #6b7280; text-align: right; margin-top: 8px; line-height: 1.8; }
.meta strong { color: #1a1a1a; }
.bill-to-section { display: flex; gap: 24px; margin-bottom: 28px; }
.bill-box { flex: 1; padding: 14px; border: 1px solid #e5e7eb; border-radius: 6px; }
.bill-box-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 6px; }
.bill-box-value { font-size: 12px; line-height: 1.6; }
.bill-box-value strong { font-size: 13px; display: block; }
table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
thead tr { background: #0F172A; color: white; }
th { padding: 9px 12px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
th.right, td.right { text-align: right; }
td { padding: 9px 12px; border-bottom: 1px solid #f3f4f6; font-size: 11px; }
tbody tr:nth-child(even) td { background: #f9fafb; }
.totals { margin-left: auto; width: 260px; }
.total-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 12px; }
.total-row.grand { font-size: 15px; font-weight: bold; color: #0F172A; border-top: 2px solid #0F172A; margin-top: 6px; padding-top: 10px; }
.footer { margin-top: 40px; padding-top: 14px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #9ca3af; }
.orange { color: #F97316; }
</style></head><body>
<div class="header">
  <div>
    ${settings.logo_url ? `<img src="${settings.logo_url.startsWith('http') ? settings.logo_url : (process.env.APP_URL || 'http://localhost:3001') + settings.logo_url}" alt="logo" style="max-height:56px;max-width:200px;margin-bottom:6px;display:block">` : ''}
    <div style="font-weight:bold;font-size:15px">${settings.company_name || ''}</div>
    <div class="company-info">
      ${settings.address_line1 ? `<div>${settings.address_line1}</div>` : ''}
      ${addr ? `<div>${[settings.city, settings.province, settings.postal_code].filter(Boolean).join(', ')}</div>` : ''}
      ${settings.phone ? `<div>${settings.phone}</div>` : ''}
      ${settings.email ? `<div>${settings.email}</div>` : ''}
      ${settings.gst_number ? `<div>GST: ${settings.gst_number}</div>` : ''}
    </div>
  </div>
  <div>
    <div class="invoice-label">Invoice</div>
    <div class="meta">
      <div><strong>#</strong> ${invoice.invoice_number || ''}</div>
      <div><strong>Date:</strong> ${invoice.invoice_date || new Date().toLocaleDateString('en-CA')}</div>
      ${invoice.po_number ? `<div><strong>P.O.:</strong> ${invoice.po_number}</div>` : ''}
      <div><strong>Status:</strong> ${invoice.status || 'draft'}</div>
    </div>
  </div>
</div>

<div class="bill-to-section">
  <div class="bill-box">
    <div class="bill-box-label">Bill To</div>
    <div class="bill-box-value">
      <strong>${customer.name || ''}</strong>
      ${customer.company_name ? `<span>${customer.company_name}</span><br>` : ''}
      ${customer.address_line1 ? `${customer.address_line1}<br>` : ''}
      ${[customer.city, customer.province, customer.postal_code].filter(Boolean).join(', ')}
      ${customer.phone ? `<br>${customer.phone}` : ''}
      ${customer.email ? `<br>${customer.email}` : ''}
    </div>
  </div>
  ${invoice.job_description ? `<div class="bill-box" style="flex:1.5">
    <div class="bill-box-label">Job Description</div>
    <div class="bill-box-value">${invoice.job_description}</div>
  </div>` : ''}
</div>

<table>
  <thead>
    <tr>
      <th>Type</th>
      <th>SKU</th>
      <th>Description</th>
      <th class="right">Qty</th>
      <th class="right">Unit Price</th>
      <th class="right">Total</th>
    </tr>
  </thead>
  <tbody>
    ${displayItems.map(entry => entry.isGroup ? `
    <tr>
      <td colspan="3" style="font-weight:600">${entry.label} <span style="font-size:10px;color:#9ca3af">(${entry.count} item${entry.count !== 1 ? 's' : ''})</span></td>
      <td class="right" style="color:#9ca3af">—</td>
      <td class="right" style="color:#9ca3af">—</td>
      <td class="right" style="font-weight:bold">${fmt(entry.total)}</td>
    </tr>` : `
    <tr>
      <td style="text-transform:capitalize;color:#6b7280">${entry.item.type || ''}</td>
      <td style="font-family:monospace;font-size:10px">${entry.item.sku || ''}</td>
      <td>${entry.item.description || ''}</td>
      <td class="right">${entry.item.quantity || ''}</td>
      <td class="right">${fmt(entry.item.unit_price)}</td>
      <td class="right" style="font-weight:bold">${fmt(entry.item.total)}</td>
    </tr>`).join('')}
  </tbody>
</table>

<div class="totals">
  <div class="total-row"><span>Subtotal</span><span>${fmt(invoice.subtotal)}</span></div>
  ${invoice.gst_enabled ? `<div class="total-row"><span>GST (5%)</span><span>${fmt(Math.round(parseFloat(invoice.subtotal) * 0.05 * 100) / 100)}</span></div>` : ''}
  ${parseFloat(invoice.pst_rate) > 0 ? `<div class="total-row"><span>PST (${invoice.pst_rate}%)</span><span>${fmt(Math.round(parseFloat(invoice.subtotal) * (parseFloat(invoice.pst_rate) / 100) * 100) / 100)}</span></div>` : ''}
  <div class="total-row grand"><span>Balance Due</span><span class="orange">${fmt(invoice.total)}</span></div>
</div>

${settings.etransfer_email ? `<div style="margin-top:20px;font-size:11px;color:#6b7280">E-transfer payment accepted at: <strong>${settings.etransfer_email}</strong></div>` : ''}
${settings.invoice_notes ? `<div class="footer">${settings.invoice_notes}</div>` : ''}
</body></html>`;
}

export default router;
