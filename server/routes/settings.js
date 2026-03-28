import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { fileURLToPath } from 'url';
import { supabase } from '../supabase.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

// Save to OS temp dir — deleted after upload to Supabase Storage
const logoUpload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PNG, JPG, WebP, or SVG images allowed'));
    }
  }
});

// GET /api/settings
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('company_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    res.json(data || {});
  } catch (err) {
    console.error('GET /api/settings error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings
router.put('/', async (req, res) => {
  try {
    const { data: existing } = await supabase
      .from('company_settings')
      .select('id')
      .limit(1)
      .maybeSingle();

    let result;
    if (existing) {
      result = await supabase
        .from('company_settings')
        .update(req.body)
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from('company_settings')
        .insert(req.body)
        .select()
        .single();
    }

    if (result.error) throw result.error;
    res.json(result.data);
  } catch (err) {
    console.error('PUT /api/settings error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/settings/logo — upload to Supabase Storage (persists across deploys)
router.post('/logo', logoUpload.single('logo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const fileBuffer = await fs.readFile(req.file.path);
    const ext = path.extname(req.file.originalname) || '.png';
    const fileName = `logo-${Date.now()}${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('logos')
      .upload(fileName, fileBuffer, { contentType: req.file.mimetype, upsert: true });

    // Always clean up temp file
    await fs.unlink(req.file.path).catch(() => {});

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(fileName);

    const { data: existing } = await supabase
      .from('company_settings')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (existing) {
      await supabase.from('company_settings').update({ logo_url: publicUrl }).eq('id', existing.id);
    } else {
      await supabase.from('company_settings').insert({ logo_url: publicUrl });
    }

    res.json({ logo_url: publicUrl });
  } catch (err) {
    console.error('POST /api/settings/logo error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
