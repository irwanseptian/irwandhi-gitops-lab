const express = require('express');
const path    = require('path');
const { v4: uuid } = require('uuid');
const store   = require('./store');

const app  = express();
const PORT = process.env.PORT || 4000;

// SSE clients for real-time dashboard
const sseClients = new Set();

function broadcast(payload) {
  const msg = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of sseClients) res.write(msg);
}

// Capture raw body as text for all webhook routes before other parsers
app.use((req, res, next) => {
  if (req.path.startsWith('/__') || req.path === '/health') return next();
  let raw = '';
  req.on('data', chunk => (raw += chunk));
  req.on('end', () => {
    req.rawBody = raw;
    next();
  });
});

// ── Internal routes ────────────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Dashboard HTML
app.use('/__dashboard', express.static(path.join(__dirname, '..', 'public')));

// Server-Sent Events stream
app.get('/__events', (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // Send existing history on connect
  res.write(`data: ${JSON.stringify({ type: 'init', data: store.getAll() })}\n\n`);

  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

// History JSON API
app.get('/__history', (_req, res) => res.json(store.getAll()));

app.delete('/__history', (_req, res) => {
  store.clear();
  broadcast({ type: 'clear' });
  res.status(204).send();
});

// ── Catch-all webhook receiver ─────────────────────────────────────────────

app.all('*', (req, res) => {
  const contentType = req.headers['content-type'] || '';
  let body = req.rawBody || null;

  // Try to parse as JSON for nicer display
  if (body && contentType.includes('application/json')) {
    try { body = JSON.parse(body); } catch { /* keep as string */ }
  }

  // Allow caller to control response status via ?__status=201 etc.
  const respondStatus = Math.min(Math.max(parseInt(req.query.__status || '200') || 200, 100), 599);

  // Strip internal control params from the logged query
  const query = { ...req.query };
  delete query.__status;

  const entry = {
    id:         uuid(),
    timestamp:  new Date().toISOString(),
    method:     req.method,
    path:       req.path,
    query,
    headers:    req.headers,
    body,
    respondedWith: respondStatus,
  };

  store.add(entry);
  broadcast({ type: 'request', data: entry });

  res.status(respondStatus).json({
    ok:          true,
    id:          entry.id,
    received_at: entry.timestamp,
  });
});

app.listen(PORT, () =>
  console.log(`cron-webhook listening on :${PORT}  —  dashboard: http://localhost:${PORT}/__dashboard`)
);
