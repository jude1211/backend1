const mongoose = require('mongoose');

const movieRatingSchema = new mongoose.Schema({
  movieId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Movie',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 10,
    validate: {
      validator: Number.isInteger,
      message: 'Rating must be an integer between 1 and 10'
    }
  },
  review: {
    type: String,
    maxlength: 500,
    trim: true
  },
  bookingId: {
    type: String,
    required: false,
    index: true
  }
}, {
  timestamps: true
});

// Compound index to ensure one rating per user per movie
movieRatingSchema.index({ movieId: 1, userId: 1 }, { unique: true });

// Static method to get average rating for a movie
movieRatingSchema.statics.getAverageRating = async function(movieId) {
  const result = await this.aggregate([
    { $match: { movieId: new mongoose.Types.ObjectId(movieId) } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalRatings: { $sum: 1 }
      }
    }
  ]);
  
  return result.length > 0 ? {
    averageRating: Math.round(result[0].averageRating * 10) / 10, // Round to 1 decimal
    totalRatings: result[0].totalRatings
  } : {
    averageRating: 0,
    totalRatings: 0
  };
};

// Static method to get user's rating for a movie
movieRatingSchema.statics.getUserRating = async function(movieId, userId) {
  return await this.findOne({ movieId, userId });
};

module.exports = mongoose.model('MovieRating', movieRatingSchema);
