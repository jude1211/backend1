const mongoose = require('mongoose');

const theatreSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: true,
    trim: true
  },
  
  chain: {
    type: String,
    enum: ['PVR', 'INOX', 'Cinepolis', 'Carnival', 'SPI', 'Miraj', 'Independent'],
    required: true
  },
  
  // Location Information
  location: {
    address: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    zipCode: {
      type: String,
      required: true
    },
    country: {
      type: String,
      default: 'India'
    },
    coordinates: {
      latitude: Number,
      longitude: Number
    },
    landmark: String,
    area: String
  },
  
  // Contact Information
  contact: {
    phone: String,
    email: String,
    website: String
  },
  
  // Screens Information
  screens: [{
    screenNumber: {
      type: Number,
      required: true
    },
    name: String, // Screen 1, IMAX, etc.
    type: {
      type: String,
      enum: ['2D', '3D', 'IMAX', '4DX', 'Dolby Atmos', 'Premium'],
      default: '2D'
    },
    totalSeats: {
      type: Number,
      required: true
    },
    seatLayout: {
      rows: Number,
      seatsPerRow: Number,
      seatMap: [[String]] // 2D array representing seat layout
    },
    seatTypes: [{
      type: {
        type: String,
        enum: ['regular', 'premium', 'recliner', 'vip'],
        required: true
      },
      count: Number,
      basePrice: Number
    }],
    amenities: [String] // ['Dolby Sound', 'Air Conditioning', etc.]
  }],
  
  // Facilities and Amenities
  amenities: {
    parking: {
      available: {
        type: Boolean,
        default: false
      },
      capacity: Number,
      fee: Number
    },
    foodCourt: {
      available: {
        type: Boolean,
        default: false
      },
      vendors: [String]
    },
    restrooms: {
      type: Boolean,
      default: true
    },
    wheelchairAccessible: {
      type: Boolean,
      default: false
    },
    airConditioning: {
      type: Boolean,
      default: true
    },
    wifi: {
      type: Boolean,
      default: false
    },
    atm: {
      type: Boolean,
      default: false
    },
    elevator: {
      type: Boolean,
      default: false
    }
  },
  
  // Operating Information
  operatingHours: {
    monday: {
      open: String,
      close: String,
      closed: {
        type: Boolean,
        default: false
      }
    },
    tuesday: {
      open: String,
      close: String,
      closed: {
        type: Boolean,
        default: false
      }
    },
    wednesday: {
      open: String,
      close: String,
      closed: {
        type: Boolean,
        default: false
      }
    },
    thursday: {
      open: String,
      close: String,
      closed: {
        type: Boolean,
        default: false
      }
    },
    friday: {
      open: String,
      close: String,
      closed: {
        type: Boolean,
        default: false
      }
    },
    saturday: {
      open: String,
      close: String,
      closed: {
        type: Boolean,
        default: false
      }
    },
    sunday: {
      open: String,
      close: String,
      closed: {
        type: Boolean,
        default: false
      }
    }
  },
  
  // Pricing Information
  pricing: {
    basePrice: {
      type: Number,
      required: true
    },
    weekendSurcharge: {
      type: Number,
      default: 0
    },
    holidaySurcharge: {
      type: Number,
      default: 0
    },
    convenienceFee: {
      type: Number,
      default: 20
    }
  },
  
  // Snacks and Beverages
  concessions: [{
    category: {
      type: String,
      enum: ['popcorn', 'beverage', 'candy', 'combo', 'food'],
      required: true
    },
    name: {
      type: String,
      required: true
    },
    description: String,
    price: {
      type: Number,
      required: true
    },
    sizes: [{
      size: {
        type: String,
        enum: ['small', 'medium', 'large', 'extra-large']
      },
      price: Number
    }],
    available: {
      type: Boolean,
      default: true
    },
    image: String
  }],
  
  // Ratings and Reviews
  ratings: {
    overall: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },
    cleanliness: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },
    soundQuality: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },
    seatingComfort: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },
    staff: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },
    totalReviews: {
      type: Number,
      default: 0
    }
  },
  
  // Status and Verification
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance', 'closed'],
    default: 'active'
  },
  
  verified: {
    type: Boolean,
    default: false
  },
  
  // Images
  images: [{
    url: String,
    type: {
      type: String,
      enum: ['exterior', 'interior', 'screen', 'lobby', 'concession']
    },
    caption: String
  }],
  
  // File uploads
  documents: [{
    fileName: {
      type: String,
      required: true
    },
    fileUrl: {
      type: String,
      required: true
    },
    fileType: {
      type: String,
      enum: ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'],
      required: true
    },
    fileSize: {
      type: Number,
      required: true
    },
    publicId: {
      type: String,
      required: true
    },
    uploadDate: {
      type: Date,
      default: Date.now
    },
    category: {
      type: String,
      enum: ['license', 'permit', 'photo', 'other'],
      default: 'other'
    }
  }],
  
  // Social Media and Marketing
  socialMedia: {
    facebook: String,
    twitter: String,
    instagram: String
  },
  
  // Manager/Owner Information
  management: {
    managerName: String,
    managerPhone: String,
    managerEmail: String,
    ownerName: String,
    licenseNumber: String
  },
  
  // Statistics
  statistics: {
    totalBookings: {
      type: Number,
      default: 0
    },
    totalRevenue: {
      type: Number,
      default: 0
    },
    averageOccupancy: {
      type: Number,
      default: 0
    },
    popularMovies: [{
      movieId: String,
      title: String,
      bookings: Number
    }]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
theatreSchema.index({ 'location.city': 1 });
theatreSchema.index({ chain: 1 });
theatreSchema.index({ status: 1 });
theatreSchema.index({ 'location.coordinates': '2dsphere' });

// Virtual for total screens
theatreSchema.virtual('totalScreens').get(function() {
  return this.screens.length;
});

// Virtual for total capacity
theatreSchema.virtual('totalCapacity').get(function() {
  return this.screens.reduce((total, screen) => total + screen.totalSeats, 0);
});

// Virtual for full address
theatreSchema.virtual('fullAddress').get(function() {
  const { address, area, city, state, zipCode } = this.location;
  return `${address}${area ? ', ' + area : ''}, ${city}, ${state} ${zipCode}`;
});

// Instance method to get available showtimes
theatreSchema.methods.getAvailableShowtimes = function(date) {
  // This would typically query a separate Showtime collection
  // For now, return a placeholder
  return [];
};

// Instance method to check if open
theatreSchema.methods.isOpen = function(day = null) {
  const today = day || new Date().toLocaleDateString('en-US', { weekday: 'lowercase' });
  const todayHours = this.operatingHours[today];
  
  if (todayHours && todayHours.closed) {
    return false;
  }
  
  return this.status === 'active' && !todayHours?.closed;
};

// Static method to find nearby theatres
theatreSchema.statics.findNearby = function(latitude, longitude, maxDistance = 10000) {
  return this.find({
    'location.coordinates': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        $maxDistance: maxDistance
      }
    },
    status: 'active'
  });
};

// Static method to find by city
theatreSchema.statics.findByCity = function(city) {
  return this.find({
    'location.city': new RegExp(city, 'i'),
    status: 'active'
  }).sort({ name: 1 });
};

module.exports = mongoose.model('Theatre', theatreSchema);
