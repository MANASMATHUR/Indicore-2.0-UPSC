import mongoose from 'mongoose';

const questionAnswerSchema = new mongoose.Schema({
  question: { type: String, required: true },
  answer: String,
  questionType: { type: String, enum: ['personality', 'current_affairs', 'situational', 'technical'], default: 'personality' },
  timeSpent: Number, // in seconds
  feedback: {
    strengths: [String],
    improvements: [String],
    score: { type: Number, min: 0, max: 10 }
  }
});

const interviewSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sessionName: { type: String, default: 'Interview Session' },
  examType: { type: String, enum: ['UPSC', 'PCS', 'SSC'], default: 'UPSC' },
  questions: [questionAnswerSchema],
  totalQuestions: { type: Number, default: 0 },
  averageScore: { type: Number, default: 0 },
  overallFeedback: {
    communication: { type: Number, min: 0, max: 10 },
    knowledge: { type: Number, min: 0, max: 10 },
    confidence: { type: Number, min: 0, max: 10 },
    clarity: { type: Number, min: 0, max: 10 },
    suggestions: [String]
  },
  personalityTest: {
    answers: [{
      question: String,
      answer: String,
      category: String
    }],
    traits: [{
      trait: String,
      score: Number
    }]
  },
  startedAt: { type: Date, default: Date.now },
  completedAt: Date,
  duration: Number // in seconds
}, { timestamps: true });

interviewSessionSchema.index({ userId: 1, completedAt: -1 });

export default mongoose.models.InterviewSession || mongoose.model('InterviewSession', interviewSessionSchema);

