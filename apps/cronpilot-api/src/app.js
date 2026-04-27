const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const jobsRouter   = require('./routes/jobs');
const execRouter   = require('./routes/executions');
const healthRouter = require('./routes/health');
const authRouter     = require('./routes/auth');
const adminRouter    = require('./routes/admin');
const requireAuth    = require('./middleware/auth');
const requireAdmin   = require('./middleware/requireAdmin');

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

app.use('/api/health',      healthRouter);
app.use('/api/auth',        authRouter);
app.use('/api/jobs',        requireAuth, jobsRouter);
app.use('/api/executions',  requireAuth, execRouter);
app.use('/api/admin',       requireAuth, requireAdmin, adminRouter);

app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
