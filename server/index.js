import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import statementsRouter from './routes/statements.js';
import inventoryRouter from './routes/inventory.js';
import suppliersRouter from './routes/suppliers.js';
import settingsRouter from './routes/settings.js';
import customersRouter from './routes/customers.js';
import invoicesRouter from './routes/invoices.js';
import estimatesRouter from './routes/estimates.js';
import calendarRouter from './routes/calendar.js';
import notificationsRouter from './routes/notifications.js';
import publicRouter from './routes/public.js';
import quickbooksRouter from './routes/quickbooks.js';
import { requireAuth } from './middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve uploaded files (logos, etc.)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Public routes (no auth required)
app.use('/api/public', publicRouter);
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// All other API routes require authentication
app.use('/api/statements', requireAuth, statementsRouter);
app.use('/api/inventory', requireAuth, inventoryRouter);
app.use('/api/suppliers', requireAuth, suppliersRouter);
app.use('/api/settings', requireAuth, settingsRouter);
app.use('/api/customers', requireAuth, customersRouter);
app.use('/api/invoices', requireAuth, invoicesRouter);
app.use('/api/estimates', requireAuth, estimatesRouter);
app.use('/api/calendar', requireAuth, calendarRouter);
app.use('/api/notifications', requireAuth, notificationsRouter);
app.use('/api/quickbooks', quickbooksRouter); // auth handled internally (callback is public)

// Serve React app in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`TradeFlow server running on http://localhost:${PORT}`);
});
