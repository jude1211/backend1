const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const TheatreOwner = require('../models/TheatreOwner');

const router = express.Router();

// Theatre Owner Login
router.post('/login', [
  body('username').trim().notEmpty().withMessage('Username or email is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { username, password } = req.body;
    
    console.log('🎭 Theatre Owner Login attempt:', { 
      username, 
      isEmailFormat: username.includes('@booknview.com'),
      timestamp: new Date().toISOString()
    });

    // Find theatre owner by credentials
    const theatreOwner = await TheatreOwner.findByCredentials(username, password);

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: theatreOwner._id,
        username: theatreOwner.username,
        email: theatreOwner.email,
        role: 'theatre_owner',
        theatreName: theatreOwner.theatreName
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Remove password from response
    const theatreOwnerData = theatreOwner.toObject();
    delete theatreOwnerData.password;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        theatreOwner: theatreOwnerData
      }
    });

  } catch (error) {
    console.error('Theatre owner login error:', error);
    
    if (error.message === 'Invalid credentials') {
      return res.status(401).json({
        success: false,
        error: 'Invalid username or password'
      });
    }
    
    if (error.message.includes('locked')) {
      return res.status(423).json({
        success: false,
        error: 'Account is temporarily locked due to too many failed login attempts'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
});

// Theatre Owner Registration (for testing - normally done via approval)
router.post('/register', [
  body('username').trim().isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('ownerName').trim().notEmpty().withMessage('Owner name is required'),
  body('theatreName').trim().notEmpty().withMessage('Theatre name is required'),
  body('phone').trim().notEmpty().withMessage('Phone is required')
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { username, email, password, ownerName, theatreName, phone } = req.body;

    // Check if username or email already exists
    const existingOwner = await TheatreOwner.findOne({
      $or: [{ username }, { email }]
    });

    if (existingOwner) {
      return res.status(409).json({
        success: false,
        error: 'Username or email already exists'
      });
    }

    // Create new theatre owner
    const theatreOwner = new TheatreOwner({
      username,
      email,
      password,
      ownerName,
      theatreName,
      phone,
      theatreType: 'Single Screen', // Default
      screenCount: 1,
      seatingCapacity: 100,
      applicationId: null // For manual registration
    });

    await theatreOwner.save();

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: theatreOwner._id,
        username: theatreOwner.username,
        email: theatreOwner.email,
        role: 'theatre_owner',
        theatreName: theatreOwner.theatreName
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Remove password from response
    const theatreOwnerData = theatreOwner.toObject();
    delete theatreOwnerData.password;

    res.status(201).json({
      success: true,
      message: 'Theatre owner account created successfully',
      data: {
        token,
        theatreOwner: theatreOwnerData
      }
    });

  } catch (error) {
    console.error('Theatre owner registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed'
    });
  }
});

// Middleware to authenticate theatre owner
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
    console.error('Theatre owner authentication error:', error);
    res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }
};

// Get theatre owner profile
router.get('/profile', authenticateTheatreOwner, async (req, res) => {
  try {
    res.json({
      success: true,
      data: req.theatreOwner
    });
  } catch (error) {
    console.error('Get theatre owner profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profile'
    });
  }
});

// Update theatre owner profile
router.put('/profile', authenticateTheatreOwner, [
  body('ownerName').optional().trim().notEmpty().withMessage('Owner name cannot be empty'),
  body('phone').optional().trim().notEmpty().withMessage('Phone cannot be empty'),
  body('bio').optional().isLength({ max: 500 }).withMessage('Bio cannot exceed 500 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const allowedUpdates = ['ownerName', 'phone', 'bio', 'preferences'];
    const updates = {};
    
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const updatedOwner = await TheatreOwner.findByIdAndUpdate(
      req.theatreOwner._id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      data: updatedOwner,
      message: 'Profile updated successfully'
    });

  } catch (error) {
    console.error('Update theatre owner profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
});

// Change password
router.post('/change-password', authenticateTheatreOwner, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { currentPassword, newPassword } = req.body;

    // Verify current password
    const isCurrentPasswordValid = await req.theatreOwner.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Update password
    req.theatreOwner.password = newPassword;
    req.theatreOwner.passwordChangedAt = new Date();
    await req.theatreOwner.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to change password'
    });
  }
});

module.exports = router;
