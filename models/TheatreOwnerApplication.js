const mongoose = require('mongoose');

const theatreOwnerApplicationSchema = new mongoose.Schema(
  {
    ownerName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },

    theatreName: { type: String, required: true, trim: true },
    theatreType: { type: String, required: true, trim: true },
    locationText: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },

    screenCount: { type: String, required: true },
    seatingCapacity: { type: String, required: true },
    screens: [{
      screenNumber: { type: Number, required: true },
      seatingCapacity: { type: String, required: true },
      seatLayout: { type: String, required: true },
      baseTicketPrice: { type: String, required: true },
      premiumPrice: { type: String, required: true },
      vipPrice: { type: String, required: true }
    }],
    internetConnectivity: { type: String, required: true },

    documents: {
      businessLicense: [{ fileName: String, fileType: String, fileSize: Number, url: String }],
      nocPermission: [{ fileName: String, fileType: String, fileSize: Number, url: String }],
      seatingLayout: [{ fileName: String, fileType: String, fileSize: Number, url: String }],
      ticketPricing: [{ fileName: String, fileType: String, fileSize: Number, url: String }]
    },

    termsAccepted: { type: Boolean, required: true },

    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },

    reviewNotes: { type: String },
    reviewedAt: { type: Date },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  {
    timestamps: true,
    collection: 'theatreownerapplications'
  }
);

theatreOwnerApplicationSchema.index({ email: 1, theatreName: 1 });

module.exports = mongoose.model('TheatreOwnerApplication', theatreOwnerApplicationSchema);

