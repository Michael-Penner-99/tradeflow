import { Router } from 'express';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { supabase } from '../supabase.js';

const router = Router();

const fmt = (n) => `$${parseFloat(n || 0).toFixed(2)}`;

async function generateEstimateNumber(userId) {
  const year = new Date().getFullYear();
  const { data } = await supabase
    .from('estimates')
    .select('estimate_number')
    .eq('user_id', userId)
    .like('estimate_number', `EST-${year}-%`)
    .order('estimate_number', { ascending: false })
    .limit(1);
  let nextNum = 1;
  if (data && data.length > 0) {
    const parts = data[0].estimate_number.split('-');
    nextNum = (parseInt(parts[2]) || 0) + 1;
  }
  return `EST-${year}-${String(nextNum).padStart(4, '0')}`;
}

function calcTotals(lineItems, gstEnabled, pstRate) {
  const subtotal = lineItems.reduce((s, i) => s + (parseFloat(i.total) || 0), 0);
  const gstAmount = gstEnabled ? Math.round(subtotal * 0.05 * 100) / 100 : 0;
  const pstAmount = pstRate > 0 ? Math.round(subtotal * (parseFloat(pstRate) / 100) * 100) / 100 : 0;
  const total = Math.round((subtotal + gstAmount + pstAmount) * 100) / 100;
  return { subtotal: Math.round(subtotal * 100) / 100, total };
}

function prepareLineItems(lineItems, estimateId) {
  return lineItems.map((item, idx) => ({
    estimate_id: estimateId,
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

// GET /api/estimates
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('estimates')
      .select('*, customers(id, name, company_name)')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/estimates/:id
router.get('/:id', async (req, res) => {
  try {
    const { data: estimate, error } = await supabase
      .from('estimates')
      .select('*, customers(*)')
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .single();
    if (error) throw error;

    const { data: lineItems } = await supabase
      .from('estimate_line_items')
      .select('*')
      .eq('estimate_id', req.params.id)
      .order('sort_order');

    res.json({ ...estimate, line_items: lineItems || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/estimates
router.post('/', async (req, res) => {
  try {
    const { lineItems = [], gstEnabled = true, pstRate = 0, ...rest } = req.body;
    const estimateNumber = rest.estimate_number || await generateEstimateNumber(req.userId);
    const { subtotal, total } = calcTotals(lineItems, gstEnabled, pstRate);

    const { data: estimate, error } = await supabase
      .from('estimates')
      .insert({
        ...rest,
        estimate_number: estimateNumber,
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
        .from('estimate_line_items')
        .insert(prepareLineItems(lineItems, estimate.id));
      if (liErr) throw liErr;
    }

    res.status(201).json({ ...estimate, line_items: lineItems });
  } catch (err) {
    console.error('POST /api/estimates error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/estimates/:id
router.put('/:id', async (req, res) => {
  try {
    const { lineItems = [], gstEnabled = true, pstRate = 0, ...rest } = req.body;
    const { subtotal, total } = calcTotals(lineItems, gstEnabled, pstRate);

    delete rest.id;
    delete rest.created_at;
    delete rest.customers;
    delete rest.line_items;
    delete rest.approval_token;

    const { data: estimate, error } = await supabase
      .from('estimates')
      .update({
        ...rest,
        subtotal,
        gst_enabled: gstEnabled,
        pst_rate: pstRate,
        total,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .select()
      .single();
    if (error) throw error;

    await supabase.from('estimate_line_items').delete().eq('estimate_id', req.params.id);
    if (lineItems.length > 0) {
      await supabase.from('estimate_line_items').insert(prepareLineItems(lineItems, req.params.id));
    }

    res.json({ ...estimate, line_items: lineItems });
  } catch (err) {
    console.error('PUT /api/estimates/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/estimates/:id
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('estimates').delete().eq('id', req.params.id).eq('user_id', req.userId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/estimates/:id/send — email approval link to customer
router.post('/:id/send', async (req, res) => {
  try {
    const token = crypto.randomBytes(32).toString('hex');

    const { data: estimate, error: upErr } = await supabase
      .from('estimates')
      .update({ status: 'sent', approval_token: token })
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .select('*, customers(*)')
      .single();
    if (upErr) throw upErr;

    const { data: settings } = await supabase
      .from('company_settings')
      .select('*')
      .eq('user_id', req.userId)
      .maybeSingle();

    if (estimate.customers?.email && process.env.SMTP_USER && process.env.SMTP_PASS) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      });

      const companyName = settings?.company_name || 'TradeFlow';
      const approvalUrl = `${process.env.APP_URL || 'http://localhost:5173'}/approve/${token}`;

      await transporter.sendMail({
        from: `"${companyName}" <${process.env.SMTP_USER}>`,
        to: estimate.customers.email,
        bcc: settings?.email || undefined,
        subject: `Estimate ${estimate.estimate_number} from ${companyName}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
            <div style="background:#0F172A;padding:20px 24px;border-radius:8px 8px 0 0">
              <span style="color:white;font-size:20px;font-weight:bold">${companyName}</span>
            </div>
            <div style="background:#f9fafb;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
              <h2 style="margin:0 0 8px">Estimate ${estimate.estimate_number}</h2>
              <p style="color:#6b7280;margin:0 0 20px">Hi ${estimate.customers.name}, please review your estimate and approve or decline.</p>
              <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
                <tr><td style="padding:8px 0;color:#6b7280;border-bottom:1px solid #e5e7eb">Job Description</td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb">${estimate.job_description || '—'}</td></tr>
                <tr><td style="padding:8px 0;color:#6b7280;border-bottom:1px solid #e5e7eb">Valid Until</td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb">${estimate.valid_until || '—'}</td></tr>
                <tr><td style="padding:8px 0;color:#6b7280">Total</td><td style="padding:8px 0;font-weight:bold;font-size:20px;color:#0F172A">${fmt(estimate.total)}</td></tr>
              </table>
              <a href="${approvalUrl}" style="display:inline-block;background:#F97316;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px">Review &amp; Approve Estimate</a>
            </div>
          </div>`
      });
    }

    res.json(estimate);
  } catch (err) {
    console.error('POST /api/estimates/:id/send error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/estimates/:id/convert — convert approved estimate to invoice
router.post('/:id/convert', async (req, res) => {
  try {
    const { data: estimate } = await supabase
      .from('estimates')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .single();

    const { data: lineItems } = await supabase
      .from('estimate_line_items')
      .select('*')
      .eq('estimate_id', req.params.id)
      .order('sort_order');

    // Generate invoice number
    const year = new Date().getFullYear();
    const { data: existing } = await supabase
      .from('invoices')
      .select('invoice_number')
      .eq('user_id', req.userId)
      .like('invoice_number', `INV-${year}-%`)
      .order('invoice_number', { ascending: false })
      .limit(1);
    let nextNum = 1;
    if (existing && existing.length > 0) {
      const parts = existing[0].invoice_number.split('-');
      nextNum = (parseInt(parts[2]) || 0) + 1;
    }
    const invoiceNumber = `INV-${year}-${String(nextNum).padStart(4, '0')}`;

    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .insert({
        customer_id: estimate.customer_id,
        invoice_number: invoiceNumber,
        invoice_date: new Date().toISOString().split('T')[0],
        po_number: estimate.po_number,
        job_description: estimate.job_description,
        subtotal: estimate.subtotal,
        gst_enabled: estimate.gst_enabled,
        pst_rate: estimate.pst_rate,
        total: estimate.total,
        status: 'draft',
        notes: estimate.notes,
        user_id: req.userId
      })
      .select()
      .single();
    if (invErr) throw invErr;

    if (lineItems && lineItems.length > 0) {
      await supabase.from('invoice_line_items').insert(
        lineItems.map((item, idx) => ({
          invoice_id: invoice.id,
          type: item.type,
          description: item.description,
          sku: item.sku,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
          markup_percent: item.markup_percent,
          unit_price: item.unit_price,
          total: item.total,
          group_label: item.group_label,
          sort_order: idx
        }))
      );
    }

    await supabase
      .from('estimates')
      .update({ status: 'converted', converted_invoice_id: invoice.id })
      .eq('id', req.params.id);

    res.json({ invoiceId: invoice.id });
  } catch (err) {
    console.error('POST /api/estimates/:id/convert error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
