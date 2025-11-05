const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const OfflineBooking = require('../models/OfflineBooking');
const Theatre = require('../models/Theatre');
const Movie = require('../models/Movie');
const { authenticateTheatreOwner } = require('../middleware/theatreOwnerAuth');

// Get comprehensive booking analytics for theatre owner
router.get('/', authenticateTheatreOwner, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Get theatre owner's theatres
    const theatres = await Theatre.find({ owner: req.theatreOwner._id }).select('_id');
    const theatreIds = theatres.map(t => t._id);
    
    const matchQuery = { 
      'theatre.theatreId': { $in: theatreIds }
    };
    
    if (startDate || endDate) {
      matchQuery['showtime.date'] = {};
      if (startDate) matchQuery['showtime.date'].$gte = new Date(startDate);
      if (endDate) matchQuery['showtime.date'].$lte = new Date(endDate);
    }

    // Get online booking analytics
    const onlineStats = await Booking.aggregate([
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

    // Get offline booking analytics
    const offlineMatchQuery = { theatreOwner: req.theatreOwner._id };
    if (startDate || endDate) {
      offlineMatchQuery['showtime.date'] = {};
      if (startDate) offlineMatchQuery['showtime.date'].$gte = new Date(startDate);
      if (endDate) offlineMatchQuery['showtime.date'].$lte = new Date(endDate);
    }

    const offlineStats = await OfflineBooking.aggregate([
      { $match: offlineMatchQuery },
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

    // Combine online and offline stats
    const onlineData = onlineStats[0] || {
      totalBookings: 0, totalRevenue: 0, confirmedBookings: 0,
      cancelledBookings: 0, completedBookings: 0, noShowBookings: 0,
      totalSeats: 0, averageBookingValue: 0
    };
    
    const offlineData = offlineStats[0] || {
      totalBookings: 0, totalRevenue: 0, confirmedBookings: 0,
      cancelledBookings: 0, completedBookings: 0, noShowBookings: 0,
      totalSeats: 0, averageBookingValue: 0
    };

    const summary = {
      totalBookings: onlineData.totalBookings + offlineData.totalBookings,
      totalRevenue: onlineData.totalRevenue + offlineData.totalRevenue,
      confirmedBookings: onlineData.confirmedBookings + offlineData.confirmedBookings,
      cancelledBookings: onlineData.cancelledBookings + offlineData.cancelledBookings,
      completedBookings: onlineData.completedBookings + offlineData.completedBookings,
      noShowBookings: onlineData.noShowBookings + offlineData.noShowBookings,
      totalSeats: onlineData.totalSeats + offlineData.totalSeats,
      averageBookingValue: onlineData.averageBookingValue || offlineData.averageBookingValue || 0
    };

    // Daily stats (last 30 days)
    const dailyStats = await Booking.aggregate([
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

    // Movie performance stats
    const movieStats = await Booking.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$movie.movieId',
          title: { $first: '$movie.title' },
          bookings: { $sum: 1 },
          revenue: { $sum: '$pricing.totalAmount' },
          averageRating: { $avg: '$review.movieRating' }
        }
      },
      { $sort: { bookings: -1 } },
      { $limit: 10 }
    ]);

    // Screen performance stats
    const screenStats = await Booking.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$theatre.screen.screenNumber',
          screenType: { $first: '$theatre.screen.screenType' },
          bookings: { $sum: 1 },
          revenue: { $sum: '$pricing.totalAmount' },
          totalSeats: { $sum: { $size: '$seats' } }
        }
      },
      {
        $addFields: {
          occupancyRate: {
            $multiply: [
              { $divide: ['$totalSeats', 100] }, // Assuming 100 seats per screen average
              100
            ]
          }
        }
      },
      { $sort: { bookings: -1 } }
    ]);

    // Time slot performance
    const timeSlotStats = await Booking.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$showtime.time',
          bookings: { $sum: 1 },
          revenue: { $sum: '$pricing.totalAmount' }
        }
      },
      { $sort: { bookings: -1 } }
    ]);

    // Payment method stats
    const paymentMethodStats = await Booking.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$payment.method',
          count: { $sum: 1 },
          totalAmount: { $sum: '$pricing.totalAmount' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        summary,
        dailyStats,
        movieStats,
        screenStats,
        timeSlotStats,
        paymentMethodStats
      }
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics data'
    });
  }
});

// Get detailed revenue analytics
router.get('/revenue', authenticateTheatreOwner, async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;
    
    const theatres = await Theatre.find({ owner: req.theatreOwner._id }).select('_id');
    const theatreIds = theatres.map(t => t._id);
    
    const matchQuery = { 
      'theatre.theatreId': { $in: theatreIds },
      status: { $in: ['confirmed', 'completed'] }
    };
    
    if (startDate || endDate) {
      matchQuery['showtime.date'] = {};
      if (startDate) matchQuery['showtime.date'].$gte = new Date(startDate);
      if (endDate) matchQuery['showtime.date'].$lte = new Date(endDate);
    }

    let groupStage;
    switch (groupBy) {
      case 'hour':
        groupStage = {
          _id: {
            year: { $year: '$showtime.date' },
            month: { $month: '$showtime.date' },
            day: { $dayOfMonth: '$showtime.date' },
            hour: { $hour: '$showtime.date' }
          },
          revenue: { $sum: '$pricing.totalAmount' },
          bookings: { $sum: 1 }
        };
        break;
      case 'week':
        groupStage = {
          _id: {
            year: { $year: '$showtime.date' },
            week: { $week: '$showtime.date' }
          },
          revenue: { $sum: '$pricing.totalAmount' },
          bookings: { $sum: 1 }
        };
        break;
      case 'month':
        groupStage = {
          _id: {
            year: { $year: '$showtime.date' },
            month: { $month: '$showtime.date' }
          },
          revenue: { $sum: '$pricing.totalAmount' },
          bookings: { $sum: 1 }
        };
        break;
      default: // day
        groupStage = {
          _id: {
            year: { $year: '$showtime.date' },
            month: { $month: '$showtime.date' },
            day: { $dayOfMonth: '$showtime.date' }
          },
          revenue: { $sum: '$pricing.totalAmount' },
          bookings: { $sum: 1 }
        };
    }

    const revenueData = await Booking.aggregate([
      { $match: matchQuery },
      { $group: groupStage },
      { $sort: { '_id.year': -1, '_id.month': -1, '_id.day': -1 } },
      { $limit: 100 }
    ]);

    res.json({
      success: true,
      data: revenueData
    });
  } catch (error) {
    console.error('Get revenue analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch revenue analytics'
    });
  }
});

// Get customer analytics
router.get('/customers', authenticateTheatreOwner, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const theatres = await Theatre.find({ owner: req.theatreOwner._id }).select('_id');
    const theatreIds = theatres.map(t => t._id);
    
    const matchQuery = { 
      'theatre.theatreId': { $in: theatreIds }
    };
    
    if (startDate || endDate) {
      matchQuery['showtime.date'] = {};
      if (startDate) matchQuery['showtime.date'].$gte = new Date(startDate);
      if (endDate) matchQuery['showtime.date'].$lte = new Date(endDate);
    }

    // Customer booking frequency
    const customerStats = await Booking.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$firebaseUid',
          totalBookings: { $sum: 1 },
          totalSpent: { $sum: '$pricing.totalAmount' },
          lastBooking: { $max: '$showtime.date' },
          firstBooking: { $min: '$showtime.date' }
        }
      },
      {
        $addFields: {
          avgBookingValue: { $divide: ['$totalSpent', '$totalBookings'] },
          daysSinceLastBooking: {
            $divide: [
              { $subtract: [new Date(), '$lastBooking'] },
              1000 * 60 * 60 * 24
            ]
          }
        }
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 50 }
    ]);

    // Customer segments
    const customerSegments = await Booking.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$firebaseUid',
          totalBookings: { $sum: 1 },
          totalSpent: { $sum: '$pricing.totalAmount' }
        }
      },
      {
        $bucket: {
          groupBy: '$totalSpent',
          boundaries: [0, 1000, 5000, 10000, 50000, Infinity],
          default: 'Other',
          output: {
            count: { $sum: 1 },
            avgBookings: { $avg: '$totalBookings' },
            totalRevenue: { $sum: '$totalSpent' }
          }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        topCustomers: customerStats,
        segments: customerSegments
      }
    });
  } catch (error) {
    console.error('Get customer analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch customer analytics'
    });
  }
});

module.exports = router;
