const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    clientCode: { type: String, trim: true, unique: true, sparse: true, maxlength: 40 },
    pan: { type: String, trim: true, uppercase: true, maxlength: 20 },
    gstin: { type: String, trim: true, uppercase: true, maxlength: 20 },
    phone: { type: String, trim: true, maxlength: 30 },
    email: { type: String, trim: true, lowercase: true, maxlength: 200 },
    address: { type: String, trim: true, maxlength: 500 },
    notes: { type: String, trim: true, maxlength: 2000 },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

clientSchema.index({ name: 'text', clientCode: 'text', pan: 'text', gstin: 'text' });

module.exports = mongoose.model('Client', clientSchema);