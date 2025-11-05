const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const movieRoutes = require('./routes/movies');
const bookingRoutes = require('./routes/bookings');
const theatreRoutes = require('./routes/theatres');
const theatreOwnerAuthRoutes = require('./routes/theatreOwnerAuth');
const offlineBookingRoutes = require('./routes/offlineBookings');
const screenRoutes = require('./routes/screens');
const showTimingRoutes = require('./routes/showTimings');
const movieRatingRoutes = require('./routes/movieRatings');
const paymentRoutes = require('./routes/payments');
const proxyRoutes = require('./routes/proxy');
const analyticsRoutes = require('./routes/analytics');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const { initializeFirebase } = require('./config/firebase');

// Import cleanup script
const { cleanupPastShows } = require('./scripts/cleanupPastShows');

const app = express();

// Initialize Firebase Admin
initializeFirebase();

// Security middleware
app.use(helmet({
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
  crossOriginEmbedderPolicy: false,
  // Allow OAuth popups (e.g., Firebase Google auth)
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }
}));
app.use(compression());

// Permissive CORS specifically for proxy endpoint to ensure cross-origin access
// Place this BEFORE the global CORS so it applies to the proxy path first
app.use(/\/api\/v\d+\/proxy/, cors({ origin: true, credentials: false }));
app.options(/\/api\/v\d+\/proxy/, cors({ origin: true, credentials: false }));
// Also expose a non-versioned proxy path for backward/defensive compatibility
app.use('/proxy', cors({ origin: true, credentials: false }));
app.options('/proxy', cors({ origin: true, credentials: false }));

// CORS configuration - Support multiple frontend ports and preflight before any other middleware
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'https://booknview.vercel.app',
  'https://frontend-booknview.vercel.app', // ✅ your real deployed frontend
  process.env.CORS_ORIGIN
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(`❌ CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Cache-Control', 'Pragma', 'Expires']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Rate limiting (after CORS so preflight gets proper headers)
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000, // limit each IP to 1000 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip rate limiting for certain endpoints
  skip: (req) => {
    // Skip rate limiting for health checks
    if (req.path === '/health') return true;
    return false;
  }
});

// Apply different rate limits for different endpoints
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // More restrictive for booking operations
  message: {
    error: 'Too many booking requests from this IP, please try again later.'
  }
});

const seatLayoutLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute for seat layout (more lenient for real-time updates)
  message: {
    error: 'Too many seat layout requests from this IP, please try again later.'
  }
});

const moderateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Moderate for data fetching
  message: {
    error: 'Too many requests from this IP, please try again later.'
  }
});

// Apply rate limiting
app.use('/api/', limiter);
// Apply stricter limits to booking endpoints
app.use('/api/v1/bookings', strictLimiter);
// Apply specific limits to seat layout endpoints (more lenient for real-time updates)
app.use('/api/v1/seat-layout', seatLayoutLimiter);
// Apply moderate limits to data endpoints
app.use('/api/v1/movies', moderateLimiter);
app.use('/api/v1/theatres', moderateLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Static files
app.use('/uploads', express.static('uploads'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API routes
const apiVersion = process.env.API_VERSION || 'v1';
const seatLayoutRoutes = require('./routes/seatLayout');
const showSeatLayoutRoutes = require('./routes/showSeatLayout');
const adminRoutes = require('./routes/admin');
app.use(`/api/${apiVersion}/auth`, authRoutes);
app.use(`/api/${apiVersion}/users`, userRoutes);
app.use(`/api/${apiVersion}/movies`, movieRoutes);
app.use(`/api/${apiVersion}/bookings`, bookingRoutes);
app.use(`/api/${apiVersion}/theatres`, theatreRoutes);
app.use(`/api/${apiVersion}/theatre-owner`, theatreOwnerAuthRoutes);
app.use(`/api/${apiVersion}/offline-bookings`, offlineBookingRoutes);
app.use(`/api/${apiVersion}/screens`, screenRoutes);
app.use(`/api/${apiVersion}/show-timings`, showTimingRoutes);
app.use(`/api/${apiVersion}/seat-layout`, seatLayoutRoutes);
app.use(`/api/${apiVersion}/shows`, showSeatLayoutRoutes);
app.use(`/api/${apiVersion}/movie-ratings`, movieRatingRoutes);
app.use(`/api/${apiVersion}/payments`, paymentRoutes);
app.use(`/api/${apiVersion}/proxy`, proxyRoutes);
// Non-versioned alias for proxy to avoid 404s from older clients
app.use(`/proxy`, proxyRoutes);
app.use(`/api/${apiVersion}/analytics`, analyticsRoutes);
app.use(`/api/${apiVersion}/admin`, adminRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'BookNView API Server',
    version: '1.0.0',
    documentation: '/api/docs',
    health: '/health'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Error handling middleware
app.use(errorHandler);

// MongoDB connection
const connectDB = async () => {
  try {
    const mongoURI = process.env.NODE_ENV === 'test' 
      ? process.env.MONGODB_TEST_URI 
      : (process.env.MONGODB_URI || process.env.MONGO_URI);
    
    await mongoose.connect(mongoURI);
    
    console.log(`MongoDB connected: ${mongoose.connection.host}`);
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Start server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    
    // Create HTTP server
    const server = http.createServer(app);
    
    // Initialize Socket.IO
    const io = new Server(server, {
      cors: {
        origin: [
          "http://localhost:5173",
          "https://booknview.vercel.app"
        ],
        methods: ["GET", "POST"],
        credentials: true
      }
    });
    

    // Socket.IO connection handling
    io.on('connection', (socket) => {
      console.log(`🔌 Client connected: ${socket.id}`);
      
      // Join room for specific screen/show
      socket.on('join-show', (data) => {
        const { screenId, bookingDate, showtime } = data;
        const roomName = `show-${screenId}-${bookingDate}-${showtime}`;
        socket.join(roomName);
        console.log(`📺 Client ${socket.id} joined room: ${roomName}`);
      });

      // Leave room
      socket.on('leave-show', (data) => {
        const { screenId, bookingDate, showtime } = data;
        const roomName = `show-${screenId}-${bookingDate}-${showtime}`;
        socket.leave(roomName);
        console.log(`📺 Client ${socket.id} left room: ${roomName}`);
      });

      socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
      });
    });

    // Make io available globally
    app.set('io', io);
    
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📱 Environment: ${process.env.NODE_ENV}`);
      console.log(`🔗 API Base URL: http://localhost:${PORT}/api/${apiVersion}`);
      console.log(`💾 MongoDB: ${process.env.MONGODB_URI}`);
      console.log(`🔌 Socket.IO server initialized`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully');
      server.close(() => {
        console.log('Process terminated');
        mongoose.connection.close();
      });
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Only start server if this file is run directly
if (require.main === module) {
  startServer();
  
  // Schedule cleanup job to run daily at 2 AM
  const scheduleCleanup = () => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(2, 0, 0, 0); // 2:00 AM
    
    const msUntilCleanup = tomorrow.getTime() - now.getTime();
    
    setTimeout(() => {
      console.log('Running scheduled cleanup of past shows...');
      cleanupPastShows();
      
      // Schedule next cleanup (24 hours later)
      setInterval(() => {
        console.log('Running scheduled cleanup of past shows...');
        cleanupPastShows();
      }, 24 * 60 * 60 * 1000); // 24 hours
    }, msUntilCleanup);
    
    console.log(`Cleanup job scheduled to run at ${tomorrow.toISOString()}`);
  };
  
  // Start cleanup scheduler
  scheduleCleanup();
}

module.exports = app;
