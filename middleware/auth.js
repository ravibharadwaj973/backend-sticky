const jwt = require('jsonwebtoken');
//middleware/auth
const getUserIdFromToken = (req) => {
  return new Promise((resolve) => {
    const token = req.cookies.token;

    if (!token) {
      resolve(null);
      return;
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      resolve(decoded.userId);
    } catch (error) {
      console.error('Token verification error:', error);
      resolve(null);
    }
  });
};

const requireAuth = async (req, res, next) => {
  const userId = await getUserIdFromToken(req);
  
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.userId = userId;
  next();
};

module.exports = { getUserIdFromToken, requireAuth };