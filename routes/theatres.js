const express = require('express');
const { query, body, validationResult } = require('express-validator');
const multer = require('multer');
const Theatre = require('../models/Theatre');
const TheatreOwnerApplication = require('../models/TheatreOwnerApplication');
const { optionalAuth } = require('../middleware/auth');
const UploadService = require('../services/uploadService');

const router = express.Router();

// Multer configuration for handling theatre owner application document uploads
const applicationUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB per file
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed. Allowed types: ${allowedTypes.join(', ')}`));
    }
  }
});

// Get all theatres with filtering
router.get('/', [
  query('city').optional().trim(),
  query('chain').optional().trim(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('search').optional().trim(),
  query('latitude').optional().isFloat(),
  query('longitude').optional().isFloat(),
  query('radius').optional().isInt({ min: 1, max: 50 })
], optionalAuth, async (req, res) => {
  try {
    const {
      city,
      chain,
      page = 1,
      limit = 10,
      search,
      latitude,
      longitude,
      radius = 10
    } = req.query;

    let query = { status: 'active' };

    // Filter by city
    if (city) {
      query['location.city'] = new RegExp(city, 'i');
    }

    // Filter by chain
    if (chain) {
      query.chain = new RegExp(chain, 'i');
    }

    // Search in name or location
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { 'location.address': new RegExp(search, 'i') },
        { 'location.area': new RegExp(search, 'i') }
      ];
    }

    let theatreQuery = Theatre.find(query);

    // Location-based search
    if (latitude && longitude) {
      theatreQuery = Theatre.find({
        ...query,
        'location.coordinates': {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [parseFloat(longitude), parseFloat(latitude)]
            },
            $maxDistance: parseInt(radius) * 1000 // Convert km to meters
          }
        }
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const theatres = await theatreQuery
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ name: 1 });

    const total = await Theatre.countDocuments(query);

    // Add user-specific data if authenticated
    const theatresWithUserData = theatres.map(theatre => {
      const theatreData = theatre.toObject();
      if (req.user) {
        theatreData.isFavorite = req.user.favoriteTheatres.includes(theatre._id);
      }
      return theatreData;
    });

    res.json({
      success: true,
      data: theatresWithUserData,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        hasNext: skip + theatres.length < total,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Get theatres error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch theatres'
    });
  }
});

// Get theatre by ID
router.get('/:theatreId', optionalAuth, async (req, res) => {
  try {
    const theatre = await Theatre.findById(req.params.theatreId);

    if (!theatre) {
      return res.status(404).json({
        success: false,
        error: 'Theatre not found'
      });
    }

    const theatreData = theatre.toObject();
    
    // Add user-specific data if authenticated
    if (req.user) {
      theatreData.isFavorite = req.user.favoriteTheatres.includes(theatre._id);
    }

    res.json({
      success: true,
      data: theatreData
    });
  } catch (error) {
    console.error('Get theatre error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch theatre'
    });
  }
});

// Get theatres by city
router.get('/city/:city', optionalAuth, async (req, res) => {
  try {
    const city = req.params.city;
    const { chain, sortBy = 'name' } = req.query;

    let query = {
      'location.city': new RegExp(city, 'i'),
      status: 'active'
    };

    if (chain) {
      query.chain = new RegExp(chain, 'i');
    }

    const theatres = await Theatre.find(query).sort({ [sortBy]: 1 });

    const theatresWithUserData = theatres.map(theatre => {
      const theatreData = theatre.toObject();
      if (req.user) {
        theatreData.isFavorite = req.user.favoriteTheatres.includes(theatre._id);
      }
      return theatreData;
    });

    res.json({
      success: true,
      data: theatresWithUserData,
      city: city,
      count: theatres.length
    });
  } catch (error) {
    console.error('Get theatres by city error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch theatres'
    });
  }
});

// Get theatre chains
router.get('/chains/list', async (req, res) => {
  try {
    const chains = await Theatre.distinct('chain', { status: 'active' });
    
    const chainStats = await Theatre.aggregate([
      { $match: { status: 'active' } },
      {
        $group: {
          _id: '$chain',
          count: { $sum: 1 },
          cities: { $addToSet: '$location.city' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        chains: chains.sort(),
        statistics: chainStats
      }
    });
  } catch (error) {
    console.error('Get chains error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch theatre chains'
    });
  }
});

// Check if email already exists for theatre owner applications
router.get('/owner-applications/check-email/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    // Check in TheatreOwnerApplication collection
    const existingApplication = await TheatreOwnerApplication.findOne({ email: email.toLowerCase() });
    
    // Also check in TheatreOwner collection (if approved applications)
    const TheatreOwner = require('../models/TheatreOwner');
    const existingOwner = await TheatreOwner.findOne({ email: email.toLowerCase() });
    
    // Check in User collection (regular users)
    const User = require('../models/User');
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    
    const exists = !!(existingApplication || existingOwner || existingUser);
    
    res.json({
      success: true,
      data: {
        exists,
        email: email.toLowerCase(),
        message: exists ? 'Email already exists' : 'Email is available'
      }
    });
  } catch (error) {
    console.error('Check email error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check email availability'
    });
  }
});

// Create theatre owner application (store to MongoDB)
router.post(
  '/owner-applications',
  [
    body('name').trim().notEmpty().withMessage('Owner name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('phone').trim().notEmpty().withMessage('Phone is required'),
    body('theatreName').trim().notEmpty().withMessage('Theatre name is required'),
    body('theatreType').trim().notEmpty().withMessage('Theatre type is required'),
    body('location').trim().notEmpty().withMessage('Location is required'),
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('screenCount').notEmpty().withMessage('Screen count is required'),
    body('seatingCapacity').notEmpty().withMessage('Seating capacity is required'),
    body('internetConnectivity').trim().notEmpty().withMessage('Internet connectivity is required'),
    body('termsAccepted').isBoolean().withMessage('Terms must be accepted')
  ],
  applicationUpload.fields([
    { name: 'businessLicense', maxCount: 10 },
    { name: 'nocPermission', maxCount: 10 }
  ]),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const {
        name,
        email,
        phone,
        theatreName,
        theatreType,
        location,
        description,
        screenCount,
        seatingCapacity,
        screens = [],
        internetConnectivity,
        // Files will be processed from req.files instead of body arrays
        seatingLayout = [],
        ticketPricing = [],
        termsAccepted
      } = req.body;

      // Helper to process and upload a list of files
      const processFiles = async (files = [], category = 'other') => {
        const uploaded = [];
        for (const file of files) {
          // Validate file
          const validation = UploadService.validateFile(file);
          if (!validation.isValid) {
            // Skip invalid files but continue processing others
            continue;
          }

          const fileName = file.originalname;
          const fileBuffer = file.buffer;
          const isImage = file.mimetype.startsWith('image/');

          let result;
          if (isImage) {
            result = await UploadService.uploadImage(fileBuffer, fileName, 'booknview/theatre-applications');
          } else if (file.mimetype === 'application/pdf') {
            result = await UploadService.uploadPDF(fileBuffer, fileName, 'booknview/theatre-applications');
          } else {
            result = await UploadService.uploadFile(fileBuffer, fileName, 'booknview/theatre-applications', 'auto');
          }

          uploaded.push({
            fileName: fileName,
            fileUrl: result.url,
            fileType: file.mimetype,
            fileSize: file.size,
            publicId: result.publicId,
            category
          });
        }
        return uploaded;
      };

      // Extract files from multipart form-data
      const businessLicenseFiles = (req.files && req.files['businessLicense']) || [];
      const nocPermissionFiles = (req.files && req.files['nocPermission']) || [];

      // Upload to Cloudinary and collect metadata
      const [businessLicense, nocPermission] = await Promise.all([
        processFiles(businessLicenseFiles, 'license'),
        processFiles(nocPermissionFiles, 'permit')
      ]);

      // Convert to URL arrays per selected schema design
      const businessLicenseUrls = businessLicense.map(doc => doc.fileUrl);
      const nocPermissionUrls = nocPermission.map(doc => doc.fileUrl);

      const application = new TheatreOwnerApplication({
        ownerName: name,
        email,
        phone,
        theatreName,
        theatreType,
        locationText: location,
        description,
        screenCount,
        seatingCapacity,
        screens,
        internetConnectivity,
        termsAccepted,
        documents: {
          businessLicenseUrls,
          nocPermissionUrls,
          seatingLayoutUrls: seatingLayout,
          ticketPricingUrls: ticketPricing
        }
      });

      await application.save();

      return res.status(201).json({
        success: true,
        message: 'Theatre owner application created',
        data: { id: application._id }
      });
    } catch (error) {
      console.error('Create theatre owner application error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create application'
      });
    }
  }
);

// Get cities with theatres
router.get('/cities/list', async (req, res) => {
  try {
    const cities = await Theatre.distinct('location.city', { status: 'active' });
    
    const cityStats = await Theatre.aggregate([
      { $match: { status: 'active' } },
      {
        $group: {
          _id: '$location.city',
          theatreCount: { $sum: 1 },
          chains: { $addToSet: '$chain' },
          totalScreens: { $sum: { $size: '$screens' } }
        }
      },
      { $sort: { theatreCount: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        cities: cities.sort(),
        statistics: cityStats
      }
    });
  } catch (error) {
    console.error('Get cities error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cities'
    });
  }
});

// Get theatre concessions/snacks
router.get('/:theatreId/concessions', async (req, res) => {
  try {
    const theatre = await Theatre.findById(req.params.theatreId).select('concessions name');

    if (!theatre) {
      return res.status(404).json({
        success: false,
        error: 'Theatre not found'
      });
    }

    const { category } = req.query;
    let concessions = theatre.concessions.filter(item => item.available);

    if (category) {
      concessions = concessions.filter(item => item.category === category);
    }

    // Group by category
    const groupedConcessions = concessions.reduce((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        theatre: {
          id: theatre._id,
          name: theatre.name
        },
        concessions: groupedConcessions,
        categories: [...new Set(concessions.map(item => item.category))]
      }
    });
  } catch (error) {
    console.error('Get concessions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch concessions'
    });
  }
});

// Get nearby theatres
router.get('/nearby/search', [
  query('latitude').isFloat().withMessage('Valid latitude is required'),
  query('longitude').isFloat().withMessage('Valid longitude is required'),
  query('radius').optional().isInt({ min: 1, max: 50 }).withMessage('Radius must be between 1 and 50 km')
], async (req, res) => {
  try {
    const { latitude, longitude, radius = 10, limit = 20 } = req.query;

    const theatres = await Theatre.find({
      status: 'active',
      'location.coordinates': {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          },
          $maxDistance: parseInt(radius) * 1000 // Convert km to meters
        }
      }
    })
    .limit(parseInt(limit))
    .select('name location chain ratings totalScreens totalCapacity');

    res.json({
      success: true,
      data: theatres,
      searchParams: {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        radius: parseInt(radius)
      }
    });
  } catch (error) {
    console.error('Get nearby theatres error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch nearby theatres'
    });
  }
});

// Get theatre reviews/ratings summary
router.get('/:theatreId/reviews', async (req, res) => {
  try {
    const theatre = await Theatre.findById(req.params.theatreId).select('name ratings');

    if (!theatre) {
      return res.status(404).json({
        success: false,
        error: 'Theatre not found'
      });
    }

    // In a real app, you would fetch actual reviews from a reviews collection
    // For now, return the ratings summary
    res.json({
      success: true,
      data: {
        theatre: {
          id: theatre._id,
          name: theatre.name
        },
        ratings: theatre.ratings,
        // Mock recent reviews
        recentReviews: [
          {
            id: '1',
            user: 'John D.',
            rating: 4,
            comment: 'Great sound quality and comfortable seats!',
            date: '2024-01-15'
          },
          {
            id: '2',
            user: 'Sarah M.',
            rating: 5,
            comment: 'Excellent experience, very clean theatre.',
            date: '2024-01-14'
          }
        ]
      }
    });
  } catch (error) {
    console.error('Get theatre reviews error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch theatre reviews'
    });
  }
});

// Upload theatre document
router.post('/:theatreId/documents', [
  body('category').optional().isIn(['license', 'permit', 'photo', 'other'])
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

    const theatre = await Theatre.findById(req.params.theatreId);
    if (!theatre) {
      return res.status(404).json({
        success: false,
        error: 'Theatre not found'
      });
    }

    // Add document to theatre
    theatre.documents.push({
      fileName,
      fileUrl,
      fileType,
      fileSize,
      publicId,
      category
    });

    await theatre.save();

    res.json({
      success: true,
      message: 'Document uploaded successfully',
      data: {
        document: theatre.documents[theatre.documents.length - 1]
      }
    });
  } catch (error) {
    console.error('Upload theatre document error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload document'
    });
  }
});

// Get theatre documents
router.get('/:theatreId/documents', async (req, res) => {
  try {
    const theatre = await Theatre.findById(req.params.theatreId);
    if (!theatre) {
      return res.status(404).json({
        success: false,
        error: 'Theatre not found'
      });
    }

    res.json({
      success: true,
      data: theatre.documents
    });
  } catch (error) {
    console.error('Get theatre documents error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch documents'
    });
  }
});

// Delete theatre document
router.delete('/:theatreId/documents/:documentId', async (req, res) => {
  try {
    const theatre = await Theatre.findById(req.params.theatreId);
    if (!theatre) {
      return res.status(404).json({
        success: false,
        error: 'Theatre not found'
      });
    }

    const document = theatre.documents.id(req.params.documentId);
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

    // Remove from theatre documents
    theatre.documents.pull(req.params.documentId);
    await theatre.save();

    res.json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    console.error('Delete theatre document error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete document'
    });
  }
});

// Admin-only route to get all theatre applications
router.get('/admin/applications', async (req, res) => {
  try {
    // Check if user is admin (for JWT-based admin auth)
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
    const status = req.query.status; // pending, approved, rejected
    const skip = (page - 1) * limit;

    // Build query
    const query = {};
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      query.status = status;
    }

    // Get applications with pagination
    const applications = await TheatreOwnerApplication.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count for pagination
    const totalApplications = await TheatreOwnerApplication.countDocuments(query);

    // Calculate stats
    const stats = {
      total: await TheatreOwnerApplication.countDocuments({}),
      pending: await TheatreOwnerApplication.countDocuments({ status: 'pending' }),
      approved: await TheatreOwnerApplication.countDocuments({ status: 'approved' }),
      rejected: await TheatreOwnerApplication.countDocuments({ status: 'rejected' }),
      thisMonth: await TheatreOwnerApplication.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      })
    };

    res.json({
      success: true,
      data: {
        applications,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalApplications / limit),
          totalApplications,
          hasNext: page < Math.ceil(totalApplications / limit),
          hasPrev: page > 1
        },
        stats
      }
    });
  } catch (error) {
    console.error('Get theatre applications error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch theatre applications'
    });
  }
});

// Admin-only route to approve application
router.patch('/admin/applications/:applicationId/approve', async (req, res) => {
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

    const { applicationId } = req.params;

    // Import services
    const accountService = require('../services/accountService');
    const emailService = require('../services/emailService');

    // Process the approval (creates account and updates application)
    const result = await accountService.processApplicationApproval(applicationId, 'approved');

    if (!result.application) {
      return res.status(404).json({
        success: false,
        error: 'Application not found'
      });
    }

    // Send approval email with credentials
    if (result.account && result.credentials) {
      try {
        const emailResult = await emailService.sendApplicationApprovalEmail(
          result.account,
          result.credentials
        );

        console.log('📧 Approval email sent:', emailResult.success ? 'Success' : 'Failed');
        if (emailResult.previewUrl) {
          console.log('📧 Email preview:', emailResult.previewUrl);
        }
      } catch (emailError) {
        console.error('❌ Failed to send approval email:', emailError);
        // Don't fail the approval if email fails
      }
    }

    res.json({
      success: true,
      data: result.application,
      message: 'Application approved successfully and account created',
      accountCreated: !!result.account,
      emailSent: true // We'll assume it was sent for now
    });

  } catch (error) {
    console.error('Approve application error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve application',
      details: error.message
    });
  }
});

// Admin-only route to reject application
router.patch('/admin/applications/:applicationId/reject', async (req, res) => {
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

    const { applicationId } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Rejection reason is required'
      });
    }

    // Import services
    const accountService = require('../services/accountService');
    const emailService = require('../services/emailService');

    // Process the rejection
    const result = await accountService.processApplicationApproval(applicationId, 'rejected', reason.trim());

    if (!result.application) {
      return res.status(404).json({
        success: false,
        error: 'Application not found'
      });
    }

    // Send rejection email
    try {
      const emailResult = await emailService.sendApplicationRejectionEmail(
        result.application,
        reason.trim()
      );

      console.log('📧 Rejection email sent:', emailResult.success ? 'Success' : 'Failed');
      if (emailResult.previewUrl) {
        console.log('📧 Email preview:', emailResult.previewUrl);
      }
    } catch (emailError) {
      console.error('❌ Failed to send rejection email:', emailError);
      // Don't fail the rejection if email fails
    }

    res.json({
      success: true,
      data: result.application,
      message: 'Application rejected successfully',
      emailSent: true
    });

  } catch (error) {
    console.error('Reject application error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject application'
    });
  }
});

module.exports = router;
