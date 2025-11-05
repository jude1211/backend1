const rateLimit = require('express-rate-limit');

// Security configuration constants
const SECURITY_CONFIG = {
  // Rate limiting configurations
  RATE_LIMITS: {
    // General API rate limit
    general: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // limit each IP to 1000 requests per windowMs
      message: {
        error: 'Too many requests from this IP, please try again later.'
      },
      standardHeaders: true,
      legacyHeaders: false
    },
    
    // Strict rate limit for sensitive operations
    strict: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 50, // More restrictive for booking operations
      message: {
        error: 'Too many booking requests from this IP, please try again later.'
      }
    },
    
    // Seat layout rate limit (more lenient for real-time updates)
    seatLayout: {
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 30, // 30 requests per minute
      message: {
        error: 'Too many seat layout requests from this IP, please try again later.'
      }
    },
    
    // Auth rate limit
    auth: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 10, // 10 login attempts per 15 minutes
      message: {
        error: 'Too many authentication attempts, please try again later.'
      }
    }
  },
  
  // CORS configuration
  CORS_ORIGINS: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:5175'
  ],
  
  // Security headers
  HELMET_CONFIG: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'", "https://api.razorpay.com", "https://api.cloudinary.com"],
        frameSrc: ["'self'", "https://js.razorpay.com"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false
  },
  
  // Password requirements
  PASSWORD_REQUIREMENTS: {
    minLength: 6,
    requireUppercase: false,
    requireLowercase: false,
    requireNumbers: true,
    requireSpecialChars: false,
    maxLength: 128
  },
  
  // File upload limits
  FILE_UPLOAD: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'],
    maxFiles: 10
  },
  
  // Session configuration
  SESSION: {
    secret: process.env.SESSION_SECRET || 'your-session-secret-here',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict'
  }
};

// Create rate limiters
const createRateLimiter = (config) => {
  return rateLimit({
    ...config,
    // Skip rate limiting for certain endpoints
    skip: (req) => {
      // Skip rate limiting for health checks
      if (req.path === '/health') return true;
      return false;
    }
  });
};

// Export rate limiters
const generalLimiter = createRateLimiter(SECURITY_CONFIG.RATE_LIMITS.general);
const strictLimiter = createRateLimiter(SECURITY_CONFIG.RATE_LIMITS.strict);
const seatLayoutLimiter = createRateLimiter(SECURITY_CONFIG.RATE_LIMITS.seatLayout);
const authLimiter = createRateLimiter(SECURITY_CONFIG.RATE_LIMITS.auth);

// Input sanitization helpers
const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return input.trim().replace(/[<>]/g, '');
  }
  return input;
};

// Validate password strength
const validatePassword = (password) => {
  const { minLength, requireNumbers } = SECURITY_CONFIG.PASSWORD_REQUIREMENTS;
  
  if (password.length < minLength) {
    return { valid: false, message: `Password must be at least ${minLength} characters long` };
  }
  
  if (requireNumbers && !/\d/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  
  return { valid: true };
};

// Validate file upload
const validateFileUpload = (file) => {
  const { maxFileSize, allowedTypes } = SECURITY_CONFIG.FILE_UPLOAD;
  
  if (file.size > maxFileSize) {
    return { valid: false, message: `File size must be less than ${maxFileSize / 1024 / 1024}MB` };
  }
  
  if (!allowedTypes.includes(file.mimetype)) {
    return { valid: false, message: `File type ${file.mimetype} is not allowed` };
  }
  
  return { valid: true };
};

module.exports = {
  SECURITY_CONFIG,
  generalLimiter,
  strictLimiter,
  seatLayoutLimiter,
  authLimiter,
  sanitizeInput,
  validatePassword,
  validateFileUpload
};
