// Shared AWS clients for the backend routes.
// On EC2 no keys are needed: leave AWS_ACCESS_KEY_ID/SECRET unset and the SDK
// uses the instance's IAM role. Keys in .env are only for local development.
const { LambdaClient } = require('@aws-sdk/client-lambda');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const awsCredentials =
  process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined;

const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION, credentials: awsCredentials });
const s3Client = new S3Client({ region: process.env.AWS_REGION, credentials: awsCredentials });

// Signed link to view a private S3 object; null when AWS isn't configured
const presignGet = async (bucket, key, expiresIn = 300) => {
  if (!bucket || !key || !process.env.AWS_REGION) return null;

  try {
    return await getSignedUrl(
      s3Client,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn }
    );
  } catch (error) {
    console.error('Error signing S3 url:', error);
    return null;
  }
};

module.exports = { lambdaClient, s3Client, presignGet };
