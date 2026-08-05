const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const app = require('../app');
const User = require('../model/User');

// Mock User model and bcryptjs
jest.mock('../model/User');
jest.mock('bcryptjs');

// Set JWT_SECRET in environment if not set
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

describe('Auth Endpoints', () => {
  let consoleSpy;

  beforeAll(() => {
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    consoleSpy.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const mockUserData = {
        _id: 'user123',
        name: 'John Doe',
        email: 'john@example.com'
      };

      // Mock database behaviour
      User.findOne.mockResolvedValue(null); // User does not exist
      User.create.mockResolvedValue(mockUserData);
      bcrypt.hash.mockResolvedValue('hashedPassword123');

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        success: true,
        user: {
          id: 'user123',
          name: 'John Doe',
          email: 'john@example.com'
        },
        message: 'successfully login'
      });
      // Check if cookie is set
      expect(response.headers['set-cookie']).toBeDefined();
      expect(response.headers['set-cookie'][0]).toContain('token=');
    });

    it('should return 400 if user already exists', async () => {
      User.findOne.mockResolvedValue({ email: 'john@example.com' });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'User already exists' });
    });
  });

  describe('POST /api/auth/login', () => {
    it('should log in successfully with correct credentials', async () => {
      const mockUser = {
        _id: 'user123',
        name: 'John Doe',
        email: 'john@example.com',
        password: 'hashedPassword123'
      };

      User.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'john@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        user: {
          id: 'user123',
          name: 'John Doe',
          email: 'john@example.com'
        },
        message: 'successfully login'
      });
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('should return 400 if user is not found', async () => {
      User.findOne.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid credentials' });
    });

    it('should return 400 if password does not match', async () => {
      User.findOne.mockResolvedValue({ email: 'john@example.com' });
      bcrypt.compare.mockResolvedValue(false);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'john@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid credentials' });
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return user details if authenticated', async () => {
      const token = jwt.sign(
        { userId: 'user123', userEmail: 'john@example.com', userName: 'John Doe' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', [`token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        user: {
          id: 'user123',
          email: 'john@example.com',
          name: 'John Doe'
        }
      });
    });

    it('should return user: null if token is missing', async () => {
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ user: null });
    });

    it('should return user: null if token is invalid', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', ['token=invalid-token-here']);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ user: null });
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should clear the token cookie', async () => {
      const response = await request(app).post('/api/auth/logout');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Logged out successfully' });
      expect(response.headers['set-cookie'][0].toLowerCase()).toContain('max-age=0');
    });
  });
});
