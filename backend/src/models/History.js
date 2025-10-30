import mongoose from 'mongoose';

const historySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Admin',
    index: true
  },
  fileName: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    default: 0
  },
  uploadDate: {
    type: String,
    required: true
  },
  uploadTime: {
    type: String,
    required: true
  },
  recordCount: {
    type: Number,
    required: true,
    default: 0
  },
  highRiskCount: {
    type: Number,
    required: true,
    default: 0
  },
  mediumRiskCount: {
    type: Number,
    required: true,
    default: 0
  },
  lowRiskCount: {
    type: Number,
    required: true,
    default: 0
  },
  disease: {
    type: String,
    default: 'Unknown'
  },
  sessionId: {
    type: String,
    index: true
  },
  pdfDownloadUrl: {
    type: String
  },
  excelDownloadUrl: {
    type: String
  },
  predictions: [{
    no: Number,
    patientId: String,
    patientName: String,
    risk: {
      type: String,
      enum: ['High', 'Medium', 'Low']
    },
    probability: Number,
    riskScore: Number,
    reasons: [String],
    interpretation: String,
    recommendation: String,
    predictedClass: Number
  }],
  status: {
    type: String,
    enum: ['completed', 'processing', 'failed'],
    default: 'completed'
  },
  uploadedBy: {
    name: String,
    email: String,
    role: String
  },
  uploadId: {
    type: String,
    unique: true,
    sparse: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});


historySchema.index({ userId: 1, createdAt: -1 });
historySchema.index({ disease: 1 });
historySchema.index({ status: 1 });
historySchema.index({ uploadedBy: 1 });

// Virtual for upload timestamp
historySchema.virtual('timestamp').get(function() {
  return this.createdAt.toISOString();
});

const History = mongoose.model('History', historySchema);

export default History;