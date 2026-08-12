const express = require('express');
const { InvokeCommand } = require('@aws-sdk/client-lambda');
const { lambdaClient, presignGet } = require('../lib/aws');
const ImageNotification = require('../model/ImageNotification');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
//route/uploads

// synchronous Lambda invokes cap the payload at 6MB, and base64 adds ~33%
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const missingAwsConfig = () =>
  ['AWS_REGION', 'S3_BUCKET', 'UPLOAD_LAMBDA_NAME'].filter((name) => !process.env[name]);

// Upload an image: backend invokes the Lambda, the Lambda stores it in S3
router.post('/', requireAuth, async (req, res) => {
  try {
    const missing = missingAwsConfig();
    if (missing.length) {
      return res.status(500).json({ error: `AWS not configured, missing env: ${missing.join(', ')}` });
    }

    const { filename, contentType, data } = req.body;

    if (!filename || !contentType || !data) {
      return res.status(400).json({ error: 'filename, contentType and data are required' });
    }

    if (!contentType.startsWith('image/')) {
      return res.status(400).json({ error: 'Only image uploads are allowed' });
    }

    const base64 = data.replace(/^data:[^;]+;base64,/, '');
    const sizeInBytes = Math.floor((base64.length * 3) / 4);

    if (sizeInBytes > MAX_IMAGE_BYTES) {
      return res.status(400).json({ error: 'Image must be smaller than 4MB' });
    }

    // the userId inside the key is how the SNS Lambda knows who uploaded it
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `uploads/${req.userId}/${Date.now()}-${safeName}`;

    const response = await lambdaClient.send(new InvokeCommand({
      FunctionName: process.env.UPLOAD_LAMBDA_NAME,
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify({
        bucket: process.env.S3_BUCKET,
        key,
        contentType,
        data: base64,
      }),
    }));

    const payload = response.Payload
      ? JSON.parse(Buffer.from(response.Payload).toString())
      : null;

    if (response.FunctionError || !payload || !payload.ok) {
      console.error('Lambda upload error:', response.FunctionError, payload);
      return res.status(502).json({ error: 'Lambda failed to store the image in S3' });
    }

    res.status(201).json({
      message: 'Image sent to Lambda and stored in S3',
      key: payload.key,
      bucket: payload.bucket,
      size: payload.size,
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: 'Error uploading image' });
  }
});

// List the SNS notifications the Lambda stored in MongoDB (with viewable S3 links)
router.get('/notifications', requireAuth, async (req, res) => {
  try {
    const docs = await ImageNotification.find({ user: req.userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const notifications = await Promise.all(
      docs.map(async (doc) => ({ ...doc, url: await presignGet(doc.bucket, doc.key) }))
    );

    res.json({ notifications });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Error fetching notifications' });
  }
});

module.exports = router;
