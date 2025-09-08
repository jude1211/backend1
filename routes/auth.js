const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const OTP = require('../models/OTP');
const { verifyFirebaseToken, getUserByUid } = require('../config/firebase');
const { authenticateUser, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Helper function to generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

// Send OTP for email verification or password reset
router.post('/send-otp', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('type').optional().isIn(['verification', 'password_reset']).withMessage('Invalid OTP type')
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

    const { email, type = 'verification' } = req.body;

    console.log(`📧 Sending ${type} OTP to:`, email);

    // For verification type, check if user already exists
    if (type === 'verification') {
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'Email already registered',
          message: 'An account with this email already exists. Please try logging in.'
        });
      }
    }

    // For password reset, check if user exists
    if (type === 'password_reset') {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          message: 'No account found with this email address.'
        });
      }
    }

    // Create and send OTP
    const result = await OTP.createOTP(email, type);

    // In development mode, include OTP in response for testing
    const response = {
      success: true,
      message: `${type === 'verification' ? 'Verification' : 'Password reset'} code sent to your email`,
      expiresAt: result.expiresAt
    };

    // Add OTP to response in development mode
    if (process.env.NODE_ENV === 'development' && result.emailResult && result.emailResult.otp) {
      response.developmentOTP = result.emailResult.otp;
      response.message += ` (Development: ${result.emailResult.otp})`;
    }

    res.json(response);

  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to send verification code. Please try again.'
    });
  }
});

// Verify OTP
router.post('/verify-otp', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
  body('type').optional().isIn(['verification', 'password_reset']).withMessage('Invalid OTP type')
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

    const { email, otp, type = 'verification' } = req.body;

    console.log(`🔐 Verifying OTP for ${type}:`, email);

    const result = await OTP.verifyOTP(email, otp, type);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid OTP',
        message: result.message
      });
    }

    res.json({
      success: true,
      message: result.message
    });

  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to verify code. Please try again.'
    });
  }
});

// Manual signup with email and password (requires OTP verification)
router.post('/signup', [
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Name is required and must be less than 100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Passwords do not match');
    }
    return true;
  }),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP is required and must be 6 digits')
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

    const { name, email, password, otp } = req.body;

    console.log(`🔐 Processing signup for verified email:`, email);

    // Check if there's a recent verified OTP for this email
    // We'll trust that the frontend has already verified the OTP
    const recentOTP = await OTP.findOne({
      email: email.toLowerCase(),
      type: 'verification',
      isUsed: true,
      createdAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) } // Within last 15 minutes
    }).sort({ createdAt: -1 });

    if (!recentOTP) {
      return res.status(400).json({
        success: false,
        error: 'Email verification required',
        message: 'Please verify your email address first.'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Email already registered',
        message: 'An account with this email already exists. Please try logging in.'
      });
    }

    // Create new user (email is verified since OTP was successful)
    const user = new User({
      email: email.toLowerCase(),
      password: password,
      displayName: name,
      firstName: name.split(' ')[0] || '',
      lastName: name.split(' ').slice(1).join(' ') || '',
      authProvider: 'email',
      isEmailVerified: true, // Email verified via OTP
      lastLoginAt: new Date(),
      lastActiveAt: new Date(),
      metadata: {
        registrationSource: 'web',
        deviceInfo: {
          userAgent: req.headers['user-agent'],
          platform: req.headers['sec-ch-ua-platform']?.replace(/"/g, '') || 'unknown',
          browser: req.headers['sec-ch-ua']?.split(';')[0]?.replace(/"/g, '') || 'unknown'
        }
      }
    });

    await user.save();

    // Generate JWT token
    const token = generateToken(user._id);

    console.log(`✅ New user registered manually: ${user.email}`);

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: {
        user: {
          id: user._id,
          email: user.email,
          displayName: user.displayName,
          firstName: user.firstName,
          lastName: user.lastName,
          isEmailVerified: user.isEmailVerified,
          preferredCity: user.preferredCity,
          preferences: user.preferences,
          membershipTier: user.membershipTier,
          loyaltyPoints: user.loyaltyPoints,
          createdAt: user.createdAt,
          authProvider: user.authProvider
        },
        token,
        authMethod: 'manual'
      }
    });
  } catch (error) {
    console.error('Manual signup error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed',
      message: 'An error occurred while creating your account. Please try again.'
    });
  }
});

// Manual login with email and password
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
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

    const { email, password } = req.body;

    // Check for admin credentials first
    if (email.toLowerCase() === 'admin@gmail.com' && password === 'admin123') {
      console.log('🔑 Admin login detected');

      // Generate a special admin token
      const adminToken = jwt.sign(
        {
          userId: 'admin',
          role: 'admin',
          email: 'admin@gmail.com'
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE || '7d' }
      );

      return res.json({
        success: true,
        message: 'Admin login successful',
        data: {
          user: {
            id: 'admin',
            email: 'admin@gmail.com',
            displayName: 'Administrator',
            firstName: 'Admin',
            lastName: 'User',
            role: 'admin',
            isAdmin: true,
            authProvider: 'manual'
          },
          token: adminToken,
          authMethod: 'admin'
        }
      });
    }

    try {
      // Authenticate regular user
      const user = await User.authenticate(email, password);

      // Update last login time
      user.lastLoginAt = new Date();
      user.lastActiveAt = new Date();
      await user.save();

      // Generate JWT token
      const token = generateToken(user._id);

      console.log(`✅ User logged in manually: ${user.email}`);

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user._id,
            email: user.email,
            displayName: user.displayName,
            firstName: user.firstName,
            lastName: user.lastName,
            profilePicture: user.profilePicture,
            isEmailVerified: user.isEmailVerified,
            preferredCity: user.preferredCity,
            preferences: user.preferences,
            membershipTier: user.membershipTier,
            loyaltyPoints: user.loyaltyPoints,
            totalBookings: user.totalBookings,
            totalSpent: user.totalSpent,
            lastLoginAt: user.lastLoginAt,
            createdAt: user.createdAt,
            authProvider: user.authProvider
          },
          token,
          authMethod: 'manual'
        }
      });
    } catch (authError) {
      // Handle specific authentication errors
      if (authError.message === 'User not found') {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials',
          message: 'No account found with this email address. Please check your email or sign up.'
        });
      } else if (authError.message === 'Incorrect password') {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials',
          message: 'Incorrect password. Please check your password and try again.'
        });
      } else if (authError.message.includes('Google sign-in')) {
        return res.status(401).json({
          success: false,
          error: 'Wrong authentication method',
          message: 'This account uses Google sign-in. Please sign in with Google instead.'
        });
      } else {
        throw authError;
      }
    }
  } catch (error) {
    console.error('Manual login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed',
      message: 'An error occurred while logging in. Please try again.'
    });
  }
});

// Google authentication with user data from frontend
router.post('/google-auth', [
  body('userData').isObject().withMessage('User data is required'),
  body('userData.uid').notEmpty().withMessage('Firebase UID is required'),
  body('userData.email').isEmail().withMessage('Valid email is required'),
  body('userData.displayName').notEmpty().withMessage('Display name is required')
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

    const { userData } = req.body;
    console.log('🔥 Received Google auth request');
    console.log('👤 Google user data from frontend:', userData);

    // Check if user exists with this email (from manual signup)
    let user = await User.findOne({ email: userData.email.toLowerCase() });
    console.log('🔍 Checking for existing user with email:', userData.email);

    if (user && !user.firebaseUid) {
      // User exists from manual signup, link with Firebase
      console.log('🔗 Linking existing manual account with Google');
      user.firebaseUid = userData.uid;
      user.authProvider = 'google';
      user.isEmailVerified = userData.emailVerified || false;
      user.profilePicture = userData.photoURL || user.profilePicture;
      user.displayName = userData.displayName || user.displayName;
      user.firstName = userData.displayName?.split(' ')[0] || user.firstName;
      user.lastName = userData.displayName?.split(' ').slice(1).join(' ') || user.lastName;
      user.lastLoginAt = new Date();
      user.lastActiveAt = new Date();

      await user.save();

      console.log(`✅ Linked existing user with Google: ${user.email}`);
    } else if (!user) {
      // Create new user for Google signup
      console.log('👤 Creating new Google user in MongoDB');
      user = new User({
        firebaseUid: userData.uid,
        email: userData.email.toLowerCase(),
        displayName: userData.displayName || userData.email?.split('@')[0] || 'User',
        firstName: userData.displayName?.split(' ')[0] || '',
        lastName: userData.displayName?.split(' ').slice(1).join(' ') || '',
        isEmailVerified: userData.emailVerified || false,
        authProvider: 'google',
        profilePicture: userData.photoURL || null,
        lastLoginAt: new Date(),
        lastActiveAt: new Date(),
        metadata: {
          registrationSource: 'web',
          deviceInfo: {
            userAgent: req.headers['user-agent'],
            platform: req.headers['sec-ch-ua-platform']?.replace(/"/g, '') || 'unknown',
            browser: req.headers['sec-ch-ua']?.split(';')[0]?.replace(/"/g, '') || 'unknown'
          }
        }
      });

      await user.save();

      console.log(`✅ New Google user registered: ${user.email}`);
    } else {
      // Existing Google user, update login time
      user.lastLoginAt = new Date();
      user.lastActiveAt = new Date();

      // Update profile picture if changed
      if (userData.photoURL && userData.photoURL !== user.profilePicture) {
        user.profilePicture = userData.photoURL;
      }

      // Update display name if changed
      if (userData.displayName && userData.displayName !== user.displayName) {
        user.displayName = userData.displayName;
        user.firstName = userData.displayName.split(' ')[0] || '';
        user.lastName = userData.displayName.split(' ').slice(1).join(' ') || '';
      }

      await user.save();

      console.log(`✅ Existing Google user logged in: ${user.email}`);
    }

    // Generate JWT token for session management
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Google authentication successful',
      data: {
        user: {
          id: user._id,
          firebaseUid: user.firebaseUid,
          email: user.email,
          displayName: user.displayName,
          firstName: user.firstName,
          lastName: user.lastName,
          profilePicture: user.profilePicture,
          isEmailVerified: user.isEmailVerified,
          preferredCity: user.preferredCity,
          preferences: user.preferences,
          membershipTier: user.membershipTier,
          loyaltyPoints: user.loyaltyPoints,
          totalBookings: user.totalBookings,
          totalSpent: user.totalSpent,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
          authProvider: user.authProvider
        },
        token,
        authMethod: 'google'
      }
    });

  } catch (error) {
    console.error('Google auth error:', error);

    if (error.message.includes('expired')) {
      return res.status(401).json({
        success: false,
        error: 'Token expired',
        message: 'Please log in again'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Google authentication failed',
      message: 'An error occurred during Google sign-in. Please try again.'
    });
  }
});

// Get current user info (requires authentication)
router.get('/me', authenticateUser, async (req, res) => {
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
      data: {
        user: {
          id: user._id,
          firebaseUid: user.firebaseUid,
          email: user.email,
          displayName: user.displayName,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          dateOfBirth: user.dateOfBirth,
          profilePicture: user.profilePicture,
          isEmailVerified: user.isEmailVerified,
          preferredCity: user.preferredCity,
          preferences: user.preferences,
          membershipTier: user.membershipTier,
          loyaltyPoints: user.loyaltyPoints,
          totalBookings: user.totalBookings,
          totalSpent: user.totalSpent,
          favoriteTheatres: user.favoriteTheatres,
          favoriteMovies: user.favoriteMovies,
          addresses: user.addresses,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
          age: user.age,
          fullName: user.fullName,
          authProvider: user.authProvider
        }
      }
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user information'
    });
  }
});

// Refresh user session
router.post('/refresh', authenticateUser, async (req, res) => {
  try {
    // Update last active time
    await req.user.updateLastActive();

    res.json({
      success: true,
      message: 'Session refreshed successfully',
      data: {
        lastActiveAt: req.user.lastActiveAt
      }
    });
  } catch (error) {
    console.error('Refresh session error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh session'
    });
  }
});

// Logout (optional - mainly for logging purposes)
router.post('/logout', optionalAuth, async (req, res) => {
  try {
    if (req.user) {
      // Log logout activity
      console.log(`User logged out: ${req.user.email}`);
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Logout failed'
    });
  }
});

// Check if email exists (for registration flow)
router.post('/check-email', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required')
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

    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });

    res.json({
      success: true,
      data: {
        exists: !!user,
        email: email
      }
    });
  } catch (error) {
    console.error('Check email error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check email'
    });
  }
});

// Get user statistics
router.get('/stats', authenticateUser, async (req, res) => {
  try {
    const user = req.user;
    
    // Get booking statistics
    const bookingStats = await User.aggregate([
      { $match: { _id: user._id } },
      {
        $lookup: {
          from: 'bookings',
          localField: 'firebaseUid',
          foreignField: 'firebaseUid',
          as: 'bookings'
        }
      },
      {
        $project: {
          totalBookings: { $size: '$bookings' },
          totalSpent: { $sum: '$bookings.pricing.totalAmount' },
          confirmedBookings: {
            $size: {
              $filter: {
                input: '$bookings',
                cond: { $eq: ['$$this.status', 'confirmed'] }
              }
            }
          },
          completedBookings: {
            $size: {
              $filter: {
                input: '$bookings',
                cond: { $eq: ['$$this.status', 'completed'] }
              }
            }
          },
          cancelledBookings: {
            $size: {
              $filter: {
                input: '$bookings',
                cond: { $eq: ['$$this.status', 'cancelled'] }
              }
            }
          }
        }
      }
    ]);

    const stats = bookingStats[0] || {
      totalBookings: 0,
      totalSpent: 0,
      confirmedBookings: 0,
      completedBookings: 0,
      cancelledBookings: 0
    };

    res.json({
      success: true,
      data: {
        ...stats,
        loyaltyPoints: user.loyaltyPoints,
        membershipTier: user.membershipTier,
        favoriteTheatresCount: user.favoriteTheatres.length,
        favoriteMoviesCount: user.favoriteMovies.length,
        accountAge: Math.floor((new Date() - user.createdAt) / (1000 * 60 * 60 * 24)) // days
      }
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user statistics'
    });
  }
});

// Forgot Password - Send OTP
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Valid email is required',
        errors: errors.array()
      });
    }

    const { email } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      console.log(`❌ User not found for email: ${email}`);
      // Don't reveal if user exists or not for security
      return res.status(200).json({
        success: true,
        message: 'If an account with that email exists, we have sent password reset instructions.'
      });
    }

    // Check if user is a Google user (case-insensitive, null-safe)
    if ((user.authProvider || '').toLowerCase() === 'google') {
      return res.status(400).json({
        success: false,
        message: 'This email is registered via Google Sign-In. Please use Google to log in and manage your password through your Google Account settings.'
      });
    }

    // Use shared OTP logic for password reset
    const result = await OTP.createOTP(email, 'password_reset');

    res.status(200).json({
      success: true,
      message: 'If an account with that email exists, we have sent password reset OTP.'
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
});

// Verify Password Reset OTP
router.post('/verify-reset-otp', [
  body('otp').notEmpty().withMessage('OTP is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request data',
        errors: errors.array()
      });
    }

    const { otp, email } = req.body;

    console.log(`🔐 Verifying password reset OTP for: ${email}`);
    console.log(`🔐 OTP provided: ${otp}`);

    // Check if OTP exists and is valid (but don't mark as used)
    const otpRecord = await OTP.findOne({
      email: email.toLowerCase(),
      otp: otp,
      type: 'password_reset',
      isUsed: false,
      expiresAt: { $gt: new Date() }
    });

    if (!otpRecord) {
      console.log(`❌ Invalid or expired OTP`);
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }

    console.log(`✅ Password reset OTP verified successfully for: ${email}`);

    res.status(200).json({
      success: true,
      data: { valid: true }
    });

  } catch (error) {
    console.error('Verify reset OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Reset Password with OTP
router.post('/reset-password', [
  body('otp').notEmpty().withMessage('OTP is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request data',
        errors: errors.array()
      });
    }

    const { otp, email, newPassword } = req.body;

    console.log(`🔐 Resetting password for: ${email}`);
    console.log(`🔐 OTP provided: ${otp}`);

    // Check if OTP exists and is valid (but don't mark as used yet)
    const otpRecord = await OTP.findOne({
      email: email.toLowerCase(),
      otp: otp,
      type: 'password_reset',
      expiresAt: { $gt: new Date() }
    });

    if (!otpRecord) {
      console.log(`❌ Invalid or expired OTP`);
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }

    // Mark OTP as used now that we're proceeding with password reset
    otpRecord.isUsed = true;
    await otpRecord.save();

    // Find the user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log(`✅ OTP verified, updating password for: ${email}`);

    // Set new password (User model pre-save middleware will hash it)
    user.password = newPassword;
    user.updatedAt = new Date();
    await user.save();

    console.log(`🔐 Password reset successful for: ${email}`);

    // Send confirmation email
    const emailService = require('../services/emailService');
    const confirmationContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #1f2937; color: #ffffff; padding: 40px; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #dc2626; font-size: 28px; margin: 0;">BookNView</h1>
        </div>
        <div style="text-align: center; margin-bottom: 20px;">
          <div style="width: 60px; height: 60px; background-color: #16a34a; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;">
            <span style="color: white; font-size: 24px;">✓</span>
          </div>
        </div>
        <h2 style="color: #16a34a; text-align: center; margin-bottom: 20px;">Password Reset Successful!</h2>
        <p style="color: #d1d5db; line-height: 1.6; text-align: center;">Your password has been successfully reset for your BookNView account.</p>
        <div style="background-color: #7f1d1d; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="color: #fca5a5; margin: 0; text-align: center;">⚠️ If you didn't make this change, please contact our support team immediately.</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5174'}" style="background-color: #dc2626; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">Login to Your Account</a>
        </div>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #374151;">
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">This email was sent by BookNView. If you have any questions, please contact our support team.</p>
      </div>
    `;

    try {
      const confirmationResult = await emailService.sendEmail(
        email,
        'Password Reset Confirmation - BookNView',
        confirmationContent
      );

      if (confirmationResult.success) {
        console.log(`✅ Password reset confirmation email sent to: ${email}`);
      } else {
        console.error(`❌ Failed to send confirmation email to: ${email}`, confirmationResult.error);
      }
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError.message);
      // Don't fail the request if email fails
    }

    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. You can now log in with your new password.'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
});

module.exports = router;
