const express = require('express');
const { body, validationResult } = require('express-validator');
const ScreenLayout = require('../models/ScreenLayout');
const Booking = require('../models/Booking');
const ScreenShow = require('../models/ScreenShow');
const Theatre = require('../models/Theatre');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

// GET /api/seat-layout/:screenId/:bookingDate/:showtime
// Returns seat layout for a show with live availability
router.get('/:screenId/:bookingDate/:showtime', async (req, res) => {
  try {
    const { screenId, bookingDate, showtime } = req.params;

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
        bookedSeats.add(`${seat.row}-${seat.seatNumber || seat.number || seat.seat}`);
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

module.exports = router;

// POST /api/seat-layout/:screenId/:bookingDate/:showtime/book
// Atomically validate and create a confirmed booking; returns updated booking
router.post(
  '/:screenId/:bookingDate/:showtime/book',
  authenticateUser,
  [
    body('seats').isArray({ min: 1 }).withMessage('At least one seat is required'),
    body('seats.*.rowLabel').notEmpty().withMessage('rowLabel is required'),
    body('seats.*.number').isNumeric().withMessage('number is required'),
    body('seats.*.price').isNumeric().withMessage('price is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
      }

      const { screenId, bookingDate, showtime } = req.params;
      const requestedSeats = Array.isArray(req.body.seats) ? req.body.seats : [];

      // Load persisted layout and theatre
      const layout = await ScreenLayout.findOne({ screenId });
      if (!layout) return res.status(404).json({ success: false, error: 'Screen layout not found' });

      // Identify show/movie
      const show = await ScreenShow.findOne({ screenId, bookingDate, showtimes: showtime }).populate('movieId', 'title posterUrl duration');

      // Check live availability by querying existing confirmed bookings for this show
      const liveBookings = await Booking.find({
        'theatre.screen.screenNumber': Number(screenId),
        'showtime.date': new Date(bookingDate),
        'showtime.time': showtime,
        status: 'Confirmed'
      }).lean();
      const bookedSet = new Set();
      liveBookings.forEach(b => (b.seats || []).forEach(s => bookedSet.add(String(s.seatNumber))));

      // Validate no requested seat is already booked
      const conflicts = [];
      for (const s of requestedSeats) {
        const key = `${s.rowLabel}${s.number}`;
        if (bookedSet.has(key)) conflicts.push(key);
      }
      if (conflicts.length) {
        return res.status(409).json({ success: false, error: 'Some seats are no longer available', data: { conflicts } });
      }

      // Build booking document
      const theatreDoc = layout.theatreId ? await Theatre.findById(layout.theatreId).lean() : null;
      const bookingId = `BNV-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
      const seatsPayload = requestedSeats.map(s => ({
        seatNumber: `${s.rowLabel}${s.number}`,
        row: s.rowLabel,
        seatType: 'regular',
        price: Number(s.price)
      }));
      const totalAmount = seatsPayload.reduce((sum, s) => sum + (Number(s.price) || 0), 0);

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
          theatreId: theatreDoc?._id || undefined,
          name: theatreDoc?.name || 'Theatre',
          screen: { screenNumber: Number(screenId), screenType: '2D' }
        },
        showtime: {
          date: new Date(bookingDate),
          time: showtime,
          showId: show?._id ? String(show._id) : undefined
        },
        seats: seatsPayload,
        pricing: {
          currency: 'INR',
          totalAmount
        },
        payment: { method: 'upi', status: 'paid', transactionId: bookingId },
        status: 'Confirmed'
      });

      // Persist
      await booking.save();

      // Respond
      res.json({ success: true, data: { bookingId, totalAmount, currency: 'INR' } });
    } catch (error) {
      console.error('Create seat booking error:', error);
      res.status(500).json({ success: false, error: 'Failed to create booking' });
    }
  }
);
