const express = require('express');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Theatre = require('../models/Theatre');
const TheatreOwner = require('../models/TheatreOwner');
const { authenticateUser, requireOwnership } = require('../middleware/auth');
const emailService = require('../services/emailService');

const router = express.Router();
 
// Create new booking
router.post('/', authenticateUser, [
  body('movie.movieId').notEmpty().withMessage('Movie ID is required'),
  body('movie.title').notEmpty().withMessage('Movie title is required'),
  body('theatre.theatreId').isMongoId().withMessage('Valid theatre ID is required'),
  body('theatre.name').notEmpty().withMessage('Theatre name is required'),
  body('showtime.date').isISO8601().withMessage('Valid show date is required'),
  body('showtime.time').notEmpty().withMessage('Show time is required'),
  body('seats').isArray({ min: 1 }).withMessage('At least one seat is required'),
  body('seats.*.seatNumber').notEmpty().withMessage('Seat number is required'),
  body('seats.*.price').isNumeric().withMessage('Seat price must be a number'),
  body('contactInfo.email').isEmail().withMessage('Valid email is required'),
  body('contactInfo.name').notEmpty().withMessage('Contact name is required')
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

    const bookingData = {
      ...req.body,
      user: req.user._id,
      firebaseUid: req.user.firebaseUid
    };

    // Create new booking
    const booking = new Booking(bookingData);
    
    // Calculate total amount
    booking.calculateTotal();
    
    await booking.save();

    // Update user statistics
    await User.findByIdAndUpdate(req.user._id, {
      $inc: {
        totalBookings: 1,
        totalSpent: booking.pricing.totalAmount
      }
    });

    // Populate theatre information
    await booking.populate('theatre.theatreId', 'name location contact');

    // Send booking confirmation email
    try {
      console.log('📧 Sending booking confirmation email to:', booking.contactInfo?.email);
      const emailResult = await emailService.sendBookingConfirmationEmail(booking.toObject());
      
      if (emailResult.success) {
        console.log('✅ Booking confirmation email sent successfully');
      } else {
        console.log('⚠️ Booking confirmation email failed:', emailResult.message);
        // Don't fail the booking if email fails
      }
    } catch (emailError) {
      console.error('❌ Error sending booking confirmation email:', emailError);
      // Don't fail the booking if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: booking
    });
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create booking'
    });
  }
});

// Get user's bookings
router.get('/', authenticateUser, async (req, res) => {
  try {
    const { 
      status, 
      page = 1, 
      limit = 10, 
      sortBy = 'createdAt', 
      sortOrder = 'desc',
      startDate,
      endDate 
    } = req.query;
    
    const query = { firebaseUid: req.user.firebaseUid };
    
    if (status) {
      query.status = status;
    }
    
    if (startDate || endDate) {
      query['showtime.date'] = {};
      if (startDate) query['showtime.date'].$gte = new Date(startDate);
      if (endDate) query['showtime.date'].$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const bookings = await Booking.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('theatre.theatreId', 'name location contact');

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

// Get specific booking (public access for confirmation)
router.get('/:bookingId', async (req, res) => {
  try {
    console.log('Fetching booking with ID:', req.params.bookingId);
    
    // First, try to find the booking without population
    let booking = await Booking.findOne({
      $or: [
        { bookingId: req.params.bookingId },
        ...(mongoose.Types.ObjectId.isValid(req.params.bookingId) 
          ? [{ _id: req.params.bookingId }] 
          : [])
      ]
    });

    console.log('Booking found:', booking ? 'Yes' : 'No');
    
    if (!booking) {
      console.log('Booking not found for ID:', req.params.bookingId);
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    // Try to populate theatre information if it exists
    if (booking.theatre && booking.theatre.theatreId) {
      try {
        const theatreObjectId = mongoose.Types.ObjectId.isValid(booking.theatre.theatreId) 
          ? booking.theatre.theatreId 
          : new mongoose.Types.ObjectId(booking.theatre.theatreId);
        
        // First try to get theatre from Theatre collection
        const theatre = await Theatre.findById(theatreObjectId).select('name location contact amenities');
        if (theatre) {
          booking.theatre.theatreId = theatre;
          // Use theatre name from Theatre collection if available
          if (theatre.name && theatre.name !== 'Default Theatre') {
            booking.theatre.name = theatre.name;
          }
        }
        
        // If theatre name is still default or not found, try TheatreOwner collection
        if (!booking.theatre.name || booking.theatre.name === 'Default Theatre' || booking.theatre.name === 'Theatre') {
          try {
            // Try to find theatre owner by theatre name or other criteria
            const theatreOwner = await TheatreOwner.findOne({
              $or: [
                { theatreName: { $regex: booking.theatre.name, $options: 'i' } },
                { _id: theatreObjectId }
              ],
              isActive: true
            }).select('theatreName location ownerName');
            
            if (theatreOwner && theatreOwner.theatreName) {
              console.log('Found theatre name from TheatreOwner:', theatreOwner.theatreName);
              booking.theatre.name = theatreOwner.theatreName;
            }
          } catch (ownerError) {
            console.log('TheatreOwner lookup failed:', ownerError.message);
          }
        }
      } catch (populateError) {
        console.log('Theatre population failed:', populateError.message);
        // Continue without theatre population
      }
    }

    console.log('Returning booking data for:', booking.bookingId);
    res.json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Get booking error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch booking',
      details: error.message,
      errorName: error.name,
      errorCode: error.code
    });
  }
});

// Cancel booking
router.patch('/:bookingId/cancel', authenticateUser, [
  body('reason').optional().trim().isLength({ max: 500 })
], async (req, res) => {
  try {
    const booking = await Booking.findOne({
      $or: [
        { bookingId: req.params.bookingId },
        ...(mongoose.Types.ObjectId.isValid(req.params.bookingId) 
          ? [{ _id: req.params.bookingId }] 
          : [])
      ],
      firebaseUid: req.user.firebaseUid
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    if (booking.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        error: 'Only confirmed bookings can be cancelled'
      });
    }

    // Check if booking is cancellable
    if (!booking.isCancellable()) {
      return res.status(400).json({
        success: false,
        error: 'Booking cannot be cancelled (less than 2 hours before show)'
      });
    }

    // Calculate cancellation fee (example: 10% of total amount)
    const cancellationFee = booking.pricing.totalAmount * 0.1;
    const refundAmount = booking.pricing.totalAmount - cancellationFee;

    booking.status = 'cancelled';
    booking.cancellation = {
      cancelledAt: new Date(),
      reason: req.body.reason || 'Cancelled by user',
      cancelledBy: 'user',
      refundEligible: true,
      cancellationFee
    };
    booking.payment.refundAmount = refundAmount;

    await booking.save();

    // Update user statistics
    await User.findByIdAndUpdate(req.user._id, {
      $inc: {
        totalBookings: -1,
        totalSpent: -booking.pricing.totalAmount
      }
    });

    res.json({
      success: true,
      message: 'Booking cancelled successfully',
      data: {
        booking,
        refundAmount,
        cancellationFee
      }
    });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel booking'
    });
  }
});

// Add review for booking
router.post('/:bookingId/review', authenticateUser, [
  body('movieRating').isInt({ min: 1, max: 5 }).withMessage('Movie rating must be between 1 and 5'),
  body('theatreRating').optional().isInt({ min: 1, max: 5 }).withMessage('Theatre rating must be between 1 and 5'),
  body('comment').optional().trim().isLength({ max: 1000 }).withMessage('Comment must be less than 1000 characters')
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

    const booking = await Booking.findOne({
      $or: [
        { bookingId: req.params.bookingId },
        ...(mongoose.Types.ObjectId.isValid(req.params.bookingId) 
          ? [{ _id: req.params.bookingId }] 
          : [])
      ],
      firebaseUid: req.user.firebaseUid
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    if (booking.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Can only review completed bookings'
      });
    }

    if (booking.review && booking.review.reviewedAt) {
      return res.status(400).json({
        success: false,
        error: 'Booking already reviewed'
      });
    }

    booking.review = {
      movieRating: req.body.movieRating,
      theatreRating: req.body.theatreRating,
      comment: req.body.comment,
      reviewedAt: new Date()
    };

    await booking.save();

    // Add loyalty points for review
    await req.user.addLoyaltyPoints(50); // 50 points for review

    res.json({
      success: true,
      message: 'Review added successfully',
      data: booking.review
    });
  } catch (error) {
    console.error('Add review error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add review'
    });
  }
});

// Get booking statistics
router.get('/stats/summary', authenticateUser, async (req, res) => {
  try {
    const stats = await Booking.aggregate([
      { $match: { firebaseUid: req.user.firebaseUid } },
      {
        $group: {
          _id: null,
          totalBookings: { $sum: 1 },
          totalSpent: { $sum: '$pricing.totalAmount' },
          confirmedBookings: {
            $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] }
          },
          completedBookings: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          cancelledBookings: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
          },
          averageBookingAmount: { $avg: '$pricing.totalAmount' },
          totalSeatsBooked: { $sum: { $size: '$seats' } }
        }
      }
    ]);

    const monthlyStats = await Booking.aggregate([
      { $match: { firebaseUid: req.user.firebaseUid } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          bookings: { $sum: 1 },
          spent: { $sum: '$pricing.totalAmount' }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);

    const favoriteTheatres = await Booking.aggregate([
      { $match: { firebaseUid: req.user.firebaseUid } },
      {
        $group: {
          _id: '$theatre.name',
          bookings: { $sum: 1 },
          totalSpent: { $sum: '$pricing.totalAmount' }
        }
      },
      { $sort: { bookings: -1 } },
      { $limit: 5 }
    ]);

    res.json({
      success: true,
      data: {
        summary: stats[0] || {
          totalBookings: 0,
          totalSpent: 0,
          confirmedBookings: 0,
          completedBookings: 0,
          cancelledBookings: 0,
          averageBookingAmount: 0,
          totalSeatsBooked: 0
        },
        monthlyStats,
        favoriteTheatres
      }
    });
  } catch (error) {
    console.error('Get booking stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch booking statistics'
    });
  }
});

// Download booking ticket (placeholder)
router.get('/:bookingId/ticket', authenticateUser, async (req, res) => {
  try {
    const booking = await Booking.findOne({
      $or: [
        { bookingId: req.params.bookingId },
        { _id: req.params.bookingId }
      ],
      firebaseUid: req.user.firebaseUid
    }).populate('theatre.theatreId', 'name location');

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Cannot download ticket for cancelled booking'
      });
    }

    // In a real implementation, you would generate a PDF ticket here
    // For now, return ticket data
    res.json({
      success: true,
      message: 'Ticket data retrieved successfully',
      data: {
        bookingId: booking.bookingId,
        movie: booking.movie,
        theatre: booking.theatre,
        showtime: booking.showtime,
        seats: booking.seats,
        contactInfo: booking.contactInfo,
        tickets: booking.tickets,
        qrCodes: booking.tickets.map(ticket => ticket.qrCode)
      }
    });
  } catch (error) {
    console.error('Download ticket error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download ticket'
    });
  }
});

module.exports = router;
