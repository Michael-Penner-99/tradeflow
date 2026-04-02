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

// PUT /api/inventory/:id
router.put('/:id', async (req, res) => {
  try {
    const { sku, description, supplier_id, current_stock, unit, weighted_avg_cost } = req.body;
    const { data, error } = await supabase
      .from('inventory_items')
      .update({
        sku,
        description,
        supplier_id: supplier_id || null,
        current_stock,
        unit,
        weighted_avg_cost,
        last_updated: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select(`*, suppliers ( id, name )`)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('PUT /api/inventory error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/inventory/:id
router.delete('/:id', async (req, res) => {
  try {
    // Delete related stock movements first
    await supabase.from('stock_movements').delete().eq('inventory_item_id', req.params.id);
    const { error } = await supabase.from('inventory_items').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/inventory error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/inventory/suppliers (for dropdown)
router.get('/suppliers', async (req, res) => {
  try {
    const { data, error } = await supabase.from('suppliers').select('id, name').order('name');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
