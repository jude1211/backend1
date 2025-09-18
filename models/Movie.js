const mongoose = require('mongoose');

const MovieSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    genre: { type: String, required: true, trim: true },
    duration: { type: String, required: true, trim: true }, // e.g., "2h 30m"
    posterUrl: { type: String, trim: true },
    status: { type: String, enum: ['active', 'inactive', 'coming_soon'], default: 'active' },
    showtimes: { type: [String], default: [] },
    format: { type: String, enum: ['2D', '3D'], default: '2D' },
    description: { type: String, default: '' },
    director: { type: String, default: '' },
    cast: { type: [String], default: [] },
    // Store actual spoken language separate from MongoDB text-index override
    movieLanguage: { type: String, default: 'English' },
    // Keep a generic 'language' field for compatibility but default to english to avoid Mongo text index override issues
    language: { type: String, default: 'english' },
    releaseDate: { type: String, default: '' },

    // Ownership/relations
    theatreOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'TheatreOwner', index: true },
    theatre: { type: mongoose.Schema.Types.ObjectId, ref: 'Theatre' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    
    // Additional fields for better management
    isActive: { type: Boolean, default: true },
    addedBy: { type: String, enum: ['theatre_owner', 'admin'], default: 'theatre_owner' },

    // Ratings from customers would be stored elsewhere; keep aggregate here if needed
    aggregateRating: { type: Number, default: 0 },
    ratingsCount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

MovieSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Movie', MovieSchema);

