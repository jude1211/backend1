const mongoose = require('mongoose');

const SeatSchema = new mongoose.Schema({
  rowLabel: { type: String, required: true },
  number: { type: Number, required: true },
  x: { type: Number, default: 0 }, // X position for drag-and-drop
  y: { type: Number, default: 0 }, // Y position for drag-and-drop
  className: { type: String, required: true },
  price: { type: Number, required: true },
  color: { type: String },
  tier: { type: String, enum: ['Base', 'Premium', 'VIP'], default: 'Base' }, // Seat tier for organization
  status: { type: String, enum: ['available', 'booked', 'blocked', 'deleted'], default: 'available' },
  isActive: { type: Boolean, default: true }, // false when seat is deleted
  originalRow: { type: String }, // Original row before any moves
  originalNumber: { type: Number }, // Original number before any moves
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { _id: false });

const SeatClassSchema = new mongoose.Schema({
  className: { type: String, required: true },
  price: { type: Number, required: true },
  color: { type: String },
  tier: { type: String, enum: ['Base', 'Premium', 'VIP'], default: 'Base' },
  rows: { type: String, required: true } // e.g., "A-C"
}, { _id: false });

const ScreenLayoutSchema = new mongoose.Schema({
  screenId: { type: String, required: true, index: true },
  theatreId: { type: mongoose.Schema.Types.ObjectId, ref: 'Theatre' },
  screenName: { type: String },
  meta: {
    rows: { type: Number, required: true },
    columns: { type: Number, required: true },
    aisles: { type: [Number], default: [] }
  },
  seatClasses: { type: [SeatClassSchema], default: [] },
  seats: { type: [SeatSchema], default: [] },
  updatedBy: { type: String },
  updatedAt: { type: Date, default: Date.now }
});

ScreenLayoutSchema.index({ screenId: 1 }, { unique: true });

module.exports = mongoose.model('ScreenLayout', ScreenLayoutSchema);

