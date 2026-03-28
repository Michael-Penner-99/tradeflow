import { Router } from 'express';
import { supabase } from '../supabase.js';

const router = Router();

// GET /api/inventory
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('inventory_items')
      .select(`
        *,
        suppliers (
          id,
          name
        )
      `)
      .order('sku');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('GET /api/inventory error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
