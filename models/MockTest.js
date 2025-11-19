import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  questionType: { type: String, enum: ['mcq', 'subjective'], default: 'mcq' },
  options: [String], // Only for MCQ questions
  correctAnswer: { type: String, required: function() { return this.questionType === 'mcq'; } }, // Required only for MCQ
  wordLimit: { type: Number }, // For subjective questions (e.g., 150, 250 words)
  explanation: String,
  subject: String,
  topic: String,
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  marks: { type: Number, default: 1 },
  negativeMarks: { type: Number, default: 0.33 } // Only for MCQ
});

const mockTestSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  examType: { type: String, enum: ['UPSC', 'PCS', 'SSC'], required: true },
  paperType: { type: String, enum: ['Prelims', 'Mains', 'General'], default: 'Prelims' },
  subject: String,
  duration: { type: Number, required: true }, // in minutes
  totalQuestions: { type: Number, required: true },
  totalMarks: { type: Number, required: true },
  questions: [questionSchema],
  blueprint: {
    requestedMix: { type: mongoose.Schema.Types.Mixed },
    appliedTargets: { type: mongoose.Schema.Types.Mixed },
    subjectDistribution: { type: mongoose.Schema.Types.Mixed },
    sourceDistribution: { type: mongoose.Schema.Types.Mixed }
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isPublic: { type: Boolean, default: false },
  tags: [String],
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

mockTestSchema.index({ examType: 1, paperType: 1 });
mockTestSchema.index({ createdAt: -1 });

export default mongoose.models.MockTest || mongoose.model('MockTest', mockTestSchema);

