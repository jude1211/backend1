/**
 * dynamicPricingService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Integrates with the Python XGBoost ML microservice to get a demand score,
 * then applies a discount-only pricing rule for cinema ticket pricing.
 *
 * Pricing Rule:
 *   ∙ demand_score < 0.4  AND  showtime is within 60 min  →  20% DISCOUNT
 *   ∙ Anything else                                        →  BASE PRICE kept
 *
 * NO PRICE INCREASES are ever applied.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const https = require('https');
const http  = require('http');

// ML microservice URL (runs locally on port 8085)
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8085';
const ML_TIMEOUT_MS  = parseInt(process.env.ML_TIMEOUT_MS) || 5000;

// Discount configuration
const DISCOUNT_RATE            = 0.20;  // 20 %
const LOW_DEMAND_THRESHOLD     = 0.40;  // demand_score below this → "low"
const NEAR_SHOWTIME_MINUTES    = 60;    // showtime within N minutes

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Make a POST request to the ML service.
 * Returns the parsed JSON body (demand_score, demand_level).
 */
function callMLService(features) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(features);
    const url  = new URL('/predict-demand', ML_SERVICE_URL);

    const options = {
      hostname : url.hostname,
      port     : url.port || (url.protocol === 'https:' ? 443 : 80),
      path     : url.pathname,
      method   : 'POST',
      headers  : {
        'Content-Type'   : 'application/json',
        'Content-Length' : Buffer.byteLength(body),
      },
    };

    const lib     = url.protocol === 'https:' ? https : http;
    const timeout = setTimeout(() => {
      req.destroy(new Error('ML service request timed out'));
    }, ML_TIMEOUT_MS);

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        clearTimeout(timeout);
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode !== 200) {
            reject(new Error(`ML service HTTP ${res.statusCode}: ${data}`));
          } else {
            resolve(parsed);
          }
        } catch (err) {
          reject(new Error(`ML service parse error: ${err.message}`));
        }
      });
    });

    req.on('error', (err) => { clearTimeout(timeout); reject(err); });
    req.write(body);
    req.end();
  });
}

/**
 * Returns true if the showtime is within NEAR_SHOWTIME_MINUTES from now.
 * @param {string|Date} showtimeISO – ISO 8601 string or Date object
 */
function isWithinOneHour(showtimeISO) {
  const now            = Date.now();
  const showMs         = new Date(showtimeISO).getTime();
  const diffMinutes    = (showMs - now) / (1000 * 60);
  return diffMinutes >= 0 && diffMinutes <= NEAR_SHOWTIME_MINUTES;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Calls the ML microservice and returns the demand prediction.
 *
 * @param {Object} features
 * @param {number} features.show_hour          – Hour of day (0-23)
 * @param {number} features.day_of_week        – 0=Mon … 6=Sun
 * @param {number} features.seat_occupancy_pct – Fraction booked (0-1)
 * @param {number} features.movie_popularity   – Normalised score (0-1)
 * @param {number} features.recent_bookings    – Bookings in last 60 min
 *
 * @returns {Promise<{ demand_score: number, demand_level: string }>}
 */
async function getDemandScore(features) {
  return callMLService(features);
}

/**
 * Applies the pricing rule and returns the final ticket price.
 *
 * Rule (DISCOUNT-ONLY – prices never increase):
 *   demand_score < LOW_DEMAND_THRESHOLD  AND  showtime within 60 min
 *     → apply DISCOUNT_RATE
 *   otherwise
 *     → keep base price
 *
 * @param {number} basePrice    – Original ticket price (e.g., 200)
 * @param {number} demandScore  – Predicted demand (0-1)
 * @param {string|Date} showtimeISO – ISO showtime string
 *
 * @returns {{ finalPrice: number, discountApplied: boolean, discountPercent: number }}
 */
function calculateFinalPrice(basePrice, demandScore, showtimeISO) {
  const isLowDemand = demandScore < LOW_DEMAND_THRESHOLD;
  const isNearShow  = isWithinOneHour(showtimeISO);

  if (isLowDemand && isNearShow) {
    const finalPrice = parseFloat((basePrice * (1 - DISCOUNT_RATE)).toFixed(2));
    return {
      finalPrice,
      discountApplied : true,
      discountPercent : DISCOUNT_RATE * 100,
    };
  }

  return {
    finalPrice      : parseFloat(basePrice.toFixed(2)),
    discountApplied : false,
    discountPercent : 0,
  };
}

/**
 * High-level convenience function: predict demand + compute final price.
 * Falls back to base price if the ML service is unavailable.
 *
 * @param {Object} params
 * @param {number} params.basePrice
 * @param {string|Date} params.showtime       – ISO showtime
 * @param {number} params.show_hour
 * @param {number} params.day_of_week
 * @param {number} params.seat_occupancy_pct
 * @param {number} params.movie_popularity
 * @param {number} params.recent_bookings
 *
 * @returns {Promise<Object>}
 */
async function getPricingDecision(params) {
  const {
    basePrice,
    showtime,
    show_hour,
    day_of_week,
    seat_occupancy_pct,
    movie_popularity,
    recent_bookings,
  } = params;

  let demandScore  = null;
  let demandLevel  = 'UNKNOWN';
  let mlError      = null;

  try {
    const result = await getDemandScore({
      show_hour,
      day_of_week,
      seat_occupancy_pct,
      movie_popularity,
      recent_bookings,
    });
    demandScore = result.demand_score;
    demandLevel = result.demand_level;
  } catch (err) {
    mlError = err.message;
    console.warn(`⚠️  ML service unavailable – falling back to base price. Reason: ${err.message}`);
  }

  // If ML call failed → return base price (graceful degradation)
  if (demandScore === null) {
    return {
      basePrice,
      finalPrice      : basePrice,
      demandScore     : null,
      demandLevel     : 'UNKNOWN',
      discountApplied : false,
      discountPercent : 0,
      mlServiceStatus : 'unavailable',
      mlError,
    };
  }

  const pricing = calculateFinalPrice(basePrice, demandScore, showtime);

  return {
    basePrice,
    ...pricing,
    demandScore,
    demandLevel,
    mlServiceStatus: 'ok',
  };
}

module.exports = {
  getDemandScore,
  calculateFinalPrice,
  getPricingDecision,
};
