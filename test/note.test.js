const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const Note = require('../model/Note');

// Mock Note model
jest.mock('../model/Note');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

describe('Notes Endpoints', () => {
  let token;
  const mockUserId = 'user123';

  beforeAll(() => {
    token = jwt.sign(
      { userId: mockUserId, userEmail: 'john@example.com', userName: 'John Doe' },
      process.env.JWT_SECRET
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/notes', () => {
    it('should return active notes for authenticated user', async () => {
      const mockNotes = [
        { _id: 'note1', title: 'Note 1', content: 'Content 1', color: '#ffeb3b', user: mockUserId, isArchived: false }
      ];

      Note.find.mockImplementation(() => ({
        sort: jest.fn().mockResolvedValue(mockNotes)
      }));

      const response = await request(app)
        .get('/api/notes')
        .set('Cookie', [`token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ notes: mockNotes });
      expect(Note.find).toHaveBeenCalledWith({ user: mockUserId, isArchived: false });
    });

    it('should return 401 if unauthorized', async () => {
      const response = await request(app).get('/api/notes');
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Unauthorized' });
    });
  });

  describe('GET /api/notes/archived', () => {
    it('should return archived notes for authenticated user', async () => {
      const mockNotes = [
        { _id: 'note2', title: 'Note 2', content: 'Content 2', color: '#ffeb3b', user: mockUserId, isArchived: true }
      ];

      Note.find.mockImplementation(() => ({
        sort: jest.fn().mockResolvedValue(mockNotes)
      }));

      const response = await request(app)
        .get('/api/notes/archived')
        .set('Cookie', [`token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ notes: mockNotes });
      expect(Note.find).toHaveBeenCalledWith({ user: mockUserId, isArchived: true });
    });
  });

  describe('POST /api/notes', () => {
    it('should create a new note', async () => {
      const newNote = {
        title: 'New Note',
        content: 'New Content',
        color: '#f44336'
      };

      const createdNote = {
        _id: 'note3',
        ...newNote,
        position: { x: 0, y: 0 },
        user: mockUserId,
        isArchived: false
      };

      Note.create.mockResolvedValue(createdNote);

      const response = await request(app)
        .post('/api/notes')
        .set('Cookie', [`token=${token}`])
        .send(newNote);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ note: createdNote });
      expect(Note.create).toHaveBeenCalledWith(expect.objectContaining({
        title: newNote.title,
        content: newNote.content,
        color: newNote.color,
        user: mockUserId
      }));
    });

    it('should return 400 if title or content is missing', async () => {
      const response = await request(app)
        .post('/api/notes')
        .set('Cookie', [`token=${token}`])
        .send({ title: 'Title only' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Title and content are required' });
    });
  });

  describe('PUT /api/notes/:id', () => {
    it('should update a note', async () => {
      const mockNote = {
        _id: 'note1',
        title: 'Updated Title',
        content: 'Updated Content',
        user: mockUserId
      };

      Note.findOneAndUpdate.mockResolvedValue(mockNote);

      const response = await request(app)
        .put('/api/notes/note1')
        .set('Cookie', [`token=${token}`])
        .send({ title: 'Updated Title', content: 'Updated Content' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ note: mockNote });
      expect(Note.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'note1', user: mockUserId },
        { title: 'Updated Title', content: 'Updated Content' },
        { new: true, runValidators: true }
      );
    });
  });

  describe('PATCH /api/notes/:id/archive', () => {
    it('should archive a note', async () => {
      const mockNote = {
        _id: 'note1',
        title: 'Title',
        content: 'Content',
        user: mockUserId,
        isArchived: true
      };

      Note.findOneAndUpdate.mockResolvedValue(mockNote);

      const response = await request(app)
        .patch('/api/notes/note1/archive')
        .set('Cookie', [`token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ note: mockNote, message: 'Note archived successfully' });
      expect(Note.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'note1', user: mockUserId },
        { isArchived: true },
        { new: true }
      );
    });
  });

  describe('PATCH /api/notes/:id/unarchive', () => {
    it('should unarchive a note', async () => {
      const mockNote = {
        _id: 'note1',
        title: 'Title',
        content: 'Content',
        user: mockUserId,
        isArchived: false
      };

      Note.findOneAndUpdate.mockResolvedValue(mockNote);

      const response = await request(app)
        .patch('/api/notes/note1/unarchive')
        .set('Cookie', [`token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ note: mockNote, message: 'Note unarchived successfully' });
      expect(Note.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'note1', user: mockUserId },
        { isArchived: false },
        { new: true }
      );
    });
  });

  describe('DELETE /api/notes/:id', () => {
    it('should delete a note', async () => {
      const mockNote = {
        _id: 'note1',
        title: 'Title',
        content: 'Content',
        user: mockUserId
      };

      Note.findOneAndDelete.mockResolvedValue(mockNote);

      const response = await request(app)
        .delete('/api/notes/note1')
        .set('Cookie', [`token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Note deleted successfully' });
      expect(Note.findOneAndDelete).toHaveBeenCalledWith({ _id: 'note1', user: mockUserId });
    });
  });
});
