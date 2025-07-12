const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // UUID
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String },
  type: { type: String },
  period: { type: String },
  startDate: { type: Date },
  endDate: { type: Date },
  status: { type: String, default: 'completed' },
  format: { type: String },
  fileUrl: { type: String },
  data: { type: mongoose.Schema.Types.Mixed },
  metadata: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

ReportSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Report', ReportSchema);
