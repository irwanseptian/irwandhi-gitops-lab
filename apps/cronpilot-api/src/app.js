const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const jobsRouter  = require('./routes/jobs');
const execRouter  = require('./routes/executions');
const healthRouter = require('./routes/health');

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

app.use('/api/health',      healthRouter);
app.use('/api/jobs',        jobsRouter);
app.use('/api/executions',  execRouter);

app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
