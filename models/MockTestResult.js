import mongoose from 'mongoose';

const answerSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
  questionIndex: { type: Number },
  questionType: { type: String, enum: ['mcq', 'subjective'], default: 'mcq' },
  selectedAnswer: String,
  textAnswer: String,
  correctAnswer: String,
  isCorrect: Boolean,
  timeSpent: Number, // in seconds
  marksObtained: Number
});

const mockTestResultSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  testId: { type: mongoose.Schema.Types.ObjectId, ref: 'MockTest', required: true },
  testTitle: String,
  examType: String,
  paperType: String,
  answers: [answerSchema],
  totalQuestions: { type: Number, required: true },
  correctAnswers: { type: Number, default: 0 },
  wrongAnswers: { type: Number, default: 0 },
  unattempted: { type: Number, default: 0 },
  marksObtained: { type: Number, default: 0 },
  totalMarks: { type: Number, required: true },
  percentage: { type: Number, default: 0 },
  timeSpent: { type: Number, default: 0 }, // in seconds
  completedAt: { type: Date, default: Date.now },
  subjectWisePerformance: [{
    subject: String,
    total: Number,
    correct: Number,
    wrong: Number,
    marks: Number
  }],
  topicWisePerformance: [{
    topic: String,
    total: Number,
    correct: Number,
    wrong: Number,
    marks: Number
  }],
  startedAt: { type: Date, default: Date.now },
  finishedAt: Date,
  detailedAnalysis: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  analyzedAt: Date
}, { timestamps: true });

mockTestResultSchema.index({ userId: 1, completedAt: -1 });
mockTestResultSchema.index({ testId: 1 });

export default mongoose.models.MockTestResult || mongoose.model('MockTestResult', mockTestResultSchema);

