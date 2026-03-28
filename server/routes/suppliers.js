import { Router } from 'express';
import { supabase } from '../supabase.js';

const router = Router();

// GET /api/suppliers
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('name');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('GET /api/suppliers error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/suppliers
router.post('/', async (req, res) => {
  try {
    const { name, account_number } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Supplier name is required' });
    }

    const { data, error } = await supabase
      .from('suppliers')
      .insert({ name: name.trim(), account_number: account_number?.trim() || null })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('POST /api/suppliers error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
