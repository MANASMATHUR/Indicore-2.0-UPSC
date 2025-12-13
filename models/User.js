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
    // ChatGPT-style explicit memories
    memories: [{
      content: {
        type: String,
        required: true
      },
      category: {
        type: String,
        enum: ['goal', 'preference', 'study_habit', 'exam', 'subject', 'personal', 'general'],
        default: 'general'
      },
      importance: {
        type: String,
        enum: ['high', 'normal', 'low'],
        default: 'normal'
      },
      savedAt: {
        type: Date,
        default: Date.now
      },
      lastUsed: Date,
      useCount: {
        type: Number,
        default: 0
      }
    }],
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
    },

    // ========== NEW PERSONALIZATION FIELDS ==========

    // Enhanced UI/UX Preferences
    uiPreferences: {
      theme: {
        type: String,
        enum: ['light', 'dark', 'auto'],
        default: 'auto'
      },
      fontSize: {
        type: String,
        enum: ['small', 'medium', 'large'],
        default: 'medium'
      },
      reducedMotion: {
        type: Boolean,
        default: false
      },
      notificationsEnabled: {
        type: Boolean,
        default: true
      },
      soundEnabled: {
        type: Boolean,
        default: false
      },
      compactView: {
        type: Boolean,
        default: false
      }
    },

    // Study Schedule & Reminders
    studySchedule: {
      enabled: {
        type: Boolean,
        default: false
      },
      preferredStudyTime: [{
        day: {
          type: String,
          enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        },
        startTime: String, // HH:MM format
        endTime: String,
        enabled: Boolean
      }],
      dailyGoalMinutes: {
        type: Number,
        default: 120
      },
      reminders: {
        studyReminder: {
          type: Boolean,
          default: false
        },
        reminderTime: String, // HH:MM format
        breakReminder: {
          type: Boolean,
          default: false
        },
        breakIntervalMinutes: {
          type: Number,
          default: 50
        },
        dailyDigest: {
          type: Boolean,
          default: false
        },
        digestTime: String
      }
    },

    // Learning Path & Progress
    learningPath: {
      currentTopics: [{
        subject: String, // GS-1, GS-2, etc.
        topic: String,
        startedAt: Date,
        lastStudied: Date,
        completionPercentage: {
          type: Number,
          default: 0
        },
        status: {
          type: String,
          enum: ['not_started', 'in_progress', 'completed', 'reviewing'],
          default: 'not_started'
        }
      }],
      completedTopics: [{
        subject: String,
        topic: String,
        completedAt: Date,
        masteryLevel: {
          type: String,
          enum: ['basic', 'intermediate', 'advanced'],
          default: 'basic'
        }
      }],
      plannedTopics: [{
        subject: String,
        topic: String,
        priority: {
          type: Number,
          default: 1
        },
        targetDate: Date
      }]
    },

    // Performance Metrics (Enhanced)
    performanceMetrics: {
      overallScore: {
        type: Number,
        default: 0
      }, // 0-100
      subjectWiseScores: [{
        subject: String,
        score: Number,
        questionsAttempted: Number,
        questionsCorrect: Number,
        lastUpdated: Date
      }],
      pyqPerformance: {
        totalAttempted: {
          type: Number,
          default: 0
        },
        totalCorrect: {
          type: Number,
          default: 0
        },
        accuracyRate: {
          type: Number,
          default: 0
        },
        averageTimePerQuestion: {
          type: Number,
          default: 0
        } // in seconds
      },
      mockTestPerformance: {
        totalTests: {
          type: Number,
          default: 0
        },
        averageScore: {
          type: Number,
          default: 0
        },
        bestScore: {
          type: Number,
          default: 0
        },
        improvementTrend: {
          type: String,
          enum: ['improving', 'stable', 'declining'],
          default: 'stable'
        }
      },
      essayPerformance: {
        totalEssays: {
          type: Number,
          default: 0
        },
        averageScore: {
          type: Number,
          default: 0
        },
        strengthAreas: [String],
        improvementAreas: [String]
      }
    },

    // Goals & Milestones
    goals: {
      shortTerm: [{
        title: String,
        description: String,
        targetDate: Date,
        completed: {
          type: Boolean,
          default: false
        },
        completedAt: Date,
        category: {
          type: String,
          enum: ['daily', 'weekly', 'monthly']
        },
        progress: {
          type: Number,
          default: 0
        } // 0-100
      }],
      longTerm: [{
        title: String,
        description: String,
        targetDate: Date,
        milestones: [{
          title: String,
          completed: {
            type: Boolean,
            default: false
          },
          completedAt: Date
        }],
        progress: {
          type: Number,
          default: 0
        }
      }],
      achievements: [{
        title: String,
        description: String,
        icon: String,
        earnedAt: Date,
        category: String
      }]
    },

    // Bookmarks & Saved Content
    savedContent: {
      pyqs: [{
        questionId: String,
        question: String,
        savedAt: Date,
        tags: [String],
        notes: String
      }],
      chatMessages: [{
        chatId: String,
        messageId: String,
        content: String,
        savedAt: Date,
        tags: [String],
        notes: String
      }],
      flashcards: [{
        flashcardId: String,
        front: String,
        back: String,
        savedAt: Date,
        deck: String
      }],
      essays: [{
        essayId: String,
        title: String,
        content: String,
        savedAt: Date,
        score: Number
      }],
      currentAffairs: [{
        articleId: String,
        title: String,
        url: String,
        savedAt: Date,
        tags: [String]
      }]
    },

    // Notifications & Communication Preferences
    notificationPreferences: {
      email: {
        enabled: {
          type: Boolean,
          default: true
        },
        studyReminders: {
          type: Boolean,
          default: true
        },
        weeklyDigest: {
          type: Boolean,
          default: true
        },
        achievementAlerts: {
          type: Boolean,
          default: true
        },
        newFeatures: {
          type: Boolean,
          default: false
        }
      },
      inApp: {
        enabled: {
          type: Boolean,
          default: true
        },
        studyStreakAlerts: {
          type: Boolean,
          default: true
        },
        goalReminders: {
          type: Boolean,
          default: true
        },
        contentRecommendations: {
          type: Boolean,
          default: true
        }
      }
    },

    // Privacy & Data Management
    privacySettings: {
      dataCollectionConsent: {
        type: Boolean,
        default: true
      },
      analyticsConsent: {
        type: Boolean,
        default: true
      },
      personalizationConsent: {
        type: Boolean,
        default: true
      },
      lastExportedAt: Date,
      accountDeletionRequested: {
        type: Boolean,
        default: false
      },
      deletionRequestedAt: Date
    }
  }
}, {
  timestamps: true
});

userSchema.index({ email: 1 });
userSchema.index({ googleId: 1 });

export default mongoose.models.User || mongoose.model('User', userSchema);
