const mongoose = require('mongoose');

const ShowTimingSchema = new mongoose.Schema({
  theatreOwnerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'TheatreOwner', 
    required: true, 
    index: true 
  },
  type: { 
    type: String, 
    enum: ['weekday', 'weekend', 'special'], 
    required: true 
  },
  timings: { 
    type: [String], 
    required: true,
    default: []
  },
  // For special showtimes - specific date
  specialDate: { 
    type: Date,
    required: function() { return this.type === 'special'; }
  },
  // For special showtimes - description
  description: { 
    type: String,
    default: ''
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Compound index to ensure one timing per type per owner (except special which can have multiple)
ShowTimingSchema.index({ theatreOwnerId: 1, type: 1 }, { 
  unique: true, 
  partialFilterExpression: { type: { $in: ['weekday', 'weekend'] } }
});

// For special showtimes, allow multiple per owner but unique per date
ShowTimingSchema.index({ theatreOwnerId: 1, specialDate: 1 }, { 
  unique: true, 
  partialFilterExpression: { type: 'special' }
});

ShowTimingSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('ShowTiming', ShowTimingSchema);
