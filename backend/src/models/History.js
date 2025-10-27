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
    enum: ['Diabetes', 'Pneumonia', 'Hypertension', 'Unknown'],
    default: 'Unknown'
  },
  predictions: [{
    no: Number,
    patientId: String,
    risk: {
      type: String,
      enum: ['High', 'Medium', 'Low']
    },
    probability: Number,
    riskScore: Number,
    reasons: [String],
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
  // Add unique upload identifier
  uploadId: {
    type: String,
    unique: true,
    sparse: true // Allows null values but ensures uniqueness when set
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound index to prevent duplicate uploads
historySchema.index({ userId: 1, fileName: 1, createdAt: 1 }, { unique: true });

// Indexes for faster queries
historySchema.index({ userId: 1, createdAt: -1 });
historySchema.index({ disease: 1 });
historySchema.index({ status: 1 });

// Virtual for upload timestamp
historySchema.virtual('timestamp').get(function() {
  return this.createdAt.toISOString();
});

const History = mongoose.model('History', historySchema);

export default History;