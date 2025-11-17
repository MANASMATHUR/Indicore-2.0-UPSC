import mongoose from 'mongoose';

const formulaItemSchema = new mongoose.Schema({
  formula: { type: String, required: true },
  description: String,
  variables: [{
    symbol: String,
    meaning: String
  }],
  example: String,
  subject: String,
  topic: String
});

const conceptMapNodeSchema = new mongoose.Schema({
  id: String,
  label: String,
  type: String,
  description: String,
  connections: [String]
});

const formulaSheetSchema = new mongoose.Schema({
  title: { type: String, required: true },
  subject: { type: String, required: true },
  topic: String,
  type: { type: String, enum: ['formula', 'concept_map', 'quick_reference'], required: true },
  content: {
    formulas: [formulaItemSchema],
    conceptMap: {
      nodes: [conceptMapNodeSchema],
      edges: [{
        from: String,
        to: String,
        label: String
      }]
    },
    quickReference: {
      sections: [{
        title: String,
        content: String,
        items: [String]
      }]
    }
  },
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isPublic: { type: Boolean, default: false },
  tags: [String],
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

formulaSheetSchema.index({ subject: 1, topic: 1 });
formulaSheetSchema.index({ createdAt: -1 });

export default mongoose.models.FormulaSheet || mongoose.model('FormulaSheet', formulaSheetSchema);

