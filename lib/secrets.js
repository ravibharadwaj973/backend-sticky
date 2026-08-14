const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
//lib/secrets

// Pulls configuration out of AWS Secrets Manager and puts it into process.env
// before the server starts listening.
//
// Every route and middleware in this service already reads process.env.X at
// request time, so populating process.env up front means none of them had to
// change — Secrets Manager is swapped in underneath them.
//
// Behaviour:
//   AWS_SECRET_NAME unset          -> keep whatever .env gave us (local dev, jest)
//   AWS_SECRET_NAME set, fetch ok  -> secret values overwrite process.env
//   AWS_SECRET_NAME set, any error -> throw, and app.js exits(1). A misconfigured
//                                     box must never boot on stale .env secrets.

// Read out of the secret JSON. Anything else in there is ignored.
const SECRET_KEYS = ['JWT_SECRET', 'MONGODB_URI', 'ADMIN_EMAIL', 'ADMIN_PASSWORD'];

// ADMIN_EMAIL/ADMIN_PASSWORD are intentionally not required — routes/admin.js
// still falls back to its own defaults for those.
const REQUIRED_KEYS = ['JWT_SECRET', 'MONGODB_URI'];

// No credentials block on purpose: this runs on EC2, so the SDK picks up the
// instance's IAM role automatically. Access keys never belong in config here.
const buildClient = () => new SecretsManagerClient({ region: process.env.AWS_REGION });

const readSecretString = (response) => {
  if (response.SecretString) return response.SecretString;
  if (response.SecretBinary) return Buffer.from(response.SecretBinary).toString('utf8');
  return null;
};

const loadSecrets = async () => {
  const secretName = process.env.AWS_SECRET_NAME;

  if (!secretName) {
    console.log('[secrets] AWS_SECRET_NAME not set — using .env values');
    return { source: 'env', keys: [] };
  }

  if (!process.env.AWS_REGION) {
    throw new Error('AWS_SECRET_NAME is set but AWS_REGION is missing');
  }

  let raw;
  try {
    const response = await buildClient().send(new GetSecretValueCommand({ SecretId: secretName }));
    raw = readSecretString(response);
  } catch (error) {
    throw new Error(`Could not fetch "${secretName}" from Secrets Manager: ${error.message}`);
  }

  if (!raw) {
    throw new Error(`Secret "${secretName}" is empty`);
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error(`Secret "${secretName}" is not valid JSON — it must be a flat key/value object`);
  }

  const applied = [];
  SECRET_KEYS.forEach((key) => {
    if (payload[key] !== undefined && payload[key] !== '') {
      process.env[key] = String(payload[key]);
      applied.push(key);
    }
  });

  const missing = REQUIRED_KEYS.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Secret "${secretName}" is missing required keys: ${missing.join(', ')}`);
  }

  // Names only — never log the values.
  console.log(`[secrets] Loaded from "${secretName}": ${applied.join(', ')}`);

  return { source: 'secretsmanager', keys: applied };
};

module.exports = { loadSecrets, SECRET_KEYS, REQUIRED_KEYS };
