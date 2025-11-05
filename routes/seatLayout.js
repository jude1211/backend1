const express = require('express');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const ScreenLayout = require('../models/ScreenLayout');
const Booking = require('../models/Booking');
const ScreenShow = require('../models/ScreenShow');
const Theatre = require('../models/Theatre');
const { authenticateUser } = require('../middleware/auth');
const emailService = require('../services/emailService');

const router = express.Router();

// GET /api/seat-layout/:screenId/:bookingDate/:showtime
// Returns seat layout for a show with live availability
router.get('/:screenId/:bookingDate/:showtime', async (req, res) => {
  try {
    const { screenId, bookingDate, showtime } = req.params;

    // Check if the booking date is in the past
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    if (bookingDate < today) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot access seat layout for past dates' 
      });
    }

    // 1. Get the screen layout
    const layout = await ScreenLayout.findOne({ screenId });
    if (!layout) {
      return res.status(404).json({ success: false, error: 'Screen layout not found' });
    }

    // 2. Find all bookings for this show (by screen, date, and showtime)
    const bookings = await Booking.find({
      'theatre.screen.screenNumber': Number(screenId),
      'showtime.date': new Date(bookingDate),
      'showtime.time': showtime,
      status: 'confirmed'
    });

    // 3. Collect all booked seat numbers
    const bookedSeats = new Set();
    bookings.forEach(b => {
      (b.seats || []).forEach(seat => {
        const seatNumber = seat.seatNumber || seat.number || seat.seat;
        if (seatNumber) {
          // Convert seat number format to match frontend expectations
          if (seatNumber.match(/^[A-Z]\d+$/)) {
            // Format: A1 -> A-1
            const row = seatNumber.charAt(0);
            const number = seatNumber.substring(1);
            bookedSeats.add(`${row}-${number}`);
          } else if (seat.row && seatNumber) {
            // Use row and seatNumber separately
            bookedSeats.add(`${seat.row}-${seatNumber}`);
          } else {
            bookedSeats.add(seatNumber);
          }
        }
      });
    });

    // 4. Mark each seat as available/booked
    const liveSeats = (layout.seats || []).map(seat => {
      const seatKey = `${seat.rowLabel}-${seat.number}`;
      return {
        ...seat.toObject(),
        liveStatus: bookedSeats.has(seatKey) ? 'booked' : 'available'
      };
    });

    res.json({
      success: true,
      data: {
        ...layout.toObject(),
        seats: liveSeats
      }
    });
  } catch (error) {
    console.error('Live seat layout error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch live seat layout' });
  }
});

// GET /api/seat-layout/:screenId/:bookingDate/:showtime/live
// Returns live seat layout for polling (same as above but with /live suffix)
router.get('/:screenId/:bookingDate/:showtime/live', async (req, res) => {
  try {
    const { screenId, bookingDate, showtime } = req.params;

    // Check if the booking date is in the past
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    if (bookingDate < today) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot access seat layout for past dates' 
      });
    }

    // 1. Get the screen layout
    const layout = await ScreenLayout.findOne({ screenId });
    if (!layout) {
      return res.status(404).json({ success: false, error: 'Screen layout not found' });
    }

    // 2. Find all bookings for this show (by screen, date, and showtime)
    const bookings = await Booking.find({
      'theatre.screen.screenNumber': Number(screenId),
      'showtime.date': new Date(bookingDate),
      'showtime.time': showtime,
      status: 'confirmed'
    });

    // 3. Build a map of reserved seats
    const reservedSeats = new Set();
    bookings.forEach(booking => {
      if (booking.seats && Array.isArray(booking.seats)) {
        booking.seats.forEach(seat => {
          if (seat.seatNumber) {
            // Convert seat number format from "A1" to "A-1" to match frontend expectations
            const seatNumber = seat.seatNumber;
            if (seatNumber.match(/^[A-Z]\d+$/)) {
              // Format: A1 -> A-1
              const row = seatNumber.charAt(0);
              const number = seatNumber.substring(1);
              reservedSeats.add(`${row}-${number}`);
            } else {
              // Keep original format if it doesn't match expected pattern
              reservedSeats.add(seatNumber);
            }
          }
        });
      }
    });

    // 4. Process the layout to mark seats as reserved
    const processedSeats = {};
    if (layout.seats) {
      Object.keys(layout.seats).forEach(seatKey => {
        const seat = layout.seats[seatKey];
        processedSeats[seatKey] = {
          ...seat,
          isReserved: reservedSeats.has(seatKey),
          status: reservedSeats.has(seatKey) ? 'reserved' : 'available'
        };
      });
    }

    // 5. Return the live layout
    res.json({
      success: true,
      data: {
        screenId: layout.screenId,
        config: layout.config,
        seats: processedSeats,
        reservedSeats: Array.from(reservedSeats),
        totalSeats: Object.keys(layout.seats || {}).length,
        availableSeats: Object.keys(layout.seats || {}).length - reservedSeats.size,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Get live seat layout error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch live seat layout' });
  }
});

// POST /api/seat-layout/:screenId/:bookingDate/:showtime/book
// Atomically validate and create a confirmed booking; returns updated booking
router.post(
  '/:screenId/:bookingDate/:showtime/book',
  authenticateUser,
  [
    body('seats').isArray({ min: 1 }).withMessage('At least one seat is required'),
    body('seats.*.rowLabel').notEmpty().withMessage('rowLabel is required'),
    body('seats.*.number').isNumeric().withMessage('number is required'),
    body('seats.*.price').isNumeric().withMessage('price is required'),
    body('contactDetails.email').isEmail().withMessage('Valid email is required'),
    body('contactDetails.mobileNumber').isLength({ min: 10, max: 10 }).withMessage('Valid 10-digit mobile number is required'),
    body('contactDetails.countryCode').notEmpty().withMessage('Country code is required')
  ],
  async (req, res) => {
    try {
      console.log('Booking request received:', {
        params: req.params,
        body: req.body,
        user: req.user ? { id: req.user._id, firebaseUid: req.user.firebaseUid } : 'No user'
      });

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('Validation errors:', errors.array());
        return res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
      }

      const { screenId, bookingDate, showtime } = req.params;
      
      // Check if the booking date is in the past
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      if (bookingDate < today) {
        return res.status(400).json({ 
          success: false, 
          error: 'Cannot book seats for past dates' 
        });
      }
      
      // Decode URL-encoded showtime
      const decodedShowtime = decodeURIComponent(showtime);
      console.log('Decoded showtime:', decodedShowtime);
      const requestedSeats = Array.isArray(req.body.seats) ? req.body.seats : [];
      const { contactDetails } = req.body;

      console.log('Processing booking for:', { screenId, bookingDate, showtime, seatCount: requestedSeats.length });

      // Check if user is authenticated
      if (!req.user || !req.user._id) {
        console.log('No authenticated user found');
        return res.status(401).json({ success: false, error: 'User authentication required' });
      }

      // Load persisted layout and theatre
      const layout = await ScreenLayout.findOne({ screenId });
      if (!layout) return res.status(404).json({ success: false, error: 'Screen layout not found' });

      // Identify show/movie
      const show = await ScreenShow.findOne({ screenId, bookingDate, showtimes: decodedShowtime }).populate('movieId', 'title posterUrl duration');
      console.log('Found show:', {
        showId: show?._id,
        theatreOwnerId: show?.theatreOwnerId,
        theatreId: show?.theatreId,
        movieTitle: show?.movieId?.title
      });

      // Check live availability by querying existing confirmed bookings for this show
      const liveBookings = await Booking.find({
        'theatre.screen.screenNumber': Number(screenId),
        'showtime.date': new Date(bookingDate),
        'showtime.time': decodedShowtime,
        status: 'confirmed'
      }).lean();
      const bookedSet = new Set();
      liveBookings.forEach(b => {
        (b.seats || []).forEach(s => {
          const seatNumber = String(s.seatNumber);
          // Convert stored format to frontend format for comparison
          if (seatNumber.match(/^[A-Z]\d+$/)) {
            const row = seatNumber.charAt(0);
            const number = seatNumber.substring(1);
            bookedSet.add(`${row}-${number}`);
          } else {
            bookedSet.add(seatNumber);
          }
        });
      });

      // Validate no requested seat is already booked
      const conflicts = [];
      for (const s of requestedSeats) {
        const key = `${s.rowLabel}-${s.number}`; // Use frontend format for comparison
        if (bookedSet.has(key)) conflicts.push(key);
      }
      if (conflicts.length) {
        return res.status(409).json({ success: false, error: 'Some seats are no longer available', data: { conflicts } });
      }

      // Build booking document
      let theatreDoc = null;
      let theatreName = 'Theatre';
      
      console.log('Starting theatre name resolution...');
      console.log('Layout theatreId:', layout.theatreId);
      
      if (layout.theatreId) {
        try {
          theatreDoc = await Theatre.findById(layout.theatreId).lean();
          if (theatreDoc) {
            theatreName = theatreDoc.name || 'Theatre';
            console.log('Found theatre from layout:', theatreName);
          }
        } catch (error) {
          console.error('Error fetching theatre:', error);
        }
      }
      
      // If no theatre found, try to get theatre name from the show
      if (!theatreDoc && show?.theatreId) {
        try {
          const showTheatre = await Theatre.findById(show.theatreId).lean();
          if (showTheatre) {
            theatreName = showTheatre.name || 'Theatre';
            theatreDoc = showTheatre;
          }
        } catch (error) {
          console.error('Error fetching show theatre:', error);
        }
      }
      
      // If theatre name is still default, try to get from TheatreOwner collection
      // Use the specific theatre owner associated with this show
      if (!theatreName || theatreName === 'Theatre' || theatreName === 'Default Theatre') {
        try {
          const TheatreOwner = require('../models/TheatreOwner');
          let theatreOwner = null;
          
          // First try to find theatre owner by show's theatreOwnerId (most specific)
          if (show?.theatreOwnerId) {
            theatreOwner = await TheatreOwner.findById(show.theatreOwnerId)
              .select('theatreName')
              .lean();
            console.log('Found theatre owner by theatreOwnerId:', theatreOwner?.theatreName);
          }
          
          // If not found by theatreOwnerId, try by show's theatreId
          if (!theatreOwner && show?.theatreId) {
            theatreOwner = await TheatreOwner.findOne({
              theatreId: show.theatreId,
              isActive: true
            }).select('theatreName').lean();
            console.log('Found theatre owner by theatreId:', theatreOwner?.theatreName);
          }
          
          // If still not found, try to find any active theatre owner as fallback
          if (!theatreOwner) {
            theatreOwner = await TheatreOwner.findOne({
              isActive: true
            }).select('theatreName').lean();
            console.log('Found theatre owner by fallback:', theatreOwner?.theatreName);
          }
          
          if (theatreOwner && theatreOwner.theatreName) {
            console.log('Using theatre name from TheatreOwner:', theatreOwner.theatreName);
            theatreName = theatreOwner.theatreName;
          }
        } catch (error) {
          console.error('Error fetching theatre from TheatreOwner:', error);
        }
      }
      
      const bookingId = `BNV-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
      const seatsPayload = requestedSeats.map(s => ({
        seatNumber: `${s.rowLabel}${s.number}`,
        row: s.rowLabel,
        seatType: 'regular',
        price: Number(s.price)
      }));
      const totalAmount = seatsPayload.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
      
      console.log('Final theatre name for booking:', theatreName);
      console.log('Theatre doc:', theatreDoc);

      const booking = new Booking({
        bookingId,
        user: req.user._id,
        firebaseUid: req.user.firebaseUid || (req.firebaseUser?.uid) || String(req.user._id),
        movie: {
          movieId: String(show?.movieId?._id || ''),
          title: show?.movieId?.title || 'Movie',
          poster: show?.movieId?.posterUrl || '',
        },
        theatre: {
          theatreId: theatreDoc?._id || new mongoose.Types.ObjectId(),
          name: theatreName,
          screen: { screenNumber: Number(screenId), screenType: '2D' }
        },
        showtime: {
          date: new Date(bookingDate),
          time: decodedShowtime,
          showId: show?._id ? String(show._id) : undefined
        },
        seats: seatsPayload,
        contactInfo: {
          email: contactDetails?.email || '',
          phone: `${contactDetails?.countryCode || '+91'}${contactDetails?.mobileNumber || ''}`,
          name: contactDetails?.email?.split('@')[0] || 'Customer'
        },
        pricing: {
          seatTotal: totalAmount,
          snackTotal: 0,
          subtotal: totalAmount,
          taxes: {
            cgst: totalAmount * 0.09,
            sgst: totalAmount * 0.09,
            serviceFee: totalAmount * 0.02,
            convenienceFee: 20
          },
          discount: {
            amount: 0
          },
          totalAmount: totalAmount + (totalAmount * 0.20) + 20
        },
        payment: { method: 'upi', status: 'completed', transactionId: bookingId },
        status: 'confirmed'
      });

      // Generate QR codes for tickets
      if (booking.seats.length > 0 && booking.tickets.length === 0) {
        booking.tickets = booking.seats.map((seat, index) => ({
          ticketNumber: `${booking.bookingId}-${index + 1}`,
          qrCode: `${booking.bookingId}-${seat.seatNumber}`,
          downloadUrl: null,
          isUsed: false
        }));
      }

      // Persist
      console.log('Saving booking with ID:', booking.bookingId);
      await booking.save();
      console.log('Booking saved successfully with ID:', booking.bookingId);

      // Emit real-time update to all clients viewing this show
      const io = req.app.get('io');
      if (io) {
        const roomName = `show-${screenId}-${bookingDate}-${decodedShowtime}`;
        const updatedSeats = seatsPayload.map(seat => ({
          seatNumber: seat.seatNumber,
          status: 'reserved',
          bookingId: bookingId
        }));
        
        io.to(roomName).emit('seats-updated', {
          screenId,
          bookingDate,
          showtime: decodedShowtime,
          reservedSeats: updatedSeats,
          bookingId: bookingId,
          timestamp: new Date().toISOString()
        });
        
        console.log(`📡 Emitted seat update to room: ${roomName}`);
      }

      // Send booking confirmation email
      try {
        console.log('📧 Sending booking confirmation email to:', contactDetails?.email);
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

      // Respond
      res.json({ success: true, data: { bookingId, totalAmount, currency: 'INR' } });
    } catch (error) {
      console.error('Create seat booking error:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({ success: false, error: 'Failed to create booking', details: error.message });
    }
  }
);

module.exports = router;
