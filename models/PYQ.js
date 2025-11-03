import mongoose from 'mongoose';

const PyqSchema = new mongoose.Schema({
  exam: { type: String, index: true }, // e.g., 'UPSC', 'PCS', 'SSC'
  level: { type: String }, // e.g., 'Prelims', 'Mains'
  paper: { type: String }, // e.g., 'GS-3', 'GS-2'
  year: { type: Number, index: true },
  question: { type: String, required: true },
  topicTags: { type: [String], index: true },
  sourceLink: { type: String },
  verified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

// Text index for theme/topic search
PyqSchema.index({ question: 'text', topicTags: 'text' });

export default mongoose.models.PYQ || mongoose.model('PYQ', PyqSchema);


