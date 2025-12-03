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
  statistics: {
    totalStudyTime: {
      type: Number,
      default: 0 // in minutes
    },
    totalQuestions: {
      type: Number,
      default: 0
    },
    totalChats: {
      type: Number,
      default: 0
    },
    topicsCovered: [{
      topic: String,
      count: Number,
      lastStudied: Date
    }],
    studyStreak: {
      type: Number,
      default: 0
    },
    lastStudyDate: Date,
    weeklyStats: [{
      week: String, // YYYY-WW format
      studyTime: Number,
      questions: Number,
      chats: Number
    }]
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
      title: String,
      summary: String,
      keyPoints: [String],
      userMessage: String,
      assistantSummary: String,
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
    },
    // Personalization fields
    personalization: {
      // Communication style preferences
      communicationStyle: {
        tone: {
          type: String,
          enum: ['formal', 'casual', 'friendly', 'professional', 'encouraging']
        },
        responseLength: {
          type: String,
          enum: ['concise', 'moderate', 'detailed', 'comprehensive']
        },
        prefersExamples: {
          type: Boolean,
          default: null
        },
        prefersAnalogies: {
          type: Boolean,
          default: null
        },
        prefersStepByStep: {
          type: Boolean,
          default: null
        }
      },
      // Topic interests and frequency
      topicInterests: [{
        topic: String,
        category: String, // e.g., 'Polity', 'History', 'Geography', 'Economics', 'Science', 'Environment'
        frequency: {
          type: Number,
          default: 1
        },
        lastAsked: Date,
        engagementScore: {
          type: Number,
          default: 0 // Based on follow-up questions, time spent, etc.
        }
      }],
      // Study patterns
      studyPatterns: {
        preferredTimeOfDay: [{
          hour: Number, // 0-23
          frequency: Number
        }],
        averageSessionLength: {
          type: Number, // in minutes
          default: null
        },
        typicalQuestionTypes: [{
          type: String, // e.g., 'concept_explanation', 'pyq_solving', 'answer_writing', 'current_affairs'
          frequency: Number
        }]
      },
      // Interaction patterns
      interactionPatterns: {
        averageMessagesPerSession: {
          type: Number,
          default: 0
        },
        followUpFrequency: {
          type: Number,
          default: 0 // How often user asks follow-up questions
        },
        clarificationFrequency: {
          type: Number,
          default: 0 // How often user asks for clarification
        },
        bookmarkFrequency: {
          type: Number,
          default: 0 // How often user bookmarks responses
        }
      },
      // Learning preferences
      learningPreferences: {
        preferredFormat: {
          type: String,
          enum: ['structured', 'conversational', 'bullet_points', 'paragraphs', 'mixed']
        },
        needsMoreContext: {
          type: Boolean,
          default: null
        },
        prefersVisualAids: {
          type: Boolean,
          default: null
        },
        difficultyLevel: {
          type: String,
          enum: ['beginner', 'intermediate', 'advanced']
        }
      },
      // Personalized recommendations
      recommendations: {
        suggestedTopics: [{
          topic: String,
          reason: String,
          priority: Number,
          suggestedAt: Date
        }],
        weakAreas: [{
          topic: String,
          identifiedAt: Date,
          improvementSuggestions: [String]
        }]
      },
      // Last updated timestamp for personalization
      lastAnalyzed: {
        type: Date,
        default: Date.now
      }
    }
  }
}, {
  timestamps: true
});

userSchema.index({ email: 1 });
userSchema.index({ googleId: 1 });

export default mongoose.models.User || mongoose.model('User', userSchema);
