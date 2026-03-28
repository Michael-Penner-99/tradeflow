import { Router } from 'express';
import { supabase } from '../supabase.js';

const router = Router();

// GET /api/public/estimates/:token
router.get('/estimates/:token', async (req, res) => {
  try {
    const { data: estimate, error } = await supabase
      .from('estimates')
      .select('*, customers(name, email, company_name)')
      .eq('approval_token', req.params.token)
      .single();
    if (error || !estimate) return res.status(404).json({ error: 'Estimate not found' });

    const { data: lineItems } = await supabase
      .from('estimate_line_items')
      .select('*')
      .eq('estimate_id', estimate.id)
      .order('sort_order');

    const { data: settings } = await supabase
      .from('company_settings')
      .select('company_name, logo_url, phone, email, address_line1, city, province, gst_number, etransfer_email')
      .limit(1)
      .maybeSingle();

    // Mark as viewed if still 'sent'
    if (estimate.status === 'sent') {
      await supabase.from('estimates').update({ status: 'viewed' }).eq('id', estimate.id);
      await supabase.from('notifications').insert({
        type: 'estimate_viewed',
        message: `${estimate.customers?.name || 'Customer'} viewed estimate ${estimate.estimate_number}`,
        link: `/estimates/${estimate.id}/edit`
      });
    }

    res.json({ ...estimate, line_items: lineItems || [], settings: settings || {} });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/public/estimates/:token/respond
router.post('/estimates/:token/respond', async (req, res) => {
  try {
    const { action } = req.body; // 'approve' | 'decline'
    if (!['approve', 'decline'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const { data: estimate, error } = await supabase
      .from('estimates')
      .select('*, customers(name)')
      .eq('approval_token', req.params.token)
      .single();
    if (error || !estimate) return res.status(404).json({ error: 'Estimate not found' });

    if (['approved', 'declined', 'converted'].includes(estimate.status)) {
      return res.status(409).json({ error: 'Estimate already responded to', status: estimate.status });
    }

    const newStatus = action === 'approve' ? 'approved' : 'declined';
    await supabase.from('estimates').update({ status: newStatus }).eq('id', estimate.id);

    const customerName = estimate.customers?.name || 'Customer';
    await supabase.from('notifications').insert({
      type: action === 'approve' ? 'estimate_approved' : 'estimate_declined',
      message: action === 'approve'
        ? `${customerName} approved estimate ${estimate.estimate_number}`
        : `${customerName} declined estimate ${estimate.estimate_number}`,
      link: `/estimates/${estimate.id}/edit`
    });

    res.json({ status: newStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
