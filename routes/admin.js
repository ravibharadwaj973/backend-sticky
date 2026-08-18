const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../model/User');
const Note = require('../model/Note');
const ImageNotification = require('../model/ImageNotification');
const { requireAdmin } = require('../middleware/adminAuth');
const { presignGet } = require('../lib/aws');
const { getJwtSecret, getAdminCredentials, useSecureCookies } = require('../lib/config');

const router = express.Router();
//route/admin

// Admin login (fixed credentials from env, not a database user)
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(email)

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Read per request, so a rotated secret takes effect on the next restart
    // without this module having cached anything.
    const admin = getAdminCredentials();

    if (email !== admin.email || password !== admin.password) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    const token = jwt.sign(
      { role: 'admin', email },
      getJwtSecret(),
      { expiresIn: '7d' }
    );
  res.cookie('admin_token', token, {
      httpOnly: true,
      secure: useSecureCookies(),
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 * 1000, // 7 days in milliseconds
      path: '/',
    });

  
    res.json({
      success: true,
      token,
      admin: { email },
      message: 'Admin logged in successfully',
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin logout
router.post('/logout', (req, res) => {
  res.cookie('admin_token', '', {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });

  res.json({ message: 'Admin logged out successfully' });
});

// Dashboard stats
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const [totalUsers, totalNotes, archivedNotes, totalUploads] = await Promise.all([
      User.countDocuments(),
      Note.countDocuments(),
      Note.countDocuments({ isArchived: true }),
      ImageNotification.countDocuments(),
    ]);

    res.json({
      stats: {
        totalUsers,
        totalNotes,
        activeNotes: totalNotes - archivedNotes,
        archivedNotes,
        totalUploads,
      },
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Error fetching stats' });
  }
});

// All users (without passwords) with how many notes each one has
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 }).lean();
    const counts = await Note.aggregate([
      { $group: { _id: '$user', count: { $sum: 1 } } },
    ]);

    const countByUser = {};
    counts.forEach((c) => {
      countByUser[String(c._id)] = c.count;
    });

    res.json({
      users: users.map((user) => ({
        ...user,
        notesCount: countByUser[String(user._id)] || 0,
      })),
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Error fetching users' });
  }
});

// Delete a user and everything they own
router.delete('/users/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await Note.deleteMany({ user: id });
    await ImageNotification.deleteMany({ user: id });

    res.json({ message: 'User and their data deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Error deleting user' });
  }
});

// All notes from all users
router.get('/notes', requireAdmin, async (req, res) => {
  try {
    const notes = await Note.find()
      .sort({ updatedAt: -1 })
      .populate('user', 'name email')
      .lean();

    res.json({ notes });
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ error: 'Error fetching notes' });
  }
});

// Delete any note
router.delete('/notes/:id', requireAdmin, async (req, res) => {
  try {
    const note = await Note.findByIdAndDelete(req.params.id);

    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ error: 'Error deleting note' });
  }
});

// All image-upload notifications (with signed view links when AWS is configured)
router.get('/uploads', requireAdmin, async (req, res) => {
  try {
    const docs = await ImageNotification.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const uploads = await Promise.all(
      docs.map(async (doc) => ({
        ...doc,
        url: await presignGet(doc.bucket, doc.key),
      }))
    );

    res.json({ uploads });
  } catch (error) {
    console.error('Error fetching uploads:', error);
    res.status(500).json({ error: 'Error fetching uploads' });
  }
});

module.exports = router;
