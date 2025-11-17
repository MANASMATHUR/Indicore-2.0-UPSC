import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  googleId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  name: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true 
  },
  picture: String,
  lastLogin: {
    type: Date,
    default: Date.now
  },
  preferences: {
    language: {
      type: String,
      default: 'en'
    },
    model: {
      type: String,
      default: 'sonar-pro'
    },
    systemPrompt: {
      type: String,
      default: 'You are a helpful Multilingual AI assistant. Your name is Indicore-Ai. Provide accurate, detailed, and well-structured responses.'
    }
  },
  memory: {
    totalQuestions: {
      type: Number,
      default: 0
    },
    sessionQuestions: {
      type: Number,
      default: 0
    },
    lastSessionStart: {
      type: Date,
      default: Date.now
    }
  },
  profile: {
    cgpa: {
      type: Number,
      default: null
    },
    university: {
      type: String,
      default: null
    },
    degree: {
      type: String,
      default: null
    },
    year: {
      type: String,
      default: null
    },
    targetExam: {
      type: String,
      default: null
    },
    examYear: {
      type: String,
      default: null
    },
    studyPreferences: {
      type: String,
      default: null
    },
    strengths: {
      type: [String],
      default: []
    },
    weaknesses: {
      type: [String],
      default: []
    },
    facts: {
      type: [String],
      default: []
    },
    conversationSummaries: [{
      chatId: String,
      summary: String,
      keyPoints: [String],
      timestamp: Date
    }],
    preferences: {
      type: Map,
      of: String,
      default: {}
    },
    importantDates: [{
      description: String,
      date: Date,
      type: String
    }],
    goals: {
      type: [String],
      default: []
    },
    customInfo: {
      type: Map,
      of: String,
      default: {}
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  }
}, { 
  timestamps: true 
});

userSchema.index({ email: 1 });
userSchema.index({ googleId: 1 });

export default mongoose.models.User || mongoose.model('User', userSchema);
