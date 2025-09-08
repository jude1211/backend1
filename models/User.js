const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Firebase UID for linking with Firebase Auth (optional for manual signup)
  firebaseUid: {
    type: String,
    unique: true,
    sparse: true // Allows null values while maintaining uniqueness
  },

  // Basic Information
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },

  // Password for manual authentication
  password: {
    type: String,
    required: function() {
      return !this.firebaseUid; // Password required only if not using Firebase
    },
    minlength: 6
  },
  
  displayName: {
    type: String,
    required: true,
    trim: true
  },
  
  firstName: {
    type: String,
    trim: true
  },
  
  lastName: {
    type: String,
    trim: true
  },
  
  // Contact Information
  phone: {
    type: String,
    trim: true
  },
  
  dateOfBirth: {
    type: Date
  },
  
  // Profile Information
  profilePicture: {
    type: String, // URL to profile picture
    default: null
  },
  
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
      enum: ['profile', 'document', 'other'],
      default: 'other'
    }
  }],
  
  // Location Preferences
  preferredCity: {
    type: String,
    default: 'Mumbai',
    enum: ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Kolkata', 'Hyderabad', 'Pune', 'Ahmedabad']
  },
  
  // User Preferences
  preferences: {
    language: {
      type: String,
      default: 'English',
      enum: ['English', 'Hindi', 'Tamil', 'Telugu', 'Bengali', 'Marathi']
    },
    
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      push: {
        type: Boolean,
        default: true
      },
      sms: {
        type: Boolean,
        default: false
      }
    },
    
    newsletter: {
      type: Boolean,
      default: false
    },
    
    theme: {
      type: String,
      default: 'dark',
      enum: ['light', 'dark', 'auto']
    }
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

  // Password Reset Fields
  resetPasswordToken: {
    type: String,
    default: undefined
  },

  resetPasswordExpires: {
    type: Date,
    default: undefined
  },

  // Authentication Provider Info
  authProvider: {
    type: String,
    enum: ['email', 'google', 'facebook'],
    default: 'email'
  },
  
  // Booking Statistics
  totalBookings: {
    type: Number,
    default: 0
  },
  
  totalSpent: {
    type: Number,
    default: 0
  },
  
  // Favorite Theatres and Movies
  favoriteTheatres: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Theatre'
  }],
  
  favoriteMovies: [{
    movieId: String,
    title: String,
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Loyalty Program
  loyaltyPoints: {
    type: Number,
    default: 0
  },
  
  membershipTier: {
    type: String,
    enum: ['bronze', 'silver', 'gold', 'platinum'],
    default: 'bronze'
  },
  
  // Address Information
  addresses: [{
    type: {
      type: String,
      enum: ['home', 'work', 'other'],
      default: 'home'
    },
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: {
      type: String,
      default: 'India'
    },
    isDefault: {
      type: Boolean,
      default: false
    }
  }],
  
  // Payment Methods (stored securely, only metadata)
  paymentMethods: [{
    type: {
      type: String,
      enum: ['card', 'upi', 'wallet', 'netbanking'],
      required: true
    },
    provider: String, // Visa, Mastercard, PayTM, etc.
    lastFour: String, // Last 4 digits for cards
    isDefault: {
      type: Boolean,
      default: false
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Activity Tracking
  lastLoginAt: {
    type: Date,
    default: Date.now
  },
  
  lastActiveAt: {
    type: Date,
    default: Date.now
  },
  
  // Metadata
  metadata: {
    registrationSource: {
      type: String,
      enum: ['web', 'mobile', 'admin'],
      default: 'web'
    },
    
    referralCode: String,
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    
    deviceInfo: {
      userAgent: String,
      platform: String,
      browser: String
    }
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance (removed duplicates)
userSchema.index({ preferredCity: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ lastActiveAt: -1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  if (this.firstName && this.lastName) {
    return `${this.firstName} ${this.lastName}`;
  }
  return this.displayName;
});

// Virtual for age calculation
userSchema.virtual('age').get(function() {
  if (this.dateOfBirth) {
    const today = new Date();
    const birthDate = new Date(this.dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }
  return null;
});

// Instance method to update last active
userSchema.methods.updateLastActive = function() {
  this.lastActiveAt = new Date();
  return this.save();
};

// Instance method to add loyalty points
userSchema.methods.addLoyaltyPoints = function(points) {
  this.loyaltyPoints += points;

  // Update membership tier based on points
  if (this.loyaltyPoints >= 10000) {
    this.membershipTier = 'platinum';
  } else if (this.loyaltyPoints >= 5000) {
    this.membershipTier = 'gold';
  } else if (this.loyaltyPoints >= 1000) {
    this.membershipTier = 'silver';
  }

  return this.save();
};

// Instance method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) {
    return false; // No password set (Firebase user)
  }
  return await bcrypt.compare(candidatePassword, this.password);
};

// Instance method to change password
userSchema.methods.changePassword = async function(newPassword) {
  this.password = newPassword;
  return this.save();
};

// Static method to find by Firebase UID
userSchema.statics.findByFirebaseUid = function(firebaseUid) {
  return this.findOne({ firebaseUid });
};

// Static method to authenticate user with email and password
userSchema.statics.authenticate = async function(email, password) {
  console.log('🔍 Authenticating user:', email);
  const user = await this.findOne({ email: email.toLowerCase() });

  if (!user) {
    console.log('❌ User not found in database:', email);
    throw new Error('User not found');
  }

  console.log('✅ User found in database:', email, '| Auth Provider:', user.authProvider);

  if (!user.password) {
    console.log('❌ User has no password (Google account):', email);
    throw new Error('This account uses Google sign-in. Please sign in with Google.');
  }

  console.log('🔐 Comparing password for user:', email);
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    console.log('❌ Password mismatch for user:', email);
    throw new Error('Incorrect password');
  }

  console.log('✅ Password match successful for user:', email);
  return user;
};

// Pre-save middleware
userSchema.pre('save', async function(next) {
  // Hash password if it's modified and not already hashed
  if (this.isModified('password') && this.password) {
    try {
      const salt = await bcrypt.genSalt(12);
      this.password = await bcrypt.hash(this.password, salt);
    } catch (error) {
      return next(error);
    }
  }

  // Ensure only one default address
  if (this.addresses && this.addresses.length > 0) {
    const defaultAddresses = this.addresses.filter(addr => addr.isDefault);
    if (defaultAddresses.length > 1) {
      // Keep only the first default, set others to false
      this.addresses.forEach((addr, index) => {
        if (index > 0 && addr.isDefault) {
          addr.isDefault = false;
        }
      });
    }
  }

  // Ensure only one default payment method
  if (this.paymentMethods && this.paymentMethods.length > 0) {
    const defaultPayments = this.paymentMethods.filter(pm => pm.isDefault);
    if (defaultPayments.length > 1) {
      this.paymentMethods.forEach((pm, index) => {
        if (index > 0 && pm.isDefault) {
          pm.isDefault = false;
        }
      });
    }
  }

  next();
});

module.exports = mongoose.model('User', userSchema);
