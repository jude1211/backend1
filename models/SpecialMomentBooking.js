const mongoose = require('mongoose');
const { Schema } = mongoose;

const specialMomentBookingSchema = new Schema({
  user:         { type: Schema.Types.ObjectId, ref: 'User', required: true },
  theatre:      { type: Schema.Types.ObjectId, ref: 'Theatre', required: true },
  theatreName:  { type: String, required: true },
  screen:       { type: String, required: true },
  showtime:     { type: Schema.Types.ObjectId, ref: 'ShowTiming' },
  showDate:     { type: String, required: true },   // "2026-03-25"
  showTime:     { type: String, required: true },   // "10:00 AM"
  occasion:     { type: String, enum: ['birthday', 'moment', 'valentine'], required: true },
  templateId:   { type: String, required: true },
  recipientName:{ type: String, required: true },
  senderName:   { type: String, required: true },
  message:      { type: String, maxlength: 300, default: '' },
  mediaUrl:     { type: String, default: '' },
  mediaType:    { type: String, enum: ['image', 'video', 'none'], default: 'none' },
  status:       { type: String, enum: ['pending', 'confirmed', 'cancelled'], default: 'pending' },
  razorpayOrderId:   { type: String },
  razorpayPaymentId: { type: String },
  totalAmount:  { type: Number, required: true },
  bookingId:    { type: String, unique: true },
}, { timestamps: true });

// Auto-generate bookingId before save
specialMomentBookingSchema.pre('save', function (next) {
  if (!this.bookingId) {
    this.bookingId = 'SMB-' + Math.random().toString(36).substr(2, 9).toUpperCase();
  }
  next();
});

module.exports = mongoose.model('SpecialMomentBooking', specialMomentBookingSchema);
