const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Booking = require('../models/Booking');
const { authenticateUser, requireOwnership, userRateLimit } = require('../middleware/auth');
const UploadService = require('../services/uploadService');

const router = express.Router();

// Admin-only route to get all users (before auth middleware)
router.get('/admin/all', async (req, res) => {
  try {
    // Check admin token directly
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Access denied',
        message: 'No token provided'
      });
    }

    const token = authHeader.substring(7);
    const jwt = require('jsonwebtoken');

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.role !== 'admin' && decoded.userId !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: 'Admin access required'
        });
      }
    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Get users with pagination
    const users = await User.find({})
      .select('-password -__v')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count for pagination
    const totalUsers = await User.countDocuments({});

    // Calculate additional stats
    const stats = {
      totalUsers,
      activeUsers: await User.countDocuments({ lastActiveAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }),
      newUsersThisMonth: await User.countDocuments({ createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }),
      verifiedUsers: await User.countDocuments({ isEmailVerified: true })
    };

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalUsers / limit),
          totalUsers,
          hasNext: page < Math.ceil(totalUsers / limit),
          hasPrev: page > 1
        },
        stats
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users'
    });
  }
});

// Admin-only route to update user
router.put('/admin/:userId', async (req, res) => {
  try {
    // Check admin token directly
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Access denied',
        message: 'No token provided'
      });
    }

    const token = authHeader.substring(7);
    const jwt = require('jsonwebtoken');

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.role !== 'admin' && decoded.userId !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: 'Admin access required'
        });
      }
    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }

    const { userId } = req.params;
    const updateData = req.body;

    // Remove sensitive fields that shouldn't be updated via admin
    delete updateData.password;
    delete updateData.firebaseUid;
    delete updateData._id;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).select('-password -__v');

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: updatedUser,
      message: 'User updated successfully'
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user'
    });
  }
});

// Admin-only route to suspend/activate user
router.patch('/admin/:userId/status', async (req, res) => {
  try {
    // Check admin token directly
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Access denied',
        message: 'No token provided'
      });
    }

    const token = authHeader.substring(7);
    const jwt = require('jsonwebtoken');

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.role !== 'admin' && decoded.userId !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: 'Admin access required'
        });
      }
    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }

    const { userId } = req.params;
    const { isActive } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        isActive: isActive,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    ).select('-password -__v');

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: updatedUser,
      message: `User ${isActive ? 'activated' : 'suspended'} successfully`
    });

  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user status'
    });
  }
});

// Apply authentication to all other routes
router.use(authenticateUser);

// Get current user profile
router.get('/profile', authenticateUser, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('favoriteTheatres', 'name location.city')
      .select('-__v');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user profile'
    });
  }
});

// Update user profile
router.put('/profile', authenticateUser, [
  body('displayName').optional().trim().isLength({ min: 1, max: 100 }),
  body('firstName').optional().trim().isLength({ max: 50 }),
  body('lastName').optional().trim().isLength({ max: 50 }),
  body('phone').optional().trim().isMobilePhone(),
  body('dateOfBirth').optional().isISO8601(),
  body('preferredCity').optional().isIn(['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Kolkata', 'Hyderabad', 'Pune', 'Ahmedabad']),
  body('preferences.language').optional().isIn(['English', 'Hindi', 'Tamil', 'Telugu', 'Bengali', 'Marathi']),
  body('preferences.notifications.email').optional().isBoolean(),
  body('preferences.notifications.push').optional().isBoolean(),
  body('preferences.notifications.sms').optional().isBoolean(),
  body('preferences.newsletter').optional().isBoolean(),
  body('preferences.theme').optional().isIn(['light', 'dark', 'auto'])
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

    const updateData = req.body;
    
    // Remove fields that shouldn't be updated directly
    delete updateData.firebaseUid;
    delete updateData.email;
    delete updateData.totalBookings;
    delete updateData.totalSpent;
    delete updateData.loyaltyPoints;
    delete updateData.membershipTier;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate('favoriteTheatres', 'name location.city');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: user
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
});

// Add address
router.post('/addresses', authenticateUser, [
  body('type').isIn(['home', 'work', 'other']),
  body('street').trim().isLength({ min: 1, max: 200 }),
  body('city').trim().isLength({ min: 1, max: 50 }),
  body('state').trim().isLength({ min: 1, max: 50 }),
  body('zipCode').trim().isLength({ min: 1, max: 10 }),
  body('country').optional().trim().isLength({ max: 50 }),
  body('isDefault').optional().isBoolean()
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

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // If this is set as default, unset other defaults
    if (req.body.isDefault) {
      user.addresses.forEach(addr => addr.isDefault = false);
    }

    user.addresses.push(req.body);
    await user.save();

    res.status(201).json({
      success: true,
      message: 'Address added successfully',
      data: user.addresses
    });
  } catch (error) {
    console.error('Add address error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add address'
    });
  }
});

// Update address
router.put('/addresses/:addressId', authenticateUser, [
  body('type').optional().isIn(['home', 'work', 'other']),
  body('street').optional().trim().isLength({ min: 1, max: 200 }),
  body('city').optional().trim().isLength({ min: 1, max: 50 }),
  body('state').optional().trim().isLength({ min: 1, max: 50 }),
  body('zipCode').optional().trim().isLength({ min: 1, max: 10 }),
  body('country').optional().trim().isLength({ max: 50 }),
  body('isDefault').optional().isBoolean()
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

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const address = user.addresses.id(req.params.addressId);
    if (!address) {
      return res.status(404).json({
        success: false,
        error: 'Address not found'
      });
    }

    // If this is set as default, unset other defaults
    if (req.body.isDefault) {
      user.addresses.forEach(addr => {
        if (addr._id.toString() !== req.params.addressId) {
          addr.isDefault = false;
        }
      });
    }

    Object.assign(address, req.body);
    await user.save();

    res.json({
      success: true,
      message: 'Address updated successfully',
      data: user.addresses
    });
  } catch (error) {
    console.error('Update address error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update address'
    });
  }
});

// Delete address
router.delete('/addresses/:addressId', authenticateUser, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const address = user.addresses.id(req.params.addressId);
    if (!address) {
      return res.status(404).json({
        success: false,
        error: 'Address not found'
      });
    }

    address.remove();
    await user.save();

    res.json({
      success: true,
      message: 'Address deleted successfully',
      data: user.addresses
    });
  } catch (error) {
    console.error('Delete address error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete address'
    });
  }
});

// Get user bookings
router.get('/bookings', authenticateUser, async (req, res) => {
  try {
    const { status, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    const query = { firebaseUid: req.user.firebaseUid };
    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const bookings = await Booking.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('theatre.theatreId', 'name location.city location.address');

    const total = await Booking.countDocuments(query);

    res.json({
      success: true,
      data: bookings,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        hasNext: skip + bookings.length < total,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bookings'
    });
  }
});

// Add favorite theatre
router.post('/favorites/theatres/:theatreId', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const theatreId = req.params.theatreId;
    
    if (!user.favoriteTheatres.includes(theatreId)) {
      user.favoriteTheatres.push(theatreId);
      await user.save();
    }

    res.json({
      success: true,
      message: 'Theatre added to favorites',
      data: user.favoriteTheatres
    });
  } catch (error) {
    console.error('Add favorite theatre error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add favorite theatre'
    });
  }
});

// Remove favorite theatre
router.delete('/favorites/theatres/:theatreId', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    user.favoriteTheatres = user.favoriteTheatres.filter(
      id => id.toString() !== req.params.theatreId
    );
    await user.save();

    res.json({
      success: true,
      message: 'Theatre removed from favorites',
      data: user.favoriteTheatres
    });
  } catch (error) {
    console.error('Remove favorite theatre error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove favorite theatre'
    });
  }
});

// Add favorite movie
router.post('/favorites/movies', [
  body('movieId').notEmpty().trim(),
  body('title').notEmpty().trim().isLength({ max: 200 })
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

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const { movieId, title } = req.body;
    
    // Check if movie is already in favorites
    const existingFavorite = user.favoriteMovies.find(movie => movie.movieId === movieId);
    if (existingFavorite) {
      return res.status(400).json({
        success: false,
        error: 'Movie already in favorites'
      });
    }

    user.favoriteMovies.push({ movieId, title });
    await user.save();

    res.json({
      success: true,
      message: 'Movie added to favorites',
      data: user.favoriteMovies
    });
  } catch (error) {
    console.error('Add favorite movie error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add favorite movie'
    });
  }
});

// Remove favorite movie
router.delete('/favorites/movies/:movieId', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    user.favoriteMovies = user.favoriteMovies.filter(
      movie => movie.movieId !== req.params.movieId
    );
    await user.save();

    res.json({
      success: true,
      message: 'Movie removed from favorites',
      data: user.favoriteMovies
    });
  } catch (error) {
    console.error('Remove favorite movie error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove favorite movie'
    });
  }
});

// Delete user account
router.delete('/account', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Soft delete - mark as inactive instead of hard delete
    user.isActive = false;
    user.email = `deleted_${Date.now()}_${user.email}`;
    await user.save();

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete account'
    });
  }
});

// Upload user document
router.post('/documents', [
  body('category').optional().isIn(['profile', 'document', 'other'])
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

    // This endpoint expects the file to be uploaded via the /upload route first
    // and then the URL to be passed in the request body
    const { fileUrl, fileName, fileType, fileSize, publicId, category = 'other' } = req.body;

    if (!fileUrl || !fileName || !fileType || !fileSize || !publicId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required file information'
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Add document to user
    user.documents.push({
      fileName,
      fileUrl,
      fileType,
      fileSize,
      publicId,
      category
    });

    await user.save();

    res.json({
      success: true,
      message: 'Document uploaded successfully',
      data: {
        document: user.documents[user.documents.length - 1]
      }
    });
  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload document'
    });
  }
});

// Get user documents
router.get('/documents', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user.documents
    });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch documents'
    });
  }
});

// Delete user document
router.delete('/documents/:documentId', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const document = user.documents.id(req.params.documentId);
    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    // Delete from Cloudinary
    try {
      await UploadService.deleteFile(document.publicId);
    } catch (cloudinaryError) {
      console.error('Failed to delete from Cloudinary:', cloudinaryError);
      // Continue with local deletion even if Cloudinary deletion fails
    }

    // Remove from user documents
    user.documents.pull(req.params.documentId);
    await user.save();

    res.json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete document'
    });
  }
});

module.exports = router;
