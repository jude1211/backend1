const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true
  },
  otp: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['verification', 'password_reset'],
    required: true
  },
  isUsed: {
    type: Boolean,
    default: false
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 10 * 60 * 1000) // 10 minutes from now
  }
}, {
  timestamps: true
});

// Index for automatic deletion of expired documents
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Static method to generate OTP
otpSchema.statics.generateOTP = function() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
};

// Static method to create and save OTP
otpSchema.statics.createOTP = async function(email, type = 'verification') {
  const emailService = require('../services/emailService');
  
  // Delete any existing OTPs for this email and type
  await this.deleteMany({ email: email.toLowerCase(), type, isUsed: false });
  
  // Generate new OTP
  const otpCode = this.generateOTP();
  
  // Create new OTP record
  const otp = new this({
    email: email.toLowerCase(),
    otp: otpCode,
    type,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
  });
  
  await otp.save();
  
  // Send email
  const emailResult = await emailService.sendOTP(email, otpCode, type);
  
  return {
    success: true,
    expiresAt: otp.expiresAt,
    emailResult
  };
};

// Static method to verify OTP
otpSchema.statics.verifyOTP = async function(email, otpCode, type = 'verification') {
  const otp = await this.findOne({
    email: email.toLowerCase(),
    otp: otpCode,
    type,
    isUsed: false,
    expiresAt: { $gt: new Date() }
  });
  
  if (!otp) {
    return {
      success: false,
      message: 'Invalid or expired OTP'
    };
  }
  
  // Mark OTP as used
  otp.isUsed = true;
  await otp.save();
  
  return {
    success: true,
    message: 'OTP verified successfully'
  };
};

module.exports = mongoose.model('OTP', otpSchema);
