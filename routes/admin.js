const express = require('express');
const { body, validationResult } = require('express-validator');
const Movie = require('../models/Movie');
const ScreenLayout = require('../models/ScreenLayout');
const { authenticateUser, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All admin routes require user auth + admin role
router.use(authenticateUser, requireAdmin);

// ---- Movies CRUD ----
router.get('/movies', async (req, res) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Movie.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Movie.countDocuments({})
    ]);
    res.json({ success: true, data: items, pagination: { page, limit, total } });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to fetch movies' });
  }
});

router.post('/movies', [
  body('title').trim().notEmpty(),
  body('genre').trim().notEmpty(),
  body('duration').trim().notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success:false, error:'Validation failed', details: errors.array() });
  try {
    const doc = await Movie.create({
      title: req.body.title,
      genre: req.body.genre,
      duration: req.body.duration,
      posterUrl: req.body.posterUrl || '',
      status: req.body.status || 'active',
      description: req.body.description || '',
      releaseDate: req.body.releaseDate || '',
      trailerUrl: req.body.trailerUrl || ''
    });
    res.status(201).json({ success: true, data: doc });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to create movie' });
  }
});

router.put('/movies/:id', async (req, res) => {
  try {
    const doc = await Movie.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!doc) return res.status(404).json({ success:false, error:'Movie not found' });
    res.json({ success: true, data: doc });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to update movie' });
  }
});

router.delete('/movies/:id', async (req, res) => {
  try {
    await Movie.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to delete movie' });
  }
});

// ---- Screens CRUD ----
router.get('/screens', async (req, res) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      ScreenLayout.find({}).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
      ScreenLayout.countDocuments({})
    ]);
    res.json({ success: true, data: items, pagination: { page, limit, total } });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to fetch screens' });
  }
});

router.post('/screens', [
  body('screenId').notEmpty(),
  body('meta.rows').isInt({ min: 1 }),
  body('meta.columns').isInt({ min: 1 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success:false, error:'Validation failed', details: errors.array() });
  try {
    const doc = await ScreenLayout.findOneAndUpdate(
      { screenId: String(req.body.screenId) },
      { $set: { screenId: String(req.body.screenId), screenName: req.body.screenName, meta: req.body.meta, seatClasses: req.body.seatClasses || [], seats: req.body.seats || [], updatedAt: new Date() } },
      { new: true, upsert: true }
    );
    res.status(201).json({ success: true, data: doc });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to create screen' });
  }
});

router.put('/screens/:id', async (req, res) => {
  try {
    const doc = await ScreenLayout.findOneAndUpdate({ screenId: req.params.id }, { $set: req.body }, { new: true });
    if (!doc) return res.status(404).json({ success:false, error:'Screen not found' });
    res.json({ success: true, data: doc });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to update screen' });
  }
});

router.delete('/screens/:id', async (req, res) => {
  try {
    await ScreenLayout.findOneAndDelete({ screenId: req.params.id });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to delete screen' });
  }
});

module.exports = router;


