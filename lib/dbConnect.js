const mongoose = require('mongoose');
const { getMongoUri } = require('./config');

const connectDB = async () => {
  try {
    // Called from app.js AFTER loadSecrets(), so this picks up the URI that
    // Secrets Manager just put into process.env.
    await mongoose.connect(getMongoUri());
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

module.exports = connectDB;