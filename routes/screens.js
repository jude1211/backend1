const express = require('express');
const { body } = require('express-validator');
const ScreenLayout = require('../models/ScreenLayout');
const ScreenShow = require('../models/ScreenShow');
const { authenticateTheatreOwner } = require('../middleware/theatreOwnerAuth');

const router = express.Router();

// Save or update screen seat layout
router.post('/:id/layout', [
  body('meta.rows').isInt({ min: 1 }),
  body('meta.columns').isInt({ min: 1 }),
  body('meta.aisles').optional().isArray()
], async (req, res) => {
  try {
    const screenId = req.params.id;
    const payload = req.body;
    // Debug logging to verify full payload incl. seats array
    try { console.log('Save layout payload:', JSON.stringify({ screenId, seatsLen: Array.isArray(payload?.seats) ? payload.seats.length : 0 }, null, 2)); } catch {}
    const doc = await ScreenLayout.findOneAndUpdate(
      { screenId },
      {
        $set: {
          screenId,
          theatreId: payload.theatreId ?? undefined,
          screenName: payload.screenName ?? undefined,
          meta: payload.meta,
          seatClasses: payload.seatClasses ?? [],
          seats: Array.isArray(payload.seats) ? payload.seats : [], // replace FULL seats array
          updatedBy: payload.updatedBy ?? undefined,
          updatedAt: new Date()
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, data: doc });
  } catch (error) {
    console.error('Save screen layout error:', error);
    res.status(500).json({ success: false, error: 'Failed to save layout' });
  }
});

// Get screen seat layout
router.get('/:id/layout', async (req, res) => {
  try {
    const screenId = req.params.id;
    const doc = await ScreenLayout.findOne({ screenId });
    res.json({ success: true, data: doc });
  } catch (error) {
    console.error('Get screen layout error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch layout' });
  }
});

module.exports = router;

// ----- Show management for a screen -----

// List shows for a specific screen id (string)
router.get('/:id/shows', authenticateTheatreOwner, async (req, res) => {
  try {
    const screenId = req.params.id;
    const { date } = req.query;
    const filter = { screenId };
    // Only filter by date if explicitly requested, otherwise return all shows for the screen
    if (date) filter.bookingDate = String(date);
    const docs = await ScreenShow.find(filter)
      .sort({ bookingDate: -1, createdAt: -1 })
      .populate('movieId', 'title posterUrl duration releaseDate advanceBookingEnabled firstShowDate');
    res.json({ success: true, data: docs });
  } catch (error) {
    console.error('Get screen shows error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch shows' });
  }
});

// Save/replace shows for a screen for a given movie
router.post('/:id/shows', authenticateTheatreOwner, async (req, res) => {
  try {
    const screenId = req.params.id;
    const { movieId, showtimes = [], status = 'Active', bookingDate, maxDays } = req.body || {};
    if (!movieId) {
      return res.status(400).json({ success: false, error: 'movieId is required' });
    }

    // Get movie details for advance booking validation
    const Movie = require('../models/Movie');
    const movie = await Movie.findById(movieId);
    if (!movie) {
      return res.status(400).json({ success: false, error: 'Movie not found' });
    }

    // Validate bookingDate within allowed range
    const today = new Date();
    const toIso = (d) => d.toISOString().slice(0,10);
    const normalizeDateStr = (s) => (typeof s === 'string' ? s.slice(0,10) : '');
    const dateStr = normalizeDateStr(bookingDate) || toIso(today);
    const requested = new Date(dateStr + 'T00:00:00Z');
    const base = new Date(toIso(today) + 'T00:00:00Z');
    const msPerDay = 24*60*60*1000;
    const diffDays = Math.round((requested - base) / msPerDay);
    const DEFAULT_MAX = parseInt(process.env.MAX_ADVANCE_DAYS || '3', 10);
    const clientAsked = parseInt(maxDays, 10);
    const allowed = Math.min(isNaN(clientAsked) ? DEFAULT_MAX : clientAsked, 14); // hard cap safety

    // Check for advance booking validation
    if (movie.releaseDate) {
      const releaseDate = new Date(movie.releaseDate);
      const isAdvanceBooking = requested < releaseDate;
      
      if (isAdvanceBooking && !movie.advanceBookingEnabled) {
        return res.status(400).json({ 
          success: false, 
          error: `Advance booking is not enabled for this movie. Release date: ${movie.releaseDate}` 
        });
      }
      
      // Allow advance booking up to release date
      if (isAdvanceBooking) {
        const daysUntilRelease = Math.ceil((releaseDate - base) / msPerDay);
        if (diffDays > daysUntilRelease) {
          return res.status(400).json({ 
            success: false, 
            error: `Cannot book beyond release date (${movie.releaseDate})` 
          });
        }
      }
    }

    if (diffDays < 0 || diffDays > allowed) {
      return res.status(400).json({ success: false, error: `bookingDate out of allowed range (0..${allowed} days)` });
    }

    const ownerId = req.theatreOwner?._id;
    const theatreId = null; // Optional: wire theatre relation later

    // Update movie's first show date if this is the first show assignment
    if (!movie.firstShowDate && requested >= base) {
      await Movie.findByIdAndUpdate(movieId, { 
        firstShowDate: dateStr,
        $setOnInsert: { createdAt: new Date() }
      });
    }

    // Upsert unique triple (screenId, bookingDate, movieId)
    const doc = await ScreenShow.findOneAndUpdate(
      { screenId, bookingDate: dateStr, movieId },
      { $set: { theatreOwnerId: ownerId, theatreId, screenId, movieId, bookingDate: dateStr, showtimes, status, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { new: true, upsert: true }
    );
    const populated = await doc.populate('movieId', 'title posterUrl duration releaseDate advanceBookingEnabled firstShowDate');
    res.json({ success: true, data: populated });
  } catch (error) {
    console.error('Save screen shows error:', error);
    res.status(500).json({ success: false, error: 'Failed to save shows' });
  }
});

// Delete a show document by id for a screen
router.delete('/:id/shows/:showId', authenticateTheatreOwner, async (req, res) => {
  try {
    const { showId } = req.params;
    await ScreenShow.findByIdAndDelete(showId);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete screen show error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete show' });
  }
});

