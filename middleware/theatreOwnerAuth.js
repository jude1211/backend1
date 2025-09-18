const jwt = require('jsonwebtoken');
const TheatreOwner = require('../models/TheatreOwner');

// Authenticate Theatre Owner via JWT issued by theatreOwnerAuth routes
const authenticateTheatreOwner = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Access denied',
        message: 'No token provided'
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== 'theatre_owner') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'Theatre owner access required'
      });
    }

    const theatreOwner = await TheatreOwner.findById(decoded.userId).select('-password');
    if (!theatreOwner) {
      return res.status(401).json({
        success: false,
        error: 'Theatre owner not found'
      });
    }

    if (!theatreOwner.isActive) {
      return res.status(403).json({
        success: false,
        error: 'Account is deactivated'
      });
    }

    req.theatreOwner = theatreOwner;
    next();
  } catch (error) {
    console.error('Theatre owner authentication error:', error.message);
    res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }
};

module.exports = { authenticateTheatreOwner };

