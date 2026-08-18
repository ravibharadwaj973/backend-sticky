//lib/config

// The single place the app reads credentials from.
//
// Values land in process.env from AWS Secrets Manager (lib/secrets.js) before
// app.listen() runs, or from .env when AWS_SECRET_NAME is unset. Going through
// these accessors instead of touching process.env directly buys two things:
//
//   1. The read happens at CALL time, so it can never capture a value from
//      before the secret was loaded. Routes are require()d at the top of
//      app.js — long before loadSecrets() — so a module-scope
//      `const S = process.env.JWT_SECRET` would freeze in `undefined`.
//      Calling getJwtSecret() inside a handler cannot make that mistake.
//   2. A missing value fails with a message naming the key and where it should
//      have come from, instead of jsonwebtoken's "secretOrPrivateKey must have
//      a value".

const required = (key) => {
  const value = process.env[key];

  if (!value) {
    throw new Error(
      `${key} is not set. It comes from AWS Secrets Manager when AWS_SECRET_NAME ` +
      `is set, otherwise from backend/.env — see lib/secrets.js.`
    );
  }

  return value;
};

// Signs and verifies every user and admin token. The todo-service verifies
// tokens with this same value, which is why both services read it from one
// shared secret.
const getJwtSecret = () => required('JWT_SECRET');

// Keeps the historical localhost fallback so an unconfigured local box still
// boots; in production loadSecrets() has already guaranteed a real value.
const getMongoUri = () => process.env.MONGODB_URI || 'mongodb://localhost:27017/your-db-name';

// Fixed admin login, not a database user. Defaults preserved for local dev.
const getAdminCredentials = () => ({
  email: process.env.ADMIN_EMAIL || 'ravi@gmail.com',
  password: process.env.ADMIN_PASSWORD || '123456789',
});

// Browsers drop Secure cookies over plain http://, so this stays false until TLS.
const useSecureCookies = () => process.env.COOKIE_SECURE === 'true';

module.exports = { getJwtSecret, getMongoUri, getAdminCredentials, useSecureCookies };
