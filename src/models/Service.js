const mongoose = require('mongoose');

/**
 * Services are user-editable labels (e.g. "Income Tax", "GST", "MCA",
 * "FSSAI", "Email", "Banking") — nothing is hardcoded. Admins/staff can
 * add new ones freely from the extension or dashboard.
 */
const serviceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 500 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Service', serviceSchema);
