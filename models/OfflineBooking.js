const mongoose = require('mongoose');

const offlineBookingSchema = new mongoose.Schema({
  // Booking Identification
  bookingId: {
    type: String,
    required: true,
    unique: true
  },

  // Theatre Owner Information
  theatreOwner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TheatreOwner',
    required: true
  },

  // Customer Information (for offline bookings)
  customer: {
    name: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: false
    },
    idProof: {
      type: String,
      enum: ['aadhar', 'pan', 'driving_license', 'passport', 'voter_id'],
      required: true
    },
    idNumber: {
      type: String,
      required: true
    }
  },
  
  // Movie Information
  movie: {
    title: {
      type: String,
      required: true
    },
    poster: String,
    genre: [String],
    duration: Number, // in minutes
    rating: String,
    language: String,
    year: Number
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
    screen: {
      screenNumber: {
        type: Number,
        required: true
      },
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
    }
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
      type: {
        type: String,
        enum: ['percentage', 'fixed'],
        default: 'fixed'
      },
      reason: String
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
      enum: ['cash', 'card', 'upi', 'netbanking', 'wallet'],
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'completed'
    },
    transactionId: String,
    paidAmount: {
      type: Number,
      required: true
    },
    changeGiven: {
      type: Number,
      default: 0
    },
    paymentDate: {
      type: Date,
      default: Date.now
    }
  },
  
  // Booking Status
  status: {
    type: String,
    enum: ['confirmed', 'cancelled', 'completed', 'no_show'],
    default: 'confirmed'
  },
  
  // Booking Type
  bookingType: {
    type: String,
    enum: ['online', 'offline'],
    default: 'offline'
  },
  
  // Additional Information
  notes: String,
  cancellationReason: String,
  
  // Timestamps
  bookingDate: {
    type: Date,
    default: Date.now
  },
  showDate: {
    type: Date,
    required: true
  },
  cancelledAt: Date,
  completedAt: Date
}, {
  timestamps: true,
  collection: 'offlinebookings',
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Generate unique booking ID
offlineBookingSchema.pre('save', async function(next) {
  if (!this.bookingId) {
    const count = await this.constructor.countDocuments();
    this.bookingId = `OFF${Date.now().toString().slice(-8)}${(count + 1).toString().padStart(4, '0')}`;
  }
  next();
});

// Calculate total amount
offlineBookingSchema.methods.calculateTotal = function() {
  // Calculate seat total
  this.pricing.seatTotal = this.seats.reduce((total, seat) => total + seat.price, 0);
  
  // Calculate snack total
  this.pricing.snackTotal = this.snacks.reduce((total, snack) => total + snack.totalPrice, 0);
  
  // Calculate subtotal
  this.pricing.subtotal = this.pricing.seatTotal + this.pricing.snackTotal;
  
  // Calculate taxes (simplified calculation)
  const taxRate = 0.18; // 18% GST
  this.pricing.taxes.cgst = Math.round((this.pricing.subtotal * taxRate) / 2);
  this.pricing.taxes.sgst = Math.round((this.pricing.subtotal * taxRate) / 2);
  this.pricing.taxes.serviceFee = Math.round(this.pricing.subtotal * 0.02); // 2% service fee
  this.pricing.taxes.convenienceFee = Math.round(this.pricing.subtotal * 0.01); // 1% convenience fee
  
  // Calculate total amount
  const totalTaxes = this.pricing.taxes.cgst + this.pricing.taxes.sgst + 
                    this.pricing.taxes.serviceFee + this.pricing.taxes.convenienceFee;
  
  this.pricing.totalAmount = this.pricing.subtotal + totalTaxes - this.pricing.discount.amount;
  
  // Set paid amount to total amount for offline bookings
  this.payment.paidAmount = this.pricing.totalAmount;
};

// Virtual for booking summary
offlineBookingSchema.virtual('summary').get(function() {
  return {
    bookingId: this.bookingId,
    customerName: this.customer.name,
    movieTitle: this.movie.title,
    theatreName: this.theatre.name,
    showDate: this.showtime.date,
    showTime: this.showtime.time,
    totalSeats: this.seats.length,
    totalAmount: this.pricing.totalAmount,
    status: this.status
  };
});

// Index for better query performance
offlineBookingSchema.index({ theatreOwner: 1, bookingDate: -1 });
offlineBookingSchema.index({ 'theatre.theatreId': 1, 'showtime.date': 1 });
offlineBookingSchema.index({ bookingId: 1 });
offlineBookingSchema.index({ 'customer.phone': 1 });

module.exports = mongoose.model('OfflineBooking', offlineBookingSchema);