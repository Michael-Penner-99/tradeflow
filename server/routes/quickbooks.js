import { Router } from 'express';
import OAuthClient from 'intuit-oauth';
import { supabase } from '../supabase.js';

const router = Router();

function getOAuthClient() {
  return new OAuthClient({
    clientId: process.env.QB_CLIENT_ID || '',
    clientSecret: process.env.QB_CLIENT_SECRET || '',
    environment: process.env.QB_ENVIRONMENT || 'sandbox',
    redirectUri: process.env.QB_REDIRECT_URI || 'http://localhost:3001/api/quickbooks/callback'
  });
}

// GET /api/quickbooks/connect
router.get('/connect', (req, res) => {
  try {
    const oauthClient = getOAuthClient();
    const authUri = oauthClient.authorizeUri({
      scope: [OAuthClient.scopes.Accounting, OAuthClient.scopes.OpenId],
      state: 'tradeflow'
    });
    res.json({ url: authUri });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/quickbooks/callback
router.get('/callback', async (req, res) => {
  try {
    const oauthClient = getOAuthClient();
    const authResponse = await oauthClient.createToken(req.url);
    const token = authResponse.getJson();

    await supabase.from('quickbooks_tokens').upsert({
      id: 1,
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      realm_id: token.realmId || oauthClient.getToken().realmId,
      token_expires_at: new Date(Date.now() + (token.expires_in || 3600) * 1000).toISOString(),
      updated_at: new Date().toISOString()
    });

    res.redirect(`${process.env.APP_URL || 'http://localhost:5173'}/settings?qb=connected`);
  } catch (err) {
    console.error('QB callback error:', err);
    res.redirect(`${process.env.APP_URL || 'http://localhost:5173'}/settings?qb=error`);
  }
});

// GET /api/quickbooks/status
router.get('/status', async (req, res) => {
  try {
    const { data } = await supabase
      .from('quickbooks_tokens')
      .select('realm_id, token_expires_at, updated_at')
      .eq('id', 1)
      .maybeSingle();
    if (!data?.realm_id) return res.json({ connected: false });
    const isExpired = data.token_expires_at && new Date(data.token_expires_at) < new Date();
    res.json({ connected: true, realmId: data.realm_id, isExpired, updatedAt: data.updated_at });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/quickbooks/disconnect
router.post('/disconnect', async (req, res) => {
  try {
    await supabase
      .from('quickbooks_tokens')
      .update({ access_token: null, refresh_token: null, realm_id: null })
      .eq('id', 1);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/quickbooks/export/:invoiceId
router.post('/export/:invoiceId', async (req, res) => {
  try {
    const { data: tokens } = await supabase
      .from('quickbooks_tokens')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (!tokens?.realm_id) return res.status(400).json({ error: 'QuickBooks not connected' });

    const [{ data: invoice }, { data: lineItems }] = await Promise.all([
      supabase.from('invoices').select('*, customers(*)').eq('id', req.params.invoiceId).single(),
      supabase.from('invoice_line_items').select('*').eq('invoice_id', req.params.invoiceId).order('sort_order')
    ]);

    const oauthClient = getOAuthClient();
    oauthClient.setToken({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      realmId: tokens.realm_id
    });

    // Refresh token if expired
    if (tokens.token_expires_at && new Date(tokens.token_expires_at) < new Date()) {
      const refreshed = await oauthClient.refresh();
      const t = refreshed.getJson();
      await supabase.from('quickbooks_tokens').update({
        access_token: t.access_token,
        refresh_token: t.refresh_token,
        token_expires_at: new Date(Date.now() + (t.expires_in || 3600) * 1000).toISOString(),
        updated_at: new Date().toISOString()
      }).eq('id', 1);
    }

    const baseUrl = process.env.QB_ENVIRONMENT === 'production'
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';

    const qbInvoiceBody = {
      DocNumber: invoice.invoice_number,
      TxnDate: invoice.invoice_date,
      CustomerRef: { name: invoice.customers?.name || 'Customer' },
      Line: (lineItems || []).map((item, i) => ({
        LineNum: i + 1,
        Description: `${item.sku ? item.sku + ' - ' : ''}${item.description || ''}`,
        Amount: parseFloat(item.total) || 0,
        DetailType: 'SalesItemLineDetail',
        SalesItemLineDetail: {
          UnitPrice: parseFloat(item.unit_price) || 0,
          Qty: parseFloat(item.quantity) || 1
        }
      }))
    };

    const response = await oauthClient.makeApiCall({
      url: `${baseUrl}/v3/company/${tokens.realm_id}/invoice`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ Invoice: qbInvoiceBody })
    });

    const responseData = JSON.parse(response.text());
    res.json({ success: true, qbInvoiceId: responseData.Invoice?.Id });
  } catch (err) {
    console.error('QB export error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
