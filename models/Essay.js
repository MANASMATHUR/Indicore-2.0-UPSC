import mongoose from 'mongoose';

const essaySchema = new mongoose.Schema({
  topic: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  content: {
    type: String,
    required: true
  },
  letter: {
    type: String,
    required: true,
    index: true
  },
  wordCount: {
    type: Number,
    default: 0
  },
  language: {
    type: String,
    default: 'en'
  },
  essayType: {
    type: String,
    default: 'general'
  },
  generatedBy: {
    type: String,
    enum: ['perplexity', 'manual', 'preset'],
    default: 'perplexity'
  },
  generatedAt: {
    type: Date,
    default: Date.now
  },
  lastAccessedAt: {
    type: Date,
    default: Date.now
  },
  accessCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Create indexes for better performance
essaySchema.index({ topic: 1 });
essaySchema.index({ letter: 1 });
essaySchema.index({ createdAt: -1 });

// Update lastAccessedAt when essay is accessed
essaySchema.methods.updateAccess = function() {
  this.lastAccessedAt = new Date();
  this.accessCount += 1;
  return this.save();
};

export default mongoose.models.Essay || mongoose.model('Essay', essaySchema);

