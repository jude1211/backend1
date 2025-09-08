const jwt = require('jsonwebtoken');
const { verifyFirebaseToken } = require('../config/firebase');
const User = require('../models/User');

// Middleware to verify JWT token (for manual auth) or Firebase token (for Google auth)
const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Access denied',
        message: 'No token provided or invalid format'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    let user = null;

    // Try JWT token first (for manual authentication)
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      user = await User.findById(decoded.userId);

      if (user) {
        // Update last active time
        user.lastActiveAt = new Date();
        await user.save();

        req.user = user;
        req.authMethod = 'manual';
        return next();
      }
    } catch (jwtError) {
      // JWT verification failed, try Firebase token
    }

    // Try Firebase token (for Google authentication)
    try {
      const decodedToken = await verifyFirebaseToken(token);

      if (decodedToken) {
        // Find user by Firebase UID
        user = await User.findByFirebaseUid(decodedToken.uid);

        if (!user) {
          return res.status(401).json({
            error: 'User not found',
            message: 'Please complete the authentication process'
          });
        }

        // Update last active time
        user.lastActiveAt = new Date();
        await user.save();

        req.user = user;
        req.firebaseUser = decodedToken;
        req.authMethod = 'google';
        return next();
      }
    } catch (firebaseError) {
      // Firebase verification also failed
    }

    // Both token types failed
    return res.status(401).json({
      error: 'Invalid token',
      message: 'Please log in again'
    });

  } catch (error) {
    console.error('Authentication error:', error.message);

    return res.status(401).json({
      error: 'Authentication failed',
      message: 'Invalid or expired token'
    });
  }
};

// Optional authentication - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Continue without authentication
    }

    const token = authHeader.substring(7);
    const decodedToken = await verifyFirebaseToken(token);
    
    if (decodedToken) {
      const user = await User.findByFirebaseUid(decodedToken.uid);
      if (user) {
        req.user = user;
        req.firebaseUser = decodedToken;
      }
    }
    
    next();
    
  } catch (error) {
    // Continue without authentication on error
    console.log('Optional auth failed:', error.message);
    next();
  }
};

// Middleware to check if user is admin
const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Access denied',
        message: 'Authentication required'
      });
    }

    // Check if user has admin role
    const isAdmin = req.firebaseUser?.admin || 
                   req.user?.role === 'admin' || 
                   req.user?.metadata?.isAdmin;

    if (!isAdmin) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Admin privileges required'
      });
    }

    next();
    
  } catch (error) {
    console.error('Admin check error:', error.message);
    return res.status(500).json({
      error: 'Server error',
      message: 'Failed to verify admin status'
    });
  }
};

// Middleware to check if user owns the resource
const requireOwnership = (resourceField = 'user') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Access denied',
          message: 'Authentication required'
        });
      }

      // Get resource ID from params or body
      const resourceId = req.params.id || req.params.userId || req.body.userId;
      
      if (!resourceId) {
        return res.status(400).json({
          error: 'Bad request',
          message: 'Resource ID required'
        });
      }

      // Check if user owns the resource
      const isOwner = req.user._id.toString() === resourceId || 
                     req.user.firebaseUid === resourceId;

      // Check if user is admin (admins can access any resource)
      const isAdmin = req.firebaseUser?.admin || req.user?.role === 'admin';

      if (!isOwner && !isAdmin) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You can only access your own resources'
        });
      }

      next();
      
    } catch (error) {
      console.error('Ownership check error:', error.message);
      return res.status(500).json({
        error: 'Server error',
        message: 'Failed to verify resource ownership'
      });
    }
  };
};

// Middleware to validate Firebase UID format
const validateFirebaseUid = (req, res, next) => {
  const uid = req.params.uid || req.body.firebaseUid || req.query.uid;
  
  if (uid && typeof uid === 'string' && uid.length > 0) {
    next();
  } else {
    return res.status(400).json({
      error: 'Invalid request',
      message: 'Valid Firebase UID required'
    });
  }
};

// Middleware to check rate limiting per user
const userRateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const userRequests = new Map();
  
  return (req, res, next) => {
    if (!req.user) {
      return next(); // Skip rate limiting for unauthenticated requests
    }

    const userId = req.user.firebaseUid;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get user's request history
    let userHistory = userRequests.get(userId) || [];
    
    // Remove old requests outside the window
    userHistory = userHistory.filter(timestamp => timestamp > windowStart);
    
    // Check if user has exceeded the limit
    if (userHistory.length >= maxRequests) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Too many requests. Limit: ${maxRequests} per ${windowMs / 1000} seconds`,
        retryAfter: Math.ceil((userHistory[0] + windowMs - now) / 1000)
      });
    }

    // Add current request
    userHistory.push(now);
    userRequests.set(userId, userHistory);

    next();
  };
};

module.exports = {
  authenticateUser,
  optionalAuth,
  requireAdmin,
  requireOwnership,
  validateFirebaseUid,
  userRateLimit
};
