const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../model/User');
const Note = require('../model/Note');
const ImageNotification = require('../model/ImageNotification');

jest.mock('../model/User');
jest.mock('../model/Note');
jest.mock('../model/ImageNotification');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

const adminToken = () =>
  jwt.sign({ role: 'admin', email: 'ravi@gmail.com' }, process.env.JWT_SECRET, { expiresIn: '1h' });

const userToken = () =>
  jwt.sign({ userId: 'user123', userEmail: 'a@b.com' }, process.env.JWT_SECRET, { expiresIn: '1h' });

describe('Admin Endpoints', () => {
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

  describe('POST /api/admin/login', () => {
    it('logs in with the correct admin credentials', async () => {
      const response = await request(app)
        .post('/api/admin/login')
        .send({ email: 'ravi@gmail.com', password: '123456789' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        token: expect.any(String),
        admin: { email: 'ravi@gmail.com' },
        message: 'Admin logged in successfully',
      });
      expect(response.headers['set-cookie'][0]).toContain('admin_token=');
    });

    it('rejects wrong credentials', async () => {
      const response = await request(app)
        .post('/api/admin/login')
        .send({ email: 'ravi@gmail.com', password: 'wrong' });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Invalid admin credentials' });
    });

    it('rejects missing fields', async () => {
      const response = await request(app).post('/api/admin/login').send({});

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/admin/stats', () => {
    it('rejects requests without a token', async () => {
      const response = await request(app).get('/api/admin/stats');

      expect(response.status).toBe(401);
    });

    it('rejects a normal user token', async () => {
      const response = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${userToken()}`);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: 'Admin access required' });
    });

    it('returns counts for an admin token', async () => {
      User.countDocuments.mockResolvedValue(5);
      Note.countDocuments.mockResolvedValueOnce(10).mockResolvedValueOnce(4);
      ImageNotification.countDocuments.mockResolvedValue(7);

      const response = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        stats: {
          totalUsers: 5,
          totalNotes: 10,
          activeNotes: 6,
          archivedNotes: 4,
          totalUploads: 7,
        },
      });
    });
  });

  describe('GET /api/admin/users', () => {
    it('lists users with their note counts', async () => {
      const lean = jest.fn().mockResolvedValue([
        { _id: 'u1', name: 'Ravi', email: 'a@b.com' },
        { _id: 'u2', name: 'Dev', email: 'c@d.com' },
      ]);
      User.find.mockReturnValue({
        select: () => ({ sort: () => ({ lean }) }),
      });
      Note.aggregate.mockResolvedValue([{ _id: 'u1', count: 3 }]);

      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(response.status).toBe(200);
      expect(response.body.users).toEqual([
        { _id: 'u1', name: 'Ravi', email: 'a@b.com', notesCount: 3 },
        { _id: 'u2', name: 'Dev', email: 'c@d.com', notesCount: 0 },
      ]);
    });
  });

  describe('DELETE /api/admin/users/:id', () => {
    it('deletes the user together with their notes and uploads', async () => {
      User.findByIdAndDelete.mockResolvedValue({ _id: 'u1' });
      Note.deleteMany.mockResolvedValue({ deletedCount: 3 });
      ImageNotification.deleteMany.mockResolvedValue({ deletedCount: 1 });

      const response = await request(app)
        .delete('/api/admin/users/u1')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(response.status).toBe(200);
      expect(Note.deleteMany).toHaveBeenCalledWith({ user: 'u1' });
      expect(ImageNotification.deleteMany).toHaveBeenCalledWith({ user: 'u1' });
    });

    it('returns 404 for an unknown user', async () => {
      User.findByIdAndDelete.mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/admin/users/nope')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/admin/notes', () => {
    it('lists all notes with their owners', async () => {
      const lean = jest.fn().mockResolvedValue([
        { _id: 'n1', title: 'T', user: { _id: 'u1', name: 'Ravi', email: 'a@b.com' } },
      ]);
      Note.find.mockReturnValue({
        sort: () => ({ populate: () => ({ lean }) }),
      });

      const response = await request(app)
        .get('/api/admin/notes')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(response.status).toBe(200);
      expect(response.body.notes).toHaveLength(1);
      expect(response.body.notes[0].user.name).toBe('Ravi');
    });
  });

  describe('GET /api/admin/uploads', () => {
    it('lists upload notifications', async () => {
      const lean = jest.fn().mockResolvedValue([
        { _id: 'x1', message: 'Image uploaded successfully', bucket: 'b', key: 'k' },
      ]);
      ImageNotification.find.mockReturnValue({
        sort: () => ({ limit: () => ({ lean }) }),
      });

      // unset AWS so the test never signs a real url, whatever is in .env
      const savedRegion = process.env.AWS_REGION;
      delete process.env.AWS_REGION;

      const response = await request(app)
        .get('/api/admin/uploads')
        .set('Authorization', `Bearer ${adminToken()}`);

      if (savedRegion !== undefined) process.env.AWS_REGION = savedRegion;

      expect(response.status).toBe(200);
      expect(response.body.uploads).toHaveLength(1);
      expect(response.body.uploads[0].url).toBeNull();
    });
  });
});
