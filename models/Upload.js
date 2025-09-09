const mongoose = require('mongoose');

const UploadSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true, index: true },
    fileName: { type: String, required: true },
    fileType: { type: String, required: true },
    fileSize: { type: Number },
    format: { type: String },
    width: { type: Number },
    height: { type: Number },
    folder: { type: String },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    metadata: { type: Object, default: {} }
  },
  { timestamps: true }
);

UploadSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Upload', UploadSchema);

