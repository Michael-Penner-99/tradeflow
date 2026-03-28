import { Router } from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '../supabase.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

const upload = multer({
  dest: path.join(__dirname, '../uploads/'),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/png', 'image/jpeg'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, PNG, and JPEG files are allowed'));
    }
  }
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

const EXTRACTION_PROMPT =
  'Extract all line items from this supplier statement. Return ONLY a valid JSON array, no markdown, no explanation. Each object must have: { sku, description, quantity, unitCost, totalCost, unit }. Use null for missing fields.';

// POST /api/statements/upload
router.post('/upload', upload.single('file'), async (req, res) => {
  const filePath = req.file?.path;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileBuffer = await fs.readFile(filePath);
    const base64Data = fileBuffer.toString('base64');

    // Gemini handles PDFs and images the same way via inlineData
    const result = await model.generateContent([
      EXTRACTION_PROMPT,
      {
        inlineData: {
          data: base64Data,
          mimeType: req.file.mimetype
        }
      }
    ]);

    const rawText = result.response.text();

    // Strip markdown code fences if present
    let lineItems;
    try {
      const cleaned = rawText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/, '')
        .trim();
      lineItems = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('JSON parse failed. Raw response:', rawText);
      throw new Error('AI response could not be parsed as JSON. Try re-uploading a clearer image.');
    }

    if (!Array.isArray(lineItems)) {
      throw new Error('AI response was not a JSON array');
    }

    // Save statement record with extracted data
    const { data: statement, error: insertError } = await supabase
      .from('supplier_statements')
      .insert({
        file_name: req.file.originalname,
        status: 'pending',
        raw_extracted_data: lineItems
      })
      .select()
      .single();

    if (insertError) throw insertError;

    await fs.unlink(filePath);

    res.json({ statementId: statement.id, lineItems });
  } catch (err) {
    if (filePath) await fs.unlink(filePath).catch(() => {});
    console.error('POST /api/statements/upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/statements/confirm/:id
router.post('/confirm/:id', async (req, res) => {
  const { id } = req.params;
  const { lineItems, supplierId } = req.body;

  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    return res.status(400).json({ error: 'lineItems must be a non-empty array' });
  }

  try {
    const movementDate = new Date().toISOString().split('T')[0];

    for (const item of lineItems) {
      const { sku, description, quantity, unitCost, totalCost, unit } = item;

      if (!sku || !String(sku).trim()) continue;

      const skuClean = String(sku).trim();
      const qty = parseFloat(quantity) || 0;
      const cost = parseFloat(unitCost) || 0;
      const total = parseFloat(totalCost) || qty * cost;

      // Fetch existing item for WAC calculation
      const { data: existing } = await supabase
        .from('inventory_items')
        .select('id, current_stock, weighted_avg_cost')
        .eq('sku', skuClean)
        .maybeSingle();

      const existingStock = parseFloat(existing?.current_stock) || 0;
      const existingWAC = parseFloat(existing?.weighted_avg_cost) || 0;
      const newStock = existingStock + qty;
      const newWAC =
        newStock > 0
          ? (existingStock * existingWAC + qty * cost) / newStock
          : cost;

      const { data: upsertedItem, error: upsertError } = await supabase
        .from('inventory_items')
        .upsert(
          {
            sku: skuClean,
            description: description || existing?.description || null,
            supplier_id: supplierId || null,
            unit: unit || existing?.unit || null,
            current_stock: newStock,
            weighted_avg_cost: Math.round(newWAC * 10000) / 10000,
            last_updated: new Date().toISOString()
          },
          { onConflict: 'sku', ignoreDuplicates: false }
        )
        .select('id')
        .single();

      if (upsertError) {
        console.error('Upsert error for SKU', skuClean, upsertError);
        continue;
      }

      const { error: movementError } = await supabase.from('stock_movements').insert({
        inventory_item_id: upsertedItem.id,
        supplier_id: supplierId || null,
        movement_date: movementDate,
        quantity: qty,
        unit_cost: cost,
        total_cost: total,
        statement_id: id
      });

      if (movementError) {
        console.error('Movement insert error for SKU', skuClean, movementError);
      }
    }

    const { error: updateError } = await supabase
      .from('supplier_statements')
      .update({ status: 'confirmed', supplier_id: supplierId || null })
      .eq('id', id);

    if (updateError) throw updateError;

    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/statements/confirm/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/statements
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('supplier_statements')
      .select(`
        *,
        suppliers (
          id,
          name
        )
      `)
      .order('uploaded_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('GET /api/statements error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
