const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../lib/config');
//middleware/adminAuth

// The admin token arrives as the admin_token cookie or an Authorization: Bearer
// header (the admin app uses the header — same cross-origin reason as the user app).
const getAdminTokenFromRequest = (req) => {
  if (req.cookies && req.cookies.admin_token) {
    return req.cookies.admin_token;
  }

  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length);
  }

  return null;
};

const requireAdmin = (req, res, next) => {
  const token = getAdminTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());

    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.admin = decoded;
    next();
  } catch (error) {
    console.error('Admin token verification error:', error);
    return res.status(401).json({ error: 'Unauthorized' });
  }
};

module.exports = { getAdminTokenFromRequest, requireAdmin };
