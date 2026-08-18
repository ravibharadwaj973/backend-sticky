// Required at the top of the file, BEFORE any of these env vars are set —
// mirroring how app.js requires every route long before loadSecrets() runs.
const { getJwtSecret, getMongoUri, getAdminCredentials, useSecureCookies } = require('../lib/config');

describe('config accessors', () => {
  let savedEnv;

  beforeEach(() => {
    savedEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = savedEnv;
  });

  describe('getJwtSecret', () => {
    // This is the property the whole design rests on. Routes and middleware are
    // require()d before Secrets Manager is read; if any of them captured the
    // value at module scope they would freeze in `undefined`.
    it('reads the value at call time, not at require time', () => {
      delete process.env.JWT_SECRET;

      process.env.JWT_SECRET = 'arrived-from-secrets-manager';

      expect(getJwtSecret()).toBe('arrived-from-secrets-manager');
    });

    it('picks up a rotated value on the next call', () => {
      process.env.JWT_SECRET = 'first';
      expect(getJwtSecret()).toBe('first');

      process.env.JWT_SECRET = 'rotated';
      expect(getJwtSecret()).toBe('rotated');
    });

    it('throws a message naming the key and its source when missing', () => {
      delete process.env.JWT_SECRET;

      expect(() => getJwtSecret()).toThrow(/JWT_SECRET is not set/);
      expect(() => getJwtSecret()).toThrow(/AWS Secrets Manager/);
    });

    it('treats an empty string as missing', () => {
      process.env.JWT_SECRET = '';

      expect(() => getJwtSecret()).toThrow(/JWT_SECRET is not set/);
    });
  });

  describe('getMongoUri', () => {
    it('returns the configured uri', () => {
      process.env.MONGODB_URI = 'mongodb+srv://from-secret/db';

      expect(getMongoUri()).toBe('mongodb+srv://from-secret/db');
    });

    it('falls back to localhost so an unconfigured dev box still boots', () => {
      delete process.env.MONGODB_URI;

      expect(getMongoUri()).toBe('mongodb://localhost:27017/your-db-name');
    });
  });

  describe('getAdminCredentials', () => {
    it('prefers the values loaded from the secret', () => {
      process.env.ADMIN_EMAIL = 'admin@secret.com';
      process.env.ADMIN_PASSWORD = 'secret-password';

      expect(getAdminCredentials()).toEqual({
        email: 'admin@secret.com',
        password: 'secret-password',
      });
    });

    it('keeps the historical defaults when unset', () => {
      delete process.env.ADMIN_EMAIL;
      delete process.env.ADMIN_PASSWORD;

      expect(getAdminCredentials()).toEqual({
        email: 'ravi@gmail.com',
        password: '123456789',
      });
    });
  });

  describe('useSecureCookies', () => {
    it('is true only for the exact string "true"', () => {
      process.env.COOKIE_SECURE = 'true';
      expect(useSecureCookies()).toBe(true);

      process.env.COOKIE_SECURE = 'false';
      expect(useSecureCookies()).toBe(false);

      delete process.env.COOKIE_SECURE;
      expect(useSecureCookies()).toBe(false);
    });
  });
});
