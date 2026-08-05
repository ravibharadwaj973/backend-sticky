const express = require('express');
const Note = require('../model/Note'); // Make sure path is correct
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
//route/notes

// Get all notes for authenticated user
router.get('/', requireAuth, async (req, res) => {
  try {
    const notes = await Note.find({ user: req.userId, isArchived: false })
      .sort({ updatedAt: -1 });
    
    res.json({ notes });
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ error: 'Error fetching notes' });
  }
});

// Get archived notes
router.get('/archived', requireAuth, async (req, res) => {
  try {
    const notes = await Note.find({ user: req.userId, isArchived: true })
      .sort({ updatedAt: -1 });
    
    res.json({ notes });
  } catch (error) {
    console.error('Error fetching archived notes:', error);
    res.status(500).json({ error: 'Error fetching archived notes' });
  }
});

// Get specific note by ID
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const note = await Note.findOne({ _id: id, user: req.userId });

    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    res.json({ note });
  } catch (error) {
    console.error('Error fetching note:', error);
    res.status(500).json({ error: 'Error fetching note' });
  }
});

// Create new note
router.post('/', requireAuth, async (req, res) => {
  try {
    const { title, content, color, position } = req.body;
    
    // Validate required fields
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const note = await Note.create({
      title,
      content,
      color: color || '#ffeb3b',
      position: position || { x: 0, y: 0 },
      user: req.userId,
      isArchived: false
    });

    res.status(201).json({ note });
  } catch (error) {
    console.error('Error creating note:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: 'Invalid note data' });
    }
    
    res.status(500).json({ error: 'Error creating note' });
  }
});

// Update note
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, color, position, isArchived } = req.body;

    const updates = {};
    if (title !== undefined) updates.title = title;
    if (content !== undefined) updates.content = content;
    if (color !== undefined) updates.color = color;
    if (position !== undefined) updates.position = position;
    if (isArchived !== undefined) updates.isArchived = isArchived;

    const note = await Note.findOneAndUpdate(
      { _id: id, user: req.userId },
      updates,
      { new: true, runValidators: true }
    );

    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    res.json({ note });
  } catch (error) {
    console.error('Error updating note:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: 'Invalid update data' });
    }
    
    res.status(500).json({ error: 'Error updating note' });
  }
});

// Archive note
router.patch('/:id/archive', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const note = await Note.findOneAndUpdate(
      { _id: id, user: req.userId },
      { isArchived: true },
      { new: true }
    );

    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    res.json({ note, message: 'Note archived successfully' });
  } catch (error) {
    console.error('Error archiving note:', error);
    res.status(500).json({ error: 'Error archiving note' });
  }
});

// Unarchive note
router.patch('/:id/unarchive', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const note = await Note.findOneAndUpdate(
      { _id: id, user: req.userId },
      { isArchived: false },
      { new: true }
    );

    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    res.json({ note, message: 'Note unarchived successfully' });
  } catch (error) {
    console.error('Error unarchiving note:', error);
    res.status(500).json({ error: 'Error unarchiving note' });
  }
});

// Delete note
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const note = await Note.findOneAndDelete({ _id: id, user: req.userId });

    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    res.json({ message: 'Note deleted successfully' });
    
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ error: 'Error deleting note' });
  }
});

module.exports = router;