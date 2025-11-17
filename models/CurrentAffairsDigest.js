import mongoose from 'mongoose';

const newsItemSchema = new mongoose.Schema({
  title: { type: String, required: true },
  summary: String,
  source: String,
  date: Date,
  category: String,
  tags: [String],
  relevance: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
  examRelevance: [String] // ['UPSC', 'PCS', 'SSC']
});

const currentAffairsDigestSchema = new mongoose.Schema({
  title: { type: String, required: true },
  period: { type: String, enum: ['daily', 'weekly', 'monthly'], required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  language: { type: String, default: 'en' }, // Store language for proper caching
  newsItems: [newsItemSchema],
  categories: [{
    name: String,
    items: [newsItemSchema],
    count: Number
  }],
  summary: String,
  keyHighlights: [String],
  examRelevance: {
    upsc: [String],
    pcs: [String],
    ssc: [String]
  },
  generatedAt: { type: Date, default: Date.now },
  isPublished: { type: Boolean, default: false }
}, { timestamps: true });

currentAffairsDigestSchema.index({ period: 1, startDate: -1 });
currentAffairsDigestSchema.index({ generatedAt: -1 });
currentAffairsDigestSchema.index({ period: 1, startDate: -1, language: 1 }); // Composite index for language-aware caching

export default mongoose.models.CurrentAffairsDigest || mongoose.model('CurrentAffairsDigest', currentAffairsDigestSchema);

