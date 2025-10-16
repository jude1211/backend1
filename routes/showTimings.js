const express = require('express');
const { body, validationResult } = require('express-validator');
const ShowTiming = require('../models/ShowTiming');
const { authenticateTheatreOwner } = require('../middleware/theatreOwnerAuth');

const router = express.Router();

// Get all show timings for a theatre owner
router.get('/owner/:ownerId', authenticateTheatreOwner, async (req, res) => {
  try {
    const { ownerId } = req.params;
    
    // Verify ownership
    if (String(req.theatreOwner._id) !== String(ownerId)) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    const timings = await ShowTiming.find({ 
      theatreOwnerId: ownerId,
      isActive: true 
    }).sort({ type: 1, specialDate: 1 });

    res.json({ success: true, data: timings });
  } catch (error) {
    console.error('Get show timings error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch show timings' });
  }
});

// Get available timings for a specific date
router.get('/owner/:ownerId/available/:date', authenticateTheatreOwner, async (req, res) => {
  try {
    const { ownerId, date } = req.params;
    
    if (String(req.theatreOwner._id) !== String(ownerId)) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
    
    // Get base timings (weekday or weekend)
    const baseType = isWeekend ? 'weekend' : 'weekday';
    const baseTiming = await ShowTiming.findOne({ 
      theatreOwnerId: ownerId, 
      type: baseType,
      isActive: true 
    });

    // Get special timings for this date
    const specialTimings = await ShowTiming.find({
      theatreOwnerId: ownerId,
      type: 'special',
      specialDate: {
        $gte: new Date(targetDate.setHours(0, 0, 0, 0)),
        $lt: new Date(targetDate.setHours(23, 59, 59, 999))
      },
      isActive: true
    });

    // Combine all available timings
    let allTimings = [];
    if (baseTiming) {
      allTimings = [...baseTiming.timings];
    }
    specialTimings.forEach(special => {
      allTimings = [...allTimings, ...special.timings];
    });

    // Remove duplicates and sort
    const uniqueTimings = [...new Set(allTimings)].sort();

    res.json({ 
      success: true, 
      data: {
        date,
        dayType: isWeekend ? 'weekend' : 'weekday',
        baseTimings: baseTiming?.timings || [],
        specialTimings: specialTimings.map(s => ({
          id: s._id,
          timings: s.timings,
          description: s.description
        })),
        allAvailable: uniqueTimings
      }
    });
  } catch (error) {
    console.error('Get available timings error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch available timings' });
  }
});

// Create or update weekday timings
router.post('/owner/:ownerId/weekday', [
  authenticateTheatreOwner,
  body('timings').isArray().withMessage('Timings must be an array'),
  body('timings.*').isString().withMessage('Each timing must be a string')
], async (req, res) => {
  try {
    const { ownerId } = req.params;
    const { timings } = req.body;
    
    if (String(req.theatreOwner._id) !== String(ownerId)) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
    }

    const timing = await ShowTiming.findOneAndUpdate(
      { theatreOwnerId: ownerId, type: 'weekday' },
      { 
        theatreOwnerId: ownerId,
        type: 'weekday',
        timings: timings,
        isActive: true
      },
      { new: true, upsert: true }
    );

    res.json({ success: true, data: timing });
  } catch (error) {
    console.error('Save weekday timings error:', error);
    res.status(500).json({ success: false, error: 'Failed to save weekday timings' });
  }
});

// Create or update weekend timings
router.post('/owner/:ownerId/weekend', [
  authenticateTheatreOwner,
  body('timings').isArray().withMessage('Timings must be an array'),
  body('timings.*').isString().withMessage('Each timing must be a string')
], async (req, res) => {
  try {
    const { ownerId } = req.params;
    const { timings } = req.body;
    
    if (String(req.theatreOwner._id) !== String(ownerId)) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
    }

    const timing = await ShowTiming.findOneAndUpdate(
      { theatreOwnerId: ownerId, type: 'weekend' },
      { 
        theatreOwnerId: ownerId,
        type: 'weekend',
        timings: timings,
        isActive: true
      },
      { new: true, upsert: true }
    );

    res.json({ success: true, data: timing });
  } catch (error) {
    console.error('Save weekend timings error:', error);
    res.status(500).json({ success: false, error: 'Failed to save weekend timings' });
  }
});

// Create special showtime
router.post('/owner/:ownerId/special', [
  authenticateTheatreOwner,
  body('timings').isArray().withMessage('Timings must be an array'),
  body('timings.*').isString().withMessage('Each timing must be a string'),
  body('specialDate').isISO8601().withMessage('Special date must be valid'),
  body('description').optional().isString().withMessage('Description must be a string')
], async (req, res) => {
  try {
    const { ownerId } = req.params;
    const { timings, specialDate, description = '' } = req.body;
    
    if (String(req.theatreOwner._id) !== String(ownerId)) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
    }

    const timing = new ShowTiming({
      theatreOwnerId: ownerId,
      type: 'special',
      timings: timings,
      specialDate: new Date(specialDate),
      description: description,
      isActive: true
    });

    await timing.save();
    res.status(201).json({ success: true, data: timing });
  } catch (error) {
    console.error('Create special timing error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, error: 'Special timing already exists for this date' });
    }
    res.status(500).json({ success: false, error: 'Failed to create special timing' });
  }
});

// Update special showtime
router.put('/special/:timingId', [
  authenticateTheatreOwner,
  body('timings').isArray().withMessage('Timings must be an array'),
  body('timings.*').isString().withMessage('Each timing must be a string'),
  body('description').optional().isString().withMessage('Description must be a string')
], async (req, res) => {
  try {
    const { timingId } = req.params;
    const { timings, description } = req.body;
    
    const timing = await ShowTiming.findOne({ 
      _id: timingId, 
      theatreOwnerId: req.theatreOwner._id,
      type: 'special'
    });

    if (!timing) {
      return res.status(404).json({ success: false, error: 'Special timing not found' });
    }

    timing.timings = timings;
    if (description !== undefined) {
      timing.description = description;
    }

    await timing.save();
    res.json({ success: true, data: timing });
  } catch (error) {
    console.error('Update special timing error:', error);
    res.status(500).json({ success: false, error: 'Failed to update special timing' });
  }
});

// Delete special showtime
router.delete('/special/:timingId', authenticateTheatreOwner, async (req, res) => {
  try {
    const { timingId } = req.params;
    
    const timing = await ShowTiming.findOneAndDelete({ 
      _id: timingId, 
      theatreOwnerId: req.theatreOwner._id,
      type: 'special'
    });

    if (!timing) {
      return res.status(404).json({ success: false, error: 'Special timing not found' });
    }

    res.json({ success: true, message: 'Special timing deleted' });
  } catch (error) {
    console.error('Delete special timing error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete special timing' });
  }
});

module.exports = router;
