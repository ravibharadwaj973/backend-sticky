const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const notesRoutes = require('./routes/notes');
const uploadsRoutes = require('./routes/uploads');
const adminRoutes = require('./routes/admin');
const connectDB = require('./lib/dbConnect');
const { loadSecrets } = require('./lib/secrets');

const app = express();

// Middleware
// 10mb so base64 image payloads for the Lambda upload fit
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    console.log("Origin:", origin);

    if (!origin) return callback(null, true);

    if (
      allowedOrigins.includes(origin) ||
      /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.56\.1|15\.206\.93\.53)(:\d+)?$/.test(origin)
    ) {
      return callback(null, true);
    }

    console.log("Blocked Origin:", origin);

    return callback(new Error("Not allowed by CORS"), false);
  },
  credentials: true
}));

app.use((req, res, next) => {
    console.log(req.method, req.originalUrl);
    next();
});
// Routes
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok'
  });
});
app.use('/api/auth', authRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/admin', adminRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// ✅ CORRECT - ONLY ONE 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Secrets first (they carry MONGODB_URI and JWT_SECRET), then the database,
// then start listening. Nothing serves traffic until the config is settled.
const start = async () => {
  try {
    const { source } = await loadSecrets();
    // Printed on every boot so CloudWatch shows at a glance whether this
    // container is on the real secret or on a .env that got baked in.
    console.log(`[backend] config source: ${source}`);
  } catch (error) {
    console.error('[secrets]', error.message);
    console.error('[secrets] Refusing to start on possibly stale .env values.');
    process.exit(1);
  }

  connectDB();

  const PORT = process.env.PORT || 5000;
 app.listen(PORT, "0.0.0.0", () => {
  console.log("Backend running on port 5000");
});
};

if (process.env.NODE_ENV !== 'test') {
  start();
}

module.exports = app;