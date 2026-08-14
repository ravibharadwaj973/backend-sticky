const mockSend = jest.fn();

jest.mock('@aws-sdk/client-secrets-manager', () => ({
  SecretsManagerClient: jest.fn(() => ({ send: mockSend })),
  GetSecretValueCommand: jest.fn((input) => ({ input })),
}));

const { loadSecrets } = require('../lib/secrets');
const { SecretsManagerClient } = require('@aws-sdk/client-secrets-manager');

const SECRET_JSON = JSON.stringify({
  JWT_SECRET: 'from-secrets-manager',
  MONGODB_URI: 'mongodb+srv://secret-host/db',
  ADMIN_EMAIL: 'admin@secret.com',
  ADMIN_PASSWORD: 'secret-password',
});

describe('loadSecrets', () => {
  let savedEnv;
  let logSpy;

  beforeEach(() => {
    savedEnv = { ...process.env };
    jest.clearAllMocks();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    delete process.env.AWS_SECRET_NAME;
    delete process.env.JWT_SECRET;
    delete process.env.MONGODB_URI;
    process.env.AWS_REGION = 'ap-south-1';
  });

  afterEach(() => {
    process.env = savedEnv;
    logSpy.mockRestore();
  });

  describe('when AWS_SECRET_NAME is not set', () => {
    it('leaves .env values alone and never calls AWS', async () => {
      process.env.JWT_SECRET = 'from-dotenv';
      process.env.MONGODB_URI = 'mongodb://localhost:27017/dev';

      const result = await loadSecrets();

      expect(result).toEqual({ source: 'env', keys: [] });
      expect(mockSend).not.toHaveBeenCalled();
      expect(process.env.JWT_SECRET).toBe('from-dotenv');
    });
  });

  describe('when AWS_SECRET_NAME is set', () => {
    beforeEach(() => {
      process.env.AWS_SECRET_NAME = 'stickynoted/backend';
    });

    it('puts every key from the secret into process.env', async () => {
      mockSend.mockResolvedValue({ SecretString: SECRET_JSON });

      const result = await loadSecrets();

      expect(result.source).toBe('secretsmanager');
      expect(result.keys).toEqual(['JWT_SECRET', 'MONGODB_URI', 'ADMIN_EMAIL', 'ADMIN_PASSWORD']);
      expect(process.env.JWT_SECRET).toBe('from-secrets-manager');
      expect(process.env.MONGODB_URI).toBe('mongodb+srv://secret-host/db');
      expect(process.env.ADMIN_EMAIL).toBe('admin@secret.com');
      expect(process.env.ADMIN_PASSWORD).toBe('secret-password');
    });

    it('overrides values that .env already set', async () => {
      process.env.JWT_SECRET = 'stale-from-dotenv';
      mockSend.mockResolvedValue({ SecretString: SECRET_JSON });

      await loadSecrets();

      expect(process.env.JWT_SECRET).toBe('from-secrets-manager');
    });

    it('passes the secret name through to AWS and uses AWS_REGION', async () => {
      mockSend.mockResolvedValue({ SecretString: SECRET_JSON });

      await loadSecrets();

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ input: { SecretId: 'stickynoted/backend' } })
      );
      expect(SecretsManagerClient).toHaveBeenCalledWith(
        expect.objectContaining({ region: 'ap-south-1' })
      );
    });

    it('never passes explicit credentials, even if keys are in the environment', async () => {
      // Runs on EC2: the SDK must resolve the instance's IAM role on its own.
      process.env.AWS_ACCESS_KEY_ID = 'AKIA-should-be-ignored';
      process.env.AWS_SECRET_ACCESS_KEY = 'should-be-ignored';
      mockSend.mockResolvedValue({ SecretString: SECRET_JSON });

      await loadSecrets();

      expect(SecretsManagerClient).toHaveBeenCalledWith({ region: 'ap-south-1' });
    });

    it('reads SecretBinary when SecretString is absent', async () => {
      mockSend.mockResolvedValue({ SecretBinary: Buffer.from(SECRET_JSON, 'utf8') });

      await loadSecrets();

      expect(process.env.JWT_SECRET).toBe('from-secrets-manager');
    });

    it('never logs the secret values', async () => {
      mockSend.mockResolvedValue({ SecretString: SECRET_JSON });

      await loadSecrets();

      const logged = logSpy.mock.calls.flat().join(' ');
      expect(logged).toContain('JWT_SECRET');
      expect(logged).not.toContain('from-secrets-manager');
      expect(logged).not.toContain('secret-password');
    });

    it('throws when AWS_REGION is missing', async () => {
      delete process.env.AWS_REGION;

      await expect(loadSecrets()).rejects.toThrow('AWS_REGION is missing');
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('throws when AWS rejects the call', async () => {
      mockSend.mockRejectedValue(new Error('AccessDeniedException'));

      await expect(loadSecrets()).rejects.toThrow(/Could not fetch .* AccessDeniedException/);
    });

    it('throws when the secret is empty', async () => {
      mockSend.mockResolvedValue({});

      await expect(loadSecrets()).rejects.toThrow('is empty');
    });

    it('throws when the secret is not valid JSON', async () => {
      mockSend.mockResolvedValue({ SecretString: 'not-json' });

      await expect(loadSecrets()).rejects.toThrow('not valid JSON');
    });

    it('throws when a required key is missing from the secret', async () => {
      mockSend.mockResolvedValue({ SecretString: JSON.stringify({ ADMIN_EMAIL: 'a@b.com' }) });

      await expect(loadSecrets()).rejects.toThrow(/missing required keys: JWT_SECRET, MONGODB_URI/);
    });

    it('does not treat ADMIN_* as required', async () => {
      mockSend.mockResolvedValue({
        SecretString: JSON.stringify({ JWT_SECRET: 'x', MONGODB_URI: 'y' }),
      });

      await expect(loadSecrets()).resolves.toEqual({
        source: 'secretsmanager',
        keys: ['JWT_SECRET', 'MONGODB_URI'],
      });
    });
  });
});
