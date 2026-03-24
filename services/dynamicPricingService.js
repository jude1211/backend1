const axios = require('axios');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8085';
const ML_TIMEOUT_MS  = 5000;

/**
 * Sliding-scale discount based on predicted demand score (0–1).
 *
 *  score < 0.20  →  30% off   (very low demand)
 *  score < 0.40  →  20% off   (low demand)
 *  score < 0.60  →  10% off   (moderate demand)
 *  score ≥ 0.60  →   0% off   (high demand – base price maintained)
 */
function getDiscountPercent(demandScore) {
  if (demandScore < 0.20) return 30;
  if (demandScore < 0.40) return 20;
  if (demandScore < 0.60) return 10;
  return 0;
}

/**
 * Classify demand score into a human-readable label.
 */
function demandLabel(score) {
  if (score < 0.40) return 'LOW';
  if (score < 0.60) return 'MEDIUM';
  return 'HIGH';
}

/**
 * Call the ML service and return the raw demand score.
 * @param {{ show_hour, day_of_week, seat_occupancy_pct, movie_popularity, recent_bookings }} features
 * @returns {Promise<number>} demand score 0–1
 */
async function getDemandScore(features) {
  const response = await axios.post(
    `${ML_SERVICE_URL}/predict-demand`,
    {
      show_hour:          features.show_hour,
      day_of_week:        features.day_of_week,
      seat_occupancy_pct: features.seat_occupancy_pct,
      movie_popularity:   features.movie_popularity,
      recent_bookings:    features.recent_bookings ?? 0,
    },
    { timeout: ML_TIMEOUT_MS }
  );
  const score = response.data?.demand_score ?? response.data?.score ?? null;
  if (score === null || score === undefined) {
    throw new Error('ML service returned no demand score');
  }
  return parseFloat(score);
}

/**
 * Full pricing decision: calls ML, applies sliding discount, returns result object.
 *
 * Dynamic pricing applies only for shows within a 60-min window constraint.
 * If ML is unavailable, base price is returned with reason 'ml_error'.
 *
 * @param {object} params
 * @param {number} params.basePrice           - Original seat price (₹)
 * @param {number} params.show_hour           - Hour of show (0-23)
 * @param {number} params.day_of_week         - 0=Monday … 6=Sunday
 * @param {number} params.seat_occupancy_pct  - Fraction already booked (0–1)
 * @param {number} params.movie_popularity    - Normalised popularity (0–1)
 * @param {number} [params.recent_bookings]   - Bookings in last 60 min
 * @returns {Promise<object>} pricing decision
 */
async function getPricingDecision({
  basePrice,
  show_hour,
  day_of_week,
  seat_occupancy_pct,
  movie_popularity,
  recent_bookings = 0,
}) {
  try {
    const features = {
      show_hour:          show_hour,
      day_of_week:        day_of_week,
      seat_occupancy_pct: parseFloat(seat_occupancy_pct),
      movie_popularity:   parseFloat(movie_popularity),
      recent_bookings:    parseInt(recent_bookings, 10),
    };

    console.log('[DynamicPricing] Sending features to ML:', features);
    const demandScore = await getDemandScore(features);
    console.log(`[DynamicPricing] Demand score: ${demandScore}`);

    const discountPercent = getDiscountPercent(demandScore);
    const level           = demandLabel(demandScore);

    if (discountPercent > 0) {
      const discountedPrice = Math.round(basePrice * (1 - discountPercent / 100));
      console.log(`[DynamicPricing] demand=${demandScore} (${level}) → ${discountPercent}% off: ₹${basePrice} → ₹${discountedPrice}`);
      return {
        price:           discountedPrice,
        originalPrice:   basePrice,
        discountApplied: true,
        discountPercent,
        demandScore,
        demandLevel:     level,
        reason:          'dynamic_demand',
      };
    }

    console.log(`[DynamicPricing] High demand (${demandScore}), base price applies`);
    return {
      price:           basePrice,
      originalPrice:   basePrice,
      discountApplied: false,
      discountPercent: 0,
      demandScore,
      demandLevel:     level,
      reason:          'high_demand',
    };

  } catch (err) {
    console.error('[DynamicPricing] ML service error, falling back to base price:', err.message);
    return {
      price:           basePrice,
      originalPrice:   basePrice,
      discountApplied: false,
      discountPercent: 0,
      reason:          'ml_error',
    };
  }
}

/**
 * Legacy wrapper kept for backward compatibility with seatLayout.js /live route.
 * Accepts (basePrice, showtimeDate, totalSeats, bookedSeats, moviePopularity).
 */
async function getDynamicPrice(basePrice, showtimeDate, totalSeats, bookedSeats, moviePopularity = 5) {
  const diffMins = (showtimeDate.getTime() - new Date().getTime()) / (1000 * 60);

  if (diffMins > 60 || diffMins < 0) {
    return {
      price: basePrice,
      originalPrice: basePrice,
      discountApplied: false,
      discountPercent: 0,
      reason: 'outside_time_window',
    };
  }

  const occupancyPct = totalSeats > 0 ? bookedSeats / totalSeats : 0;
  const showHour     = showtimeDate instanceof Date ? showtimeDate.getHours()  : 12;
  const dayOfWeek    = showtimeDate instanceof Date ? showtimeDate.getDay()    : 0;

  // Normalise moviePopularity: if given as 0-10 scale, convert to 0-1
  const normalizedPopularity = moviePopularity > 1 ? moviePopularity / 10 : moviePopularity;

  return getPricingDecision({
    basePrice,
    show_hour:          showHour,
    day_of_week:        dayOfWeek,
    seat_occupancy_pct: parseFloat(occupancyPct.toFixed(4)),
    movie_popularity:   parseFloat(normalizedPopularity.toFixed(4)),
    recent_bookings:    bookedSeats,
  });
}

module.exports = { getDynamicPrice, getPricingDecision, getDemandScore };
