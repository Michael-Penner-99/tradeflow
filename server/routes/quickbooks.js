import { Router } from 'express';
import OAuthClient from 'intuit-oauth';
import { supabase } from '../supabase.js';
import { requireAuth } from '../middleware/auth.js';

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
router.get('/connect', requireAuth, (req, res) => {
  try {
    console.log('[QB connect] userId:', req.userId);
    console.log('[QB connect] environment:', process.env.QB_ENVIRONMENT || 'sandbox');
    console.log('[QB connect] redirectUri:', process.env.QB_REDIRECT_URI || 'http://localhost:3001/api/quickbooks/callback');
    const oauthClient = getOAuthClient();
    const authUri = oauthClient.authorizeUri({
      scope: [OAuthClient.scopes.Accounting, OAuthClient.scopes.OpenId],
      state: req.userId
    });
    console.log('[QB connect] authUri:', authUri);
    res.json({ url: authUri });
  } catch (err) {
    console.error('[QB connect] error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/quickbooks/callback (public — browser redirect from Intuit)
router.get('/callback', async (req, res) => {
  try {
    console.log('[QB callback] full URL:', req.url);
    console.log('[QB callback] state (userId):', req.query.state);
    console.log('[QB callback] realmId from query:', req.query.realmId);

    const oauthClient = getOAuthClient();
    const authResponse = await oauthClient.createToken(req.url);
    const token = authResponse.getJson();
    const userId = req.query.state;

    console.log('[QB callback] token keys:', Object.keys(token));
    console.log('[QB callback] realmId from token:', token.realmId);
    console.log('[QB callback] realmId from oauthClient:', oauthClient.getToken().realmId);

    if (!userId) throw new Error('Missing user ID in OAuth state');

    const realmId = token.realmId || oauthClient.getToken().realmId || req.query.realmId;
    console.log('[QB callback] final realmId:', realmId);

    const tokenData = {
      user_id: userId,
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      realm_id: realmId,
      token_expires_at: new Date(Date.now() + (token.expires_in || 3600) * 1000).toISOString(),
      updated_at: new Date().toISOString()
    };

    // Check if row exists for this user
    const { data: existing } = await supabase
      .from('quickbooks_tokens')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    console.log('[QB callback] existing row:', existing);

    if (existing) {
      const { error: updateErr } = await supabase
        .from('quickbooks_tokens')
        .update(tokenData)
        .eq('id', existing.id);
      if (updateErr) throw updateErr;
      console.log('[QB callback] updated existing row', existing.id);
    } else {
      // Claim legacy row (user_id NULL) if one exists, otherwise insert
      const { data: legacy } = await supabase
        .from('quickbooks_tokens')
        .select('id')
        .is('user_id', null)
        .maybeSingle();

      console.log('[QB callback] legacy row:', legacy);

      if (legacy) {
        const { error: claimErr } = await supabase
          .from('quickbooks_tokens')
          .update(tokenData)
          .eq('id', legacy.id);
        if (claimErr) throw claimErr;
        console.log('[QB callback] claimed legacy row', legacy.id);
      } else {
        const { error: insertErr } = await supabase
          .from('quickbooks_tokens')
          .insert(tokenData);
        if (insertErr) throw insertErr;
        console.log('[QB callback] inserted new row');
      }
    }

    console.log('[QB callback] SUCCESS — redirecting to settings');
    res.redirect(`${process.env.APP_URL || 'http://localhost:5173'}/settings?qb=connected`);
  } catch (err) {
    console.error('[QB callback] ERROR:', err);
    res.redirect(`${process.env.APP_URL || 'http://localhost:5173'}/settings?qb=error`);
  }
});

// GET /api/quickbooks/status
router.get('/status', requireAuth, async (req, res) => {
  try {
    const { data } = await supabase
      .from('quickbooks_tokens')
      .select('realm_id, token_expires_at, updated_at')
      .eq('user_id', req.userId)
      .maybeSingle();
    if (!data?.realm_id) return res.json({ connected: false });
    const isExpired = data.token_expires_at && new Date(data.token_expires_at) < new Date();
    res.json({ connected: true, realmId: data.realm_id, isExpired, updatedAt: data.updated_at });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/quickbooks/disconnect
router.post('/disconnect', requireAuth, async (req, res) => {
  try {
    await supabase
      .from('quickbooks_tokens')
      .update({ access_token: null, refresh_token: null, realm_id: null })
      .eq('user_id', req.userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/quickbooks/export/:invoiceId
router.post('/export/:invoiceId', requireAuth, async (req, res) => {
  try {
    console.log('[QB export] invoiceId:', req.params.invoiceId, 'userId:', req.userId);

    const { data: tokens } = await supabase
      .from('quickbooks_tokens')
      .select('*')
      .eq('user_id', req.userId)
      .maybeSingle();

    console.log('[QB export] tokens found:', !!tokens, 'realmId:', tokens?.realm_id);
    if (!tokens?.realm_id) return res.status(400).json({ error: 'QuickBooks not connected' });

    const [{ data: invoice }, { data: lineItems }] = await Promise.all([
      supabase.from('invoices').select('*, customers(*)').eq('id', req.params.invoiceId).eq('user_id', req.userId).single(),
      supabase.from('invoice_line_items').select('*').eq('invoice_id', req.params.invoiceId).order('sort_order')
    ]);

    console.log('[QB export] invoice:', invoice?.invoice_number, 'customer:', invoice?.customers?.name);
    console.log('[QB export] line items:', lineItems?.length || 0);

    const oauthClient = getOAuthClient();
    oauthClient.setToken({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      realmId: tokens.realm_id
    });

    // Refresh token if expired
    const isExpired = tokens.token_expires_at && new Date(tokens.token_expires_at) < new Date();
    console.log('[QB export] token expired:', isExpired);

    if (isExpired) {
      console.log('[QB export] refreshing token...');
      const refreshed = await oauthClient.refresh();
      const t = refreshed.getJson();
      await supabase.from('quickbooks_tokens').update({
        access_token: t.access_token,
        refresh_token: t.refresh_token,
        token_expires_at: new Date(Date.now() + (t.expires_in || 3600) * 1000).toISOString(),
        updated_at: new Date().toISOString()
      }).eq('user_id', req.userId);
      console.log('[QB export] token refreshed');
    }

    const baseUrl = process.env.QB_ENVIRONMENT === 'production'
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';

    const apiUrl = `${baseUrl}/v3/company/${tokens.realm_id}/invoice`;
    console.log('[QB export] API URL:', apiUrl);
    console.log('[QB export] environment:', process.env.QB_ENVIRONMENT || 'sandbox');

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

    console.log('[QB export] request body:', JSON.stringify(qbInvoiceBody, null, 2));

    const response = await oauthClient.makeApiCall({
      url: apiUrl,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ Invoice: qbInvoiceBody })
    });

    let responseData;
    if (typeof response.getJson === 'function') {
      responseData = response.getJson();
    } else if (typeof response.text === 'string') {
      responseData = JSON.parse(response.text);
    } else if (response.body) {
      responseData = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
    } else {
      responseData = response;
    }
    console.log('[QB export] response:', JSON.stringify(responseData, null, 2));

    const fault = responseData?.Fault || responseData?.fault;
    if (fault) {
      const errors = fault.Error || fault.error || [];
      const detail = errors[0]?.Detail || errors[0]?.detail || errors[0]?.message || 'QuickBooks rejected the invoice';
      throw new Error(detail);
    }

    console.log('[QB export] SUCCESS — qbInvoiceId:', responseData?.Invoice?.Id);
    res.json({ success: true, qbInvoiceId: responseData?.Invoice?.Id });
  } catch (err) {
    console.error('[QB export] ERROR:', err.message || err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
