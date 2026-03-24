const mongoose = require('mongoose');

const snackSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Snack name is required'],
    trim: true
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: 0
  },
  originalPrice: {
    type: Number,
    min: 0
  },
  discountPercent: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  category: {
    type: String,
    enum: ['popcorn', 'beverages', 'nachos', 'combo', 'other'],
    required: true
  },
  image: {
    type: String
  },
  stock: {
    type: Number,
    default: 0,
    min: 0
  },
  reservedStock: {
    type: Number,
    default: 0,
    min: 0
  },
  status: {
    type: String,
    enum: ['available', 'out_of_stock', 'low_stock'],
    default: 'out_of_stock'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true } 
});

// Virtual for available stock
snackSchema.virtual('availableStock').get(function() {
  return Math.max(0, this.stock - this.reservedStock);
});

// Pre-save hook to auto-compute status based on stock
snackSchema.pre('save', function(next) {
  const available = Math.max(0, this.stock - this.reservedStock);
  if (available === 0) {
    this.status = 'out_of_stock';
  } else if (available <= 10) {
    this.status = 'low_stock';
  } else {
    this.status = 'available';
  }
  next();
});

const Snack = mongoose.model('Snack', snackSchema);

module.exports = Snack;
