const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../lib/config');
//middleware/auth

// The token can arrive as an httpOnly cookie (same-origin setups) or as an
// Authorization: Bearer header (cross-origin over plain HTTP, where browsers
// refuse to store the cookie).
const getTokenFromRequest = (req) => {
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }

  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length);
  }

  return null;
};

const getUserIdFromToken = (req) => {
  return new Promise((resolve) => {
    const token = getTokenFromRequest(req);

    if (!token) {
      console.log("no token in cookies or Authorization header")
      resolve(null);
      return;
    }

    try {
      const decoded = jwt.verify(token, getJwtSecret());
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
    console.log("not authorized")
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.userId = userId;
  next();
};

module.exports = { getTokenFromRequest, getUserIdFromToken, requireAuth };
