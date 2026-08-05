const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../model/User');
const { getUserIdFromToken } = require('../middleware/auth');

const router = express.Router();
//route/auth
// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    console.log(name,email)

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user._id.toString(),
        userEmail: user.email,
        userName: user.name
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Set HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 * 1000, // 7 days in milliseconds
      path: '/',
    });

    res.status(201).json({
      success:true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
      message:"successfully login"
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
console.log("ye chal rha hai")
    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user._id.toString(),
        userEmail: user.email,
        userName: user.name
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Set HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 * 1000, // 7 days in milliseconds
      path: '/',
    });

    res.json({
       success:true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
       message:"successfully login"
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  res.cookie('token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0, // Expire immediately
    path: '/',
  });

  res.json({ message: 'Logged out successfully' });
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const token = req.cookies.token;
     
 

    if (!token) {
      return res.json({ user: null });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    res.json({
      user: {
        id: decoded.userId,
        email: decoded.userEmail,
        name: decoded.userName
      }
    });
  } catch (error) {
    console.error('Auth me error:', error);
    res.json({ user: null });
  }
});

module.exports = router;