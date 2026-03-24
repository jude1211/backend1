/**
 * routes/pricing.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Pricing API route for the BookNView cinema booking backend.
 *
 * POST /api/v1/pricing/ticket-price
 *   → Calls the XGBoost ML microservice to predict demand,
 *     then applies a discount-only rule to return the final ticket price.
 *
 * GET  /api/v1/pricing/health
 *   → Quick health-check to confirm pricing service + ML service status.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { getPricingDecision, getDemandScore } = require('../services/dynamicPricingService');

const router = express.Router();

// ── Validation middleware ─────────────────────────────────────────────────────
const pricingValidators = [
  body('basePrice')
    .isFloat({ min: 1 })
    .withMessage('basePrice must be a positive number'),

  body('showtime')
    .notEmpty()
    .withMessage('showtime is required (ISO 8601 string, e.g. "2026-03-19T22:30:00")')
    .isISO8601()
    .withMessage('showtime must be a valid ISO 8601 datetime string'),

  body('show_hour')
    .isInt({ min: 0, max: 23 })
    .withMessage('show_hour must be an integer between 0 and 23'),

  body('day_of_week')
    .isInt({ min: 0, max: 6 })
    .withMessage('day_of_week must be an integer between 0 (Mon) and 6 (Sun)'),

  body('seat_occupancy_pct')
    .isFloat({ min: 0, max: 1 })
    .withMessage('seat_occupancy_pct must be a float between 0 and 1'),

  body('movie_popularity')
    .isFloat({ min: 0, max: 1 })
    .withMessage('movie_popularity must be a float between 0 and 1'),

  body('recent_bookings')
    .isInt({ min: 0 })
    .withMessage('recent_bookings must be a non-negative integer'),
];

// ── POST /api/v1/pricing/ticket-price ────────────────────────────────────────
/**
 * @route  POST /api/v1/pricing/ticket-price
 * @desc   Predict demand and return final (possibly discounted) ticket price
 * @access Public
 *
 * Request body:
 *   {
 *     "basePrice"          : 200,
 *     "showtime"           : "2026-03-19T22:30:00",
 *     "show_hour"          : 22,
 *     "day_of_week"        : 3,       // 0=Mon … 6=Sun
 *     "seat_occupancy_pct" : 0.10,
 *     "movie_popularity"   : 0.25,
 *     "recent_bookings"    : 3
 *   }
 *
 * Response:
 *   {
 *     "success"          : true,
 *     "basePrice"        : 200,
 *     "finalPrice"       : 160,       // same as basePrice if no discount
 *     "demandScore"      : 0.18,
 *     "demandLevel"      : "LOW",
 *     "discountApplied"  : true,
 *     "discountPercent"  : 20,
 *     "mlServiceStatus"  : "ok",
 *     "rule"             : "demand < 0.4 AND showtime within 60 min → 20% discount"
 *   }
 */
router.post('/ticket-price', pricingValidators, async (req, res) => {
  // Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array(),
    });
  }

  const {
    basePrice,
    showtime,
    show_hour,
    day_of_week,
    seat_occupancy_pct,
    movie_popularity,
    recent_bookings,
  } = req.body;

  try {
    const decision = await getPricingDecision({
      basePrice: parseFloat(basePrice),
      showtime,
      show_hour: parseInt(show_hour),
      day_of_week: parseInt(day_of_week),
      seat_occupancy_pct: parseFloat(seat_occupancy_pct),
      movie_popularity: parseFloat(movie_popularity),
      recent_bookings: parseInt(recent_bookings),
    });

    return res.status(200).json({
      success: true,
      ...decision,
      rule: 'sliding discount: score<0.20→30% | score<0.40→20% | score<0.60→10% | score≥0.60→base price (no window restriction)',
    });
  } catch (error) {
    console.error('❌ Pricing endpoint error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to compute ticket price',
      details: error.message,
    });
  }
});

// ── GET /api/v1/pricing/health ─────────────────────────────────────────────
/**
 * @route  GET /api/v1/pricing/health
 * @desc   Confirms the pricing route is alive; also pings the ML service
 * @access Public
 */
router.get('/health', async (req, res) => {
  let mlStatus = 'unknown';

  try {
    // Quick test prediction to check ML service connectivity
    await getDemandScore({
      show_hour: 12,
      day_of_week: 0,
      seat_occupancy_pct: 0.5,
      movie_popularity: 0.5,
      recent_bookings: 10,
    });
    mlStatus = 'ok';
  } catch {
    mlStatus = 'unavailable';
  }

  return res.status(200).json({
    success: true,
    pricingRoute: 'ok',
    mlService: mlStatus,
    mlServiceUrl: process.env.ML_SERVICE_URL || 'http://localhost:8000',
  });
});

module.exports = router;
