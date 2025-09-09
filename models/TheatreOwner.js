const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const theatreOwnerSchema = new mongoose.Schema({
  // Basic Information
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 50
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  
  // Personal Information
  ownerName: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  
  // Theatre Information
  theatreName: {
    type: String,
    required: true,
    trim: true
  },
  theatreType: {
    type: String,
    required: true,
    enum: ['Single Screen', 'Multiplex', 'Drive-in', 'IMAX', 'Other']
  },
  location: {
    address: String,
    city: String,
    state: String,
    pincode: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  
  // Theatre Details
  screenCount: {
    type: Number,
    required: true,
    min: 1
  },
  seatingCapacity: {
    type: Number,
    required: true,
    min: 1
  },
  
  // Account Status
  isActive: {
    type: Boolean,
    default: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  
  // Application Reference
  applicationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TheatreOwnerApplication',
    required: true
  },
  
  // Account Management
  lastLoginAt: {
    type: Date
  },
  passwordChangedAt: {
    type: Date
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },
  
  // Profile
  profilePicture: {
    type: String
  },
  bio: {
    type: String,
    maxlength: 500
  },
  
  // Business Information
  businessLicense: {
    number: String,
    expiryDate: Date,
    documentUrl: String
  },
  
  // Preferences
  preferences: {
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      sms: {
        type: Boolean,
        default: false
      }
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata'
    }
  },
  
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'theatreowners',
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
theatreOwnerSchema.index({ email: 1 });
theatreOwnerSchema.index({ username: 1 });
theatreOwnerSchema.index({ applicationId: 1 });
theatreOwnerSchema.index({ isActive: 1 });

// Virtual for account lock status
theatreOwnerSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Pre-save middleware to hash password
theatreOwnerSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();
  
  try {
    // Hash password with cost of 12
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-save middleware to update timestamps
theatreOwnerSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Instance method to check password
theatreOwnerSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Instance method to increment login attempts
theatreOwnerSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }
  
  return this.updateOne(updates);
};

// Instance method to reset login attempts
theatreOwnerSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

// Static method to find by credentials
theatreOwnerSchema.statics.findByCredentials = async function(username, password) {
  const owner = await this.findOne({
    $or: [
      { username: username },
      { email: username }
    ],
    isActive: true
  });
  
  if (!owner) {
    throw new Error('Invalid credentials');
  }
  
  if (owner.isLocked) {
    throw new Error('Account is temporarily locked due to too many failed login attempts');
  }
  
  const isMatch = await owner.comparePassword(password);
  
  if (!isMatch) {
    await owner.incLoginAttempts();
    throw new Error('Invalid credentials');
  }
  
  // Reset login attempts on successful login
  if (owner.loginAttempts > 0) {
    await owner.resetLoginAttempts();
  }
  
  // Update last login
  owner.lastLoginAt = new Date();
  await owner.save();
  
  return owner;
};

// Static method to generate username
theatreOwnerSchema.statics.generateUsername = async function(theatreName, ownerName) {
  // Create base username from theatre name
  let baseUsername = theatreName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 15);
  
  if (baseUsername.length < 3) {
    // Fallback to owner name if theatre name is too short
    baseUsername = ownerName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 15);
  }
  
  let username = baseUsername;
  let counter = 1;
  
  // Check if username exists and increment counter if needed
  while (await this.findOne({ username })) {
    username = `${baseUsername}${counter}`;
    counter++;
  }
  
  return username;
};

const TheatreOwner = mongoose.model('TheatreOwner', theatreOwnerSchema);

module.exports = TheatreOwner;
