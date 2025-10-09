const mongoose = require('mongoose');

const ScreenShowSchema = new mongoose.Schema({
  theatreOwnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'TheatreOwner', index: true },
  theatreId: { type: mongoose.Schema.Types.ObjectId, ref: 'Theatre' },
  screenId: { type: String, required: true, index: true },
  movieId: { type: mongoose.Schema.Types.ObjectId, ref: 'Movie', required: true },
  // ISO date string YYYY-MM-DD for which these showtimes apply
  bookingDate: { type: String, required: true, index: true },
  showtimes: { type: [String], default: [] },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Ensure one document per screen, movie and date
ScreenShowSchema.index({ screenId: 1, bookingDate: 1, movieId: 1 }, { unique: true });
ScreenShowSchema.index({ screenId: 1, bookingDate: 1 });

ScreenShowSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('ScreenShow', ScreenShowSchema);

