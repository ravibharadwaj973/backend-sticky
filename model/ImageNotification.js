const mongoose = require('mongoose');

const imageNotificationSchema = new mongoose.Schema({
  message: {
    type: String,
    required: true,
  },
  bucket: String,
  key: String,
  size: Number,
  // plain string, not ObjectId — the SNS Lambda inserts with the raw MongoDB driver
  user: {
    type: String,
    index: true,
  },
  source: {
    type: String,
    default: 'sns',
  },
  eventTime: Date,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// collection name is pinned because the SNS Lambda writes to it directly
module.exports = mongoose.model('ImageNotification', imageNotificationSchema, 'imagenotifications');
