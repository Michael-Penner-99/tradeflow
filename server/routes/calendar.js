import { Router } from 'express';
import { supabase } from '../supabase.js';

const router = Router();

// GET /api/calendar
router.get('/', async (req, res) => {
  try {
    const { start, end } = req.query;
    let query = supabase
      .from('calendar_events')
      .select('*, customers(id, name), invoices(id, invoice_number), estimates(id, estimate_number)')
      .eq('user_id', req.userId)
      .order('start_time');
    if (start) query = query.gte('start_time', start);
    if (end) query = query.lte('start_time', end);
    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/calendar
router.post('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('calendar_events')
      .insert({ ...req.body, user_id: req.userId })
      .select('*, customers(id, name)')
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/calendar/:id
router.put('/:id', async (req, res) => {
  try {
    const body = { ...req.body };
    delete body.id;
    delete body.created_at;
    delete body.customers;
    delete body.invoices;
    delete body.estimates;
    const { data, error } = await supabase
      .from('calendar_events')
      .update(body)
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .select('*, customers(id, name)')
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/calendar/:id
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('calendar_events').delete().eq('id', req.params.id).eq('user_id', req.userId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
