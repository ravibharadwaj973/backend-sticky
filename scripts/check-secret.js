#!/usr/bin/env node
// Verifies the Secrets Manager wiring WITHOUT starting the server and WITHOUT
// printing any secret value. Run it on the box that will host the service:
//
//   node scripts/check-secret.js
//
// It answers the three questions that actually go wrong in practice:
//   1. can this machine's IAM role read the secret at all?
//   2. is the secret valid JSON?
//   3. does it contain the keys this service needs?
require('dotenv').config();

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { SECRET_KEYS, REQUIRED_KEYS } = require('../lib/secrets');

const secretName = process.env.AWS_SECRET_NAME;
const region = process.env.AWS_REGION;

const fail = (message, hint) => {
  console.error(`\n✗ ${message}`);
  if (hint) console.error(`  ${hint}`);
  process.exit(1);
};

(async () => {
  console.log(`region      : ${region || '(unset)'}`);
  console.log(`secret name : ${secretName || '(unset)'}`);

  if (!secretName) {
    fail(
      'AWS_SECRET_NAME is not set, so this service would read .env instead.',
      'Set AWS_SECRET_NAME=sticky-keys to use Secrets Manager.'
    );
  }

  if (!region) {
    fail('AWS_REGION is not set.', 'Secrets are regional — set AWS_REGION=ap-south-1.');
  }

  let response;
  try {
    // No credentials block: the instance/task IAM role is resolved by the SDK.
    const client = new SecretsManagerClient({ region });
    response = await client.send(new GetSecretValueCommand({ SecretId: secretName }));
  } catch (error) {
    fail(
      `Could not read the secret: ${error.name} — ${error.message}`,
      'Check the role has secretsmanager:GetSecretValue and that the policy ARN ends with -*'
    );
  }

  const raw = response.SecretString || (response.SecretBinary
    ? Buffer.from(response.SecretBinary).toString('utf8')
    : null);

  if (!raw) fail('The secret is empty.');

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    fail(
      'The secret is not valid JSON.',
      'It must be a flat key/value object — recreate it as Key/value, not Plaintext.'
    );
  }

  // Names only. Values are never printed.
  const present = Object.keys(payload);
  console.log(`\nkeys in the secret : ${present.join(', ')}`);

  const missing = REQUIRED_KEYS.filter((key) => !payload[key]);
  const used = SECRET_KEYS.filter((key) => payload[key]);
  const ignored = present.filter((key) => !SECRET_KEYS.includes(key));

  console.log(`this service uses  : ${used.join(', ') || '(none)'}`);
  if (ignored.length) console.log(`ignored by this svc: ${ignored.join(', ')}`);

  if (missing.length) {
    fail(`Missing required keys: ${missing.join(', ')}`, 'The service will refuse to start.');
  }

  console.log('\n✓ Secret is readable, valid JSON, and has every required key.');
})();
