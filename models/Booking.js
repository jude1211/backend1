const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  // Booking Identification
  bookingId: {
    type: String,
    required: true,
    unique: true
  },

  // User Information
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  firebaseUid: {
    type: String,
    required: true
  },
  
  // Movie Information
  movie: {
    movieId: {
      type: String,
      required: true
    },
    title: {
      type: String,
      required: true
    },
    poster: String,
    genre: [String],
    duration: Number, // in minutes
    rating: String,
    language: String
  },
  
  // Theatre and Show Information
  theatre: {
    theatreId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Theatre',
      required: true
    },
    name: {
      type: String,
      required: true
    },
    location: {
      address: String,
      city: String,
      state: String,
      zipCode: String
    },
    screen: {
      screenNumber: Number,
      screenType: {
        type: String,
        enum: ['2D', '3D', 'IMAX', '4DX', 'Dolby Atmos'],
        default: '2D'
      }
    }
  },
  
  // Show Details
  showtime: {
    date: {
      type: Date,
      required: true
    },
    time: {
      type: String,
      required: true
    },
    showId: String
  },
  
  // Seat Information
  seats: [{
    seatNumber: {
      type: String,
      required: true
    },
    row: String,
    seatType: {
      type: String,
      enum: ['regular', 'premium', 'recliner', 'vip'],
      default: 'regular'
    },
    price: {
      type: Number,
      required: true
    }
  }],
  
  // Snacks and Beverages
  snacks: [{
    itemId: String,
    name: {
      type: String,
      required: true
    },
    category: {
      type: String,
      enum: ['popcorn', 'beverage', 'candy', 'combo', 'food'],
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    unitPrice: {
      type: Number,
      required: true
    },
    totalPrice: {
      type: Number,
      required: true
    },
    size: {
      type: String,
      enum: ['small', 'medium', 'large', 'extra-large']
    }
  }],
  
  // Pricing Information
  pricing: {
    seatTotal: {
      type: Number,
      required: true
    },
    snackTotal: {
      type: Number,
      default: 0
    },
    subtotal: {
      type: Number,
      required: true
    },
    taxes: {
      cgst: Number,
      sgst: Number,
      serviceFee: Number,
      convenienceFee: Number
    },
    discount: {
      amount: {
        type: Number,
        default: 0
      },
      couponCode: String,
      description: String
    },
    totalAmount: {
      type: Number,
      required: true
    }
  },
  
  // Payment Information
  payment: {
    method: {
      type: String,
      enum: ['card', 'upi', 'wallet', 'netbanking', 'cash'],
      required: true
    },
    provider: String, // Razorpay, Stripe, PayTM, etc.
    transactionId: String,
    paymentId: String,
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded', 'partially_refunded'],
      default: 'pending'
    },
    paidAt: Date,
    refundAmount: {
      type: Number,
      default: 0
    },
    refundReason: String,
    refundedAt: Date
  },
  
  // Booking Status
  status: {
    type: String,
    enum: ['confirmed', 'cancelled', 'completed', 'no_show', 'refunded'],
    default: 'confirmed'
  },
  
  // Cancellation Information
  cancellation: {
    cancelledAt: Date,
    reason: String,
    cancelledBy: {
      type: String,
      enum: ['user', 'admin', 'system']
    },
    refundEligible: {
      type: Boolean,
      default: false
    },
    cancellationFee: {
      type: Number,
      default: 0
    }
  },
  
  // Tickets
  tickets: [{
    ticketNumber: {
      type: String,
      unique: true
    },
    qrCode: String,
    downloadUrl: String,
    isUsed: {
      type: Boolean,
      default: false
    },
    usedAt: Date
  }],
  
  // Contact Information (at time of booking)
  contactInfo: {
    email: {
      type: String,
      required: true
    },
    phone: String,
    name: {
      type: String,
      required: true
    }
  },
  
  // Special Requests
  specialRequests: {
    wheelchairAccessible: {
      type: Boolean,
      default: false
    },
    notes: String
  },
  
  // Notifications
  notifications: {
    confirmationSent: {
      type: Boolean,
      default: false
    },
    reminderSent: {
      type: Boolean,
      default: false
    },
    ticketSent: {
      type: Boolean,
      default: false
    }
  },
  
  // Review and Rating
  review: {
    movieRating: {
      type: Number,
      min: 1,
      max: 5
    },
    theatreRating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String,
    reviewedAt: Date
  },
  
  // Metadata
  metadata: {
    source: {
      type: String,
      enum: ['web', 'mobile', 'admin'],
      default: 'web'
    },
    userAgent: String,
    ipAddress: String,
    referrer: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance (removed duplicates)
bookingSchema.index({ user: 1, createdAt: -1 });
bookingSchema.index({ firebaseUid: 1, createdAt: -1 });
bookingSchema.index({ 'payment.status': 1 });

// Virtual for total seats
bookingSchema.virtual('totalSeats').get(function() {
  return this.seats.length;
});

// Virtual for show date formatted
bookingSchema.virtual('formattedShowDate').get(function() {
  return this.showtime.date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
});

// Virtual for booking age in days
bookingSchema.virtual('bookingAge').get(function() {
  const now = new Date();
  const created = new Date(this.createdAt);
  return Math.floor((now - created) / (1000 * 60 * 60 * 24));
});

// Instance method to generate booking ID
bookingSchema.methods.generateBookingId = function() {
  const prefix = 'BK';
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  this.bookingId = `${prefix}${timestamp}${random}`;
  return this.bookingId;
};

// Instance method to calculate total amount
bookingSchema.methods.calculateTotal = function() {
  const seatTotal = this.seats.reduce((sum, seat) => sum + seat.price, 0);
  const snackTotal = this.snacks.reduce((sum, snack) => sum + snack.totalPrice, 0);
  const subtotal = seatTotal + snackTotal;
  
  // Calculate taxes (example rates)
  const cgst = subtotal * 0.09; // 9% CGST
  const sgst = subtotal * 0.09; // 9% SGST
  const serviceFee = subtotal * 0.02; // 2% service fee
  const convenienceFee = 20; // Fixed convenience fee
  
  const totalTaxes = cgst + sgst + serviceFee + convenienceFee;
  const discountAmount = this.pricing.discount.amount || 0;
  
  this.pricing = {
    seatTotal,
    snackTotal,
    subtotal,
    taxes: {
      cgst,
      sgst,
      serviceFee,
      convenienceFee
    },
    discount: this.pricing.discount,
    totalAmount: subtotal + totalTaxes - discountAmount
  };
  
  return this.pricing.totalAmount;
};

// Instance method to check if cancellable
bookingSchema.methods.isCancellable = function() {
  const now = new Date();
  
  // Parse the showtime date and time properly
  let showDateTime;
  try {
    const dateStr = this.showtime.date.toISOString().split('T')[0]; // Convert to YYYY-MM-DD format
    const timeStr = this.showtime.time; // e.g., "7:00 PM"
    
    // Convert time to 24-hour format if needed
    let time24 = timeStr;
    if (timeStr.includes('AM') || timeStr.includes('PM')) {
      const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (timeMatch) {
        let hours = parseInt(timeMatch[1]);
        const minutes = timeMatch[2];
        const period = timeMatch[3].toUpperCase();
        
        if (period === 'PM' && hours !== 12) {
          hours += 12;
        } else if (period === 'AM' && hours === 12) {
          hours = 0;
        }
        
        time24 = `${hours.toString().padStart(2, '0')}:${minutes}`;
      }
    }
    
    // Create the full datetime string
    const dateTimeStr = `${dateStr}T${time24}:00`;
    showDateTime = new Date(dateTimeStr);
    
    if (isNaN(showDateTime.getTime())) {
      // Fallback to just the date if time parsing fails
      showDateTime = new Date(this.showtime.date);
    }
  } catch (error) {
    console.error('Error parsing showtime in isCancellable:', error);
    // Fallback to just the date if parsing fails
    showDateTime = new Date(this.showtime.date);
  }
  
  const hoursUntilShow = (showDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  
  console.log('Backend isCancellable calculation:', {
    bookingId: this.bookingId,
    now: now.toISOString(),
    showDateTime: showDateTime.toISOString(),
    hoursUntilShow: hoursUntilShow,
    canCancel: this.status === 'confirmed' && hoursUntilShow > 2,
    status: this.status
  });
  
  return this.status === 'confirmed' && hoursUntilShow > 2; // Can cancel up to 2 hours before show
};

// Static method to find user bookings
bookingSchema.statics.findUserBookings = function(firebaseUid, options = {}) {
  const query = { firebaseUid };
  
  if (options.status) {
    query.status = options.status;
  }
  
  return this.find(query)
    .populate('user', 'displayName email phone')
    .sort({ createdAt: -1 })
    .limit(options.limit || 50);
};

// Pre-save middleware
bookingSchema.pre('save', function(next) {
  // Generate booking ID if not exists
  if (!this.bookingId) {
    this.generateBookingId();
  }
  
  // Calculate total if not set
  if (!this.pricing.totalAmount) {
    this.calculateTotal();
  }
  
  // Generate ticket numbers
  if (this.seats.length > 0 && this.tickets.length === 0) {
    this.tickets = this.seats.map((seat, index) => ({
      ticketNumber: `${this.bookingId}-${index + 1}`,
      qrCode: `${this.bookingId}-${seat.seatNumber}`,
      downloadUrl: null,
      isUsed: false
    }));
  }
  
  next();
});

module.exports = mongoose.model('Booking', bookingSchema);
