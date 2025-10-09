const express = require('express');
const router = express.Router();
const ScreenShow = require('../models/ScreenShow');
const ScreenLayout = require('../models/ScreenLayout');
const Booking = require('../models/Booking');

// GET /api/v1/shows/:showId/seat-layout
router.get('/:showId/seat-layout', async (req, res) => {
  try {
    const show = await ScreenShow.findById(req.params.showId);
    if (!show) return res.status(404).json({ message: 'Show not found' });

    const layout = await ScreenLayout.findOne({ screenId: show.screenId });
    if (!layout) return res.status(404).json({ message: 'Seat layout not found' });

    // Fetch all bookings for this show
    const bookings = await Booking.find({ showId: show._id });
    const bookedSeats = bookings.flatMap(b => b.seats);

    // Mark each seat as booked or available
    const seatLayoutWithStatus = layout.seats.map(seat => ({
      ...seat,
      isBooked: bookedSeats.includes(seat.label)
    }));

    res.json({
      screen: layout.screenName,
      seats: seatLayoutWithStatus,
      meta: layout.meta // colors, classes, etc.
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
