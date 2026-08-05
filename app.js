const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const notesRoutes = require('./routes/notes');
const uploadsRoutes = require('./routes/uploads');
const connectDB = require('./lib/dbConnect');

const app = express();

// Middleware
// 10mb so base64 image payloads for the Lambda upload fit
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
const allowedOrigins = [
  'http://localhost:3000',
  'http://13.201.30.11',        // Add your EC2 Public IP
  'http://127.0.0.1',            // Add local host loopback
  process.env.CLIENT_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true
}));

// Database connection
if (process.env.NODE_ENV !== 'test') {
  connectDB();
}


// Routes
app.use('/api/auth', authRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/uploads', uploadsRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// ✅ CORRECT - ONLY ONE 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;