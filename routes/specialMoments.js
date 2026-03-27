const express = require('express');
const router = express.Router();
const Theatre = require('../models/Theatre');
const TheatreOwner = require('../models/TheatreOwner');
const ShowTiming = require('../models/ShowTiming');
const SpecialMomentBooking = require('../models/SpecialMomentBooking');
const { authenticateUser } = require('../middleware/auth');
const PaymentService = require('../services/paymentService');
const crypto = require('crypto');

// ─── Payment Service ─────────────────────────────────────────────────────────
const keyId = process.env.RAZORPAY_KEY_ID || process.env.RZP_KEY_ID || 'rzp_test_RL5vMta3bKvRd4';
const keySecret = process.env.RAZORPAY_KEY_SECRET || process.env.RZP_KEY_SECRET || '9qxxugjEleGtcqcOjWFmCB2n';
const paymentService = new PaymentService({ keyId, keySecret });

// ─── Pricing ─────────────────────────────────────────────────────────────────
const SPECIAL_MOMENT_PRICE = {
  birthday:  { base: 50, tax: 9, total: 59 },
  moment:    { base: 50, tax: 9, total: 59 },
  valentine: { base: 50, tax: 9, total: 59 },
};

// ─── Template Data ────────────────────────────────────────────────────────────
const TEMPLATES = [
  // Birthday templates
  { id: 'bday-1', occasion: 'birthday', name: 'Classic Celebration',
    previewImage: 'https://images.unsplash.com/photo-1464349153735-7db50ed83c84?q=80&w=800&auto=format&fit=crop',
    fields: ['recipientName', 'message', 'image'] },
  { id: 'bday-2', occasion: 'birthday', name: 'Starry Night',
    previewImage: 'https://images.unsplash.com/photo-1531306728370-e2ebd9d7bb99?q=80&w=800&auto=format&fit=crop',
    fields: ['recipientName', 'message'] },
  { id: 'bday-3', occasion: 'birthday', name: 'Confetti Blast',
    previewImage: 'https://images.unsplash.com/photo-1514525253440-b393452e8d26?q=80&w=800&auto=format&fit=crop',
    fields: ['recipientName', 'message', 'image'] },

  // Moment templates
  { id: 'moment-1', occasion: 'moment', name: 'Cinematic Reel',
    previewImage: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=800&auto=format&fit=crop',
    fields: ['recipientName', 'message', 'video'] },
  { id: 'moment-2', occasion: 'moment', name: 'Photo Slideshow',
    previewImage: 'https://images.unsplash.com/photo-1502899576159-f224dc2349fa?q=80&w=800&auto=format&fit=crop',
    fields: ['recipientName', 'message', 'image'] },

  // Valentine templates
  { id: 'val-1', occasion: 'valentine', name: 'Rose Garden',
    previewImage: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?q=80&w=800&auto=format&fit=crop',
    fields: ['recipientName', 'message', 'image'] },
  { id: 'val-2', occasion: 'valentine', name: 'Starlight Love',
    previewImage: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?q=80&w=800&auto=format&fit=crop',
    fields: ['recipientName', 'message'] },
];

// ─── GET /api/v1/special-moments/theatres ─────────────────────────────────────
// Returns all theatres, with optional ?search= filter
router.get('/theatres', async (req, res) => {
  try {
    const { search } = req.query;
    let query = { status: 'active' };
    if (search && search.trim()) {
      query.name = new RegExp(search.trim(), 'i');
    }
    const theatres = await Theatre.find(query)
      .select('name location.city location.address location.state images')
      .limit(30)
      .lean();

    const result = theatres.map(t => ({
      _id: t._id,
      name: t.name,
      city: t.location?.city || '',
      address: t.location?.address || '',
      state: t.location?.state || '',
      image: t.images?.[0]?.url || '',
    }));

    // Also search TheatreOwners (since the existing app uses TheatreOwner model for theatre data)
    let ownerQuery = {};
    if (search && search.trim()) {
      ownerQuery = {
        $or: [
          { theatreName: new RegExp(search.trim(), 'i') },
          { 'location.city': new RegExp(search.trim(), 'i') },
        ]
      };
    }
    const owners = await TheatreOwner.find(ownerQuery)
      .select('theatreName location email phone')
      .limit(30)
      .lean();

    const ownerResult = owners.map(o => ({
      _id: o._id,
      name: o.theatreName,
      city: o.location?.city || '',
      address: o.location?.address || '',
      state: o.location?.state || '',
      image: '',
      isOwner: true,
    }));

    return res.json({ success: true, data: [...result, ...ownerResult] });
  } catch (err) {
    console.error('Error fetching theatres for special moments:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch theatres' });
  }
});

// ─── GET /api/v1/special-moments/theatres/:theatreId/showtimes ────────────────
// Returns only valid (active, upcoming) showtimes from the ScreenShow collection
router.get('/theatres/:theatreId/showtimes', async (req, res) => {
  try {
    const { theatreId } = req.params;
    const { date } = req.query; // "YYYY-MM-DD"

    if (!date) {
      return res.status(400).json({ success: false, error: 'date query param is required' });
    }

    const ScreenShow   = require('../models/ScreenShow');
    const ScreenLayout = require('../models/ScreenLayout');
    const Booking      = require('../models/Booking');
    const mongoose     = require('mongoose');

    // ── 1. Find all active ScreenShows for this theatre on the selected date ──
    //    A show is "on this date" when the date is in its runningDates array.
    const shows = await ScreenShow.find({
      theatreOwnerId: theatreId,
      runningDates: date,   // date must be in the array
      status: 'Active',
    }).lean();

    if (!shows.length) {
      return res.json({ success: true, data: [], message: 'No shows scheduled for this date.' });
    }

    // ── 2. Determine NOW (for filtering past times on today's date) ────────────
    const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
    const isToday  = date === todayIST;
    const nowIST   = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));

    /** Parse "10:30 AM" / "7:48 PM" → Date object on the chosen date */
    function parseTime(timeStr) {
      const [time, period] = timeStr.trim().split(' ');
      let [h, m] = time.split(':').map(Number);
      if (period === 'PM' && h !== 12) h += 12;
      if (period === 'AM' && h === 12) h = 0;
      const d = new Date(`${date}T00:00:00`);
      d.setHours(h, m, 0, 0);
      return d;
    }

    // ── 3. Collect unique screenIds and fetch their names ─────────────────────
    const uniqueScreenIds = [...new Set(shows.map(s => s.screenId))];
    const layouts = await ScreenLayout.find(
      { screenId: { $in: uniqueScreenIds } },
      { screenId: 1, screenName: 1, _id: 0 }
    ).lean();
    const screenNameMap = {};
    layouts.forEach(l => { screenNameMap[l.screenId] = l.screenName || l.screenId; });

    // ── 4. Count booked seats per (screenId, date, showtime) for available-seat calc ──
    //    We lean on the Booking model's screenId + bookingDate + showtime fields.
    const bookingCounts = {};
    try {
      const bookings = await Booking.aggregate([
        {
          $match: {
            screenId: { $in: uniqueScreenIds },
            bookingDate: date,
            status: { $in: ['confirmed', 'pending'] },
          },
        },
        {
          $group: {
            _id: { screenId: '$screenId', showtime: '$showtime' },
            count: { $sum: { $size: { $ifNull: ['$seats', []] } } },
          },
        },
      ]);
      bookings.forEach(b => {
        bookingCounts[`${b._id.screenId}__${b._id.showtime}`] = b.count;
      });
    } catch (_) { /* booking count is best-effort */ }

    // ── 5. Group showtimes by screen, filter past times, attach seat count ────
    const screenMap = {};
    for (const show of shows) {
      const sid   = show.screenId;
      const name  = screenNameMap[sid] || sid;

      if (!screenMap[sid]) {
        screenMap[sid] = { screen: name, showtimes: [] };
      }

      for (const timeStr of (show.showtimes || [])) {
        // Skip past showtimes on today's date
        if (isToday && parseTime(timeStr) <= nowIST) continue;

        // Avoid duplicate time entries for the same screen
        const alreadyAdded = screenMap[sid].showtimes.some(s => s.startTime === timeStr);
        if (alreadyAdded) continue;

        const booked    = bookingCounts[`${sid}__${timeStr}`] || 0;
        const totalSeats = show.totalSeats || 100; // fallback if not stored
        const available  = Math.max(0, totalSeats - booked);

        screenMap[sid].showtimes.push({
          showtimeId:     `${show._id}-${timeStr.replace(/\s/g, '')}`,
          startTime:      timeStr,
          availableSlots: available,
        });
      }

      // Remove screen if all its times were in the past
      if (screenMap[sid].showtimes.length === 0) {
        delete screenMap[sid];
      }
    }

    const screens = Object.values(screenMap);

    return res.json({ success: true, data: screens });
  } catch (err) {
    console.error('Error fetching showtimes:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch showtimes' });
  }
});

// ─── GET /api/v1/special-moments/templates ───────────────────────────────────
router.get('/templates', async (req, res) => {
  try {
    const { occasion } = req.query;
    let filtered = TEMPLATES;
    if (occasion) {
      filtered = TEMPLATES.filter(t => t.occasion === occasion);
    }
    return res.json({ success: true, data: filtered });
  } catch (err) {
    console.error('Error fetching templates:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch templates' });
  }
});

// ─── GET /api/v1/special-moments/pricing ─────────────────────────────────────
router.get('/pricing', (req, res) => {
  return res.json({ success: true, data: SPECIAL_MOMENT_PRICE });
});


// ─── POST /api/v1/special-moments/bookings ───────────────────────────────────
router.post('/bookings', authenticateUser, async (req, res) => {
  try {
    const {
      theatreId, screen, showtimeId, showDate, showTime,
      occasion, templateId, recipientName, senderName, message,
      mediaUrl, mediaType, totalAmount, theatreName,
    } = req.body;

    if (!theatreId || !screen || !showDate || !showTime || !occasion || !templateId || !recipientName || !senderName) {
      return res.status(400).json({ success: false, error: 'Missing required booking fields' });
    }

    const priceObj = SPECIAL_MOMENT_PRICE[occasion];
    if (!priceObj) {
      return res.status(400).json({ success: false, error: 'Invalid occasion type' });
    }
    const price = priceObj.total;

    // Resolve theatre name if not provided
    let resolvedTheatreName = theatreName || 'Theatre';
    if (!theatreName) {
      const t = await Theatre.findById(theatreId).select('name').lean()
              || await TheatreOwner.findById(theatreId).select('theatreName').lean();
      if (t) resolvedTheatreName = t.name || t.theatreName || 'Theatre';
    }

    // Create booking with pending status
    const booking = new SpecialMomentBooking({
      user: req.user._id,
      theatre: theatreId,
      theatreName: resolvedTheatreName,
      screen,
      showDate,
      showTime,
      occasion,
      templateId,
      recipientName,
      senderName,
      message: message || '',
      mediaUrl: mediaUrl || '',
      mediaType: mediaType || 'none',
      totalAmount: price,
      status: 'pending',
    });
    await booking.save();

    // Create Razorpay order
    const order = await paymentService.createOrder({
      amountInPaise: priceObj.total * 100,
      currency: 'INR',
      receipt: booking.bookingId,
      notes: { bookingId: booking.bookingId, occasion },
    });

    // Save razorpay order id
    booking.razorpayOrderId = order.id;
    await booking.save();

    return res.json({
      success: true,
      data: {
        bookingId: booking.bookingId,
        razorpayOrderId: order.id,
        amount: priceObj.total,
        base: priceObj.base,
        tax: priceObj.tax,
        currency: 'INR',
        keyId,
      },
    });
  } catch (err) {
    console.error('Error creating special moment booking:', err);
    return res.status(500).json({ success: false, error: 'Failed to create booking' });
  }
});

// ─── POST /api/v1/special-moments/bookings/:bookingId/confirm ────────────────
router.post('/bookings/:bookingId/confirm', authenticateUser, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;

    const booking = await SpecialMomentBooking.findOne({ bookingId });
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    // Verify Razorpay signature
    const isValid = paymentService.verifySignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
    });

    if (!isValid) {
      return res.status(400).json({ success: false, error: 'Payment signature verification failed' });
    }

    booking.razorpayPaymentId = razorpayPaymentId;
    booking.razorpayOrderId = razorpayOrderId;
    booking.status = 'confirmed';
    await booking.save();

    return res.json({ success: true, data: booking });
  } catch (err) {
    console.error('Error confirming special moment booking:', err);
    return res.status(500).json({ success: false, error: 'Failed to confirm booking' });
  }
});

// ─── GET /api/v1/special-moments/bookings/:bookingId ─────────────────────────
router.get('/bookings/:bookingId', authenticateUser, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const booking = await SpecialMomentBooking.findOne({ bookingId }).lean();
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }
    return res.json({ success: true, data: booking });
  } catch (err) {
    console.error('Error fetching special moment booking:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch booking' });
  }
});

module.exports = router;
