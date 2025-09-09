const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const OfflineBooking = require('../models/OfflineBooking');
const TheatreOwner = require('../models/TheatreOwner');
const Theatre = require('../models/Theatre');

const router = express.Router();

// Local middleware to authenticate theatre owners (JWT with role check)
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
    return res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }
};

// Apply theatre owner authentication to all routes
router.use(authenticateTheatreOwner);

// Create new offline booking
router.post('/', [
  body('customer.name').trim().notEmpty().withMessage('Customer name is required'),
  body('customer.phone').trim().notEmpty().withMessage('Customer phone is required'),
  body('customer.idProof').isIn(['aadhar', 'pan', 'driving_license', 'passport', 'voter_id']).withMessage('Valid ID proof type is required'),
  body('customer.idNumber').trim().notEmpty().withMessage('ID number is required'),
  body('movie.title').trim().notEmpty().withMessage('Movie title is required'),
  body('theatre.theatreId').isMongoId().withMessage('Valid theatre ID is required'),
  body('theatre.name').trim().notEmpty().withMessage('Theatre name is required'),
  body('theatre.screen.screenNumber').isNumeric().withMessage('Screen number is required'),
  body('showtime.date').isISO8601().withMessage('Valid show date is required'),
  body('showtime.time').trim().notEmpty().withMessage('Show time is required'),
  body('seats').isArray({ min: 1 }).withMessage('At least one seat is required'),
  body('seats.*.seatNumber').trim().notEmpty().withMessage('Seat number is required'),
  body('seats.*.price').isNumeric().withMessage('Seat price must be a number'),
  body('payment.method').isIn(['cash', 'card', 'upi', 'netbanking', 'wallet']).withMessage('Valid payment method is required'),
  body('payment.paidAmount').isNumeric().withMessage('Paid amount must be a number')
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

    // Verify theatre ownership
    const theatre = await Theatre.findById(req.body.theatre.theatreId);
    if (!theatre) {
      return res.status(404).json({
        success: false,
        error: 'Theatre not found'
      });
    }

    // Check if theatre belongs to the theatre owner
    if (theatre.theatreOwner.toString() !== req.theatreOwner._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Theatre does not belong to you'
      });
    }

    const bookingData = {
      ...req.body,
      theatreOwner: req.theatreOwner._id,
      bookingType: 'offline'
    };

    // Create new offline booking
    const booking = new OfflineBooking(bookingData);
    
    // Calculate total amount
    booking.calculateTotal();
    
    await booking.save();

    // Populate theatre information
    await booking.populate('theatre.theatreId', 'name location contact');

    res.status(201).json({
      success: true,
      message: 'Offline booking created successfully',
      data: booking
    });
  } catch (error) {
    console.error('Create offline booking error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create offline booking'
    });
  }
});

// Get all offline bookings for theatre owner
router.get('/', async (req, res) => {
  try {
    const { 
      status, 
      page = 1, 
      limit = 10, 
      sortBy = 'bookingDate', 
      sortOrder = 'desc',
      startDate,
      endDate,
      customerPhone,
      movieTitle
    } = req.query;
    
    const query = { theatreOwner: req.theatreOwner._id };
    
    if (status) {
      query.status = status;
    }
    
    if (startDate || endDate) {
      query['showtime.date'] = {};
      if (startDate) query['showtime.date'].$gte = new Date(startDate);
      if (endDate) query['showtime.date'].$lte = new Date(endDate);
    }

    if (customerPhone) {
      query['customer.phone'] = { $regex: customerPhone, $options: 'i' };
    }

    if (movieTitle) {
      query['movie.title'] = { $regex: movieTitle, $options: 'i' };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const bookings = await OfflineBooking.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('theatre.theatreId', 'name location contact');

    const total = await OfflineBooking.countDocuments(query);

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
    console.error('Get offline bookings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch offline bookings'
    });
  }
});

// Get specific offline booking
router.get('/:bookingId', async (req, res) => {
  try {
    const booking = await OfflineBooking.findOne({
      bookingId: req.params.bookingId,
      theatreOwner: req.theatreOwner._id
    }).populate('theatre.theatreId', 'name location contact');

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Offline booking not found'
      });
    }

    res.json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Get offline booking error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch offline booking'
    });
  }
});

// Update offline booking status
router.patch('/:bookingId/status', [
  body('status').isIn(['confirmed', 'cancelled', 'completed', 'no_show']).withMessage('Valid status is required'),
  body('cancellationReason').optional().trim()
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

    const { status, cancellationReason } = req.body;

    const booking = await OfflineBooking.findOne({
      bookingId: req.params.bookingId,
      theatreOwner: req.theatreOwner._id
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Offline booking not found'
      });
    }

    // Update status
    booking.status = status;
    
    if (status === 'cancelled') {
      booking.cancelledAt = new Date();
      if (cancellationReason) {
        booking.cancellationReason = cancellationReason;
      }
    } else if (status === 'completed') {
      booking.completedAt = new Date();
    }

    await booking.save();

    res.json({
      success: true,
      message: 'Booking status updated successfully',
      data: booking
    });
  } catch (error) {
    console.error('Update booking status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update booking status'
    });
  }
});

// Get offline booking statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const matchQuery = { theatreOwner: req.theatreOwner._id };
    
    if (startDate || endDate) {
      matchQuery['showtime.date'] = {};
      if (startDate) matchQuery['showtime.date'].$gte = new Date(startDate);
      if (endDate) matchQuery['showtime.date'].$lte = new Date(endDate);
    }

    const stats = await OfflineBooking.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalBookings: { $sum: 1 },
          totalRevenue: { $sum: '$pricing.totalAmount' },
          confirmedBookings: {
            $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] }
          },
          cancelledBookings: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
          },
          completedBookings: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          noShowBookings: {
            $sum: { $cond: [{ $eq: ['$status', 'no_show'] }, 1, 0] }
          },
          totalSeats: { $sum: { $size: '$seats' } },
          averageBookingValue: { $avg: '$pricing.totalAmount' }
        }
      }
    ]);

    const paymentMethodStats = await OfflineBooking.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$payment.method',
          count: { $sum: 1 },
          totalAmount: { $sum: '$pricing.totalAmount' }
        }
      }
    ]);

    const dailyStats = await OfflineBooking.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            year: { $year: '$showtime.date' },
            month: { $month: '$showtime.date' },
            day: { $dayOfMonth: '$showtime.date' }
          },
          bookings: { $sum: 1 },
          revenue: { $sum: '$pricing.totalAmount' }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1, '_id.day': -1 } },
      { $limit: 30 }
    ]);

    res.json({
      success: true,
      data: {
        summary: stats[0] || {
          totalBookings: 0,
          totalRevenue: 0,
          confirmedBookings: 0,
          cancelledBookings: 0,
          completedBookings: 0,
          noShowBookings: 0,
          totalSeats: 0,
          averageBookingValue: 0
        },
        paymentMethods: paymentMethodStats,
        dailyStats: dailyStats
      }
    });
  } catch (error) {
    console.error('Get offline booking stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch offline booking statistics'
    });
  }
});

module.exports = router;