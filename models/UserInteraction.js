import mongoose from 'mongoose';

const userInteractionSchema = new mongoose.Schema({
    // User identification
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true,
        default: null // Null for guest users
    },
    userEmail: {
        type: String,
        index: true,
        default: null
    },
    sessionId: {
        type: String,
        index: true,
        required: true // Required for both authenticated and guest users
    },

    // Interaction details
    interactionType: {
        type: String,
        enum: [
            'chat',
            'pyq',
            'mock_test',
            'essay',
            'interview',
            'current_affairs',
            'flashcard',
            'notes',
            'vocabulary',
            'formula_sheet'
        ],
        required: true,
        index: true
    },

    feature: {
        type: String,
        required: true // Specific feature name (e.g., 'pyq_search', 'chat_message', 'mock_test_create')
    },

    action: {
        type: String,
        enum: [
            'view',
            'search',
            'attempt',
            'generate',
            'save',
            'bookmark',
            'submit',
            'analyze',
            'export',
            'share',
            'edit',
            'delete'
        ],
        required: true,
        index: true
    },

    // Engagement metrics
    metadata: {
        // Common fields
        topic: String,
        subject: String,
        category: String,
        difficulty: {
            type: String,
            enum: ['easy', 'medium', 'hard', 'adaptive', '']
        },

        // Time tracking
        timeSpent: {
            type: Number,
            default: 0 // in seconds
        },
        startTime: Date,
        endTime: Date,

        // Engagement scoring
        engagementScore: {
            type: Number,
            min: 0,
            max: 10,
            default: 5
        },

        // Performance metrics
        performance: {
            score: Number,
            accuracy: Number,
            questionsAttempted: Number,
            questionsCorrect: Number
        },

        // Content details
        contentId: String, // Reference to specific content (PYQ ID, Essay ID, etc.)
        contentTitle: String,
        wordCount: Number,

        // User behavior
        followUpActions: {
            type: Number,
            default: 0
        },
        bookmarked: {
            type: Boolean,
            default: false
        },
        shared: {
            type: Boolean,
            default: false
        },

        // Feature-specific data (flexible schema)
        customData: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        }
    },

    // Device and context
    deviceInfo: {
        userAgent: String,
        device: {
            type: String,
            enum: ['desktop', 'mobile', 'tablet', 'unknown'],
            default: 'unknown'
        },
        browser: String,
        os: String,
        screenResolution: String
    },

    // Location context (optional)
    location: {
        country: String,
        city: String,
        timezone: String
    },

    // Timestamps
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },

    // For guest user migration
    migratedToUser: {
        type: Boolean,
        default: false,
        index: true
    },
    migratedAt: Date

}, {
    timestamps: true
});

// Compound indexes for efficient queries
userInteractionSchema.index({ userId: 1, timestamp: -1 });
userInteractionSchema.index({ sessionId: 1, timestamp: -1 });
userInteractionSchema.index({ userId: 1, interactionType: 1, timestamp: -1 });
userInteractionSchema.index({ interactionType: 1, action: 1, timestamp: -1 });
userInteractionSchema.index({ 'metadata.topic': 1, timestamp: -1 });
userInteractionSchema.index({ 'metadata.subject': 1, timestamp: -1 });
userInteractionSchema.index({ migratedToUser: 1, sessionId: 1 });

// TTL index for guest interactions (auto-delete after 30 days if not migrated)
userInteractionSchema.index(
    { timestamp: 1 },
    {
        expireAfterSeconds: 2592000, // 30 days
        partialFilterExpression: {
            userId: null,
            migratedToUser: false
        }
    }
);

// Methods
userInteractionSchema.methods.calculateEngagement = function () {
    let score = 5; // Base score

    // Time spent factor (0-3 points)
    if (this.metadata.timeSpent > 300) score += 3; // 5+ minutes
    else if (this.metadata.timeSpent > 120) score += 2; // 2-5 minutes
    else if (this.metadata.timeSpent > 60) score += 1; // 1-2 minutes

    // Follow-up actions (0-2 points)
    if (this.metadata.followUpActions > 2) score += 2;
    else if (this.metadata.followUpActions > 0) score += 1;

    // Bookmarked/Saved (0-2 points)
    if (this.metadata.bookmarked) score += 2;
    if (this.metadata.shared) score += 1;

    // Performance factor (0-2 points)
    if (this.metadata.performance?.accuracy) {
        if (this.metadata.performance.accuracy > 80) score += 2;
        else if (this.metadata.performance.accuracy > 60) score += 1;
    }

    return Math.min(10, Math.max(0, score));
};

// Statics
userInteractionSchema.statics.getRecentInteractions = async function (userId, limit = 50) {
    return this.find({ userId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();
};

userInteractionSchema.statics.getInteractionsByType = async function (userId, type, limit = 50) {
    return this.find({ userId, interactionType: type })
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();
};

userInteractionSchema.statics.getTopicFrequency = async function (userId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.aggregate([
        {
            $match: {
                userId: new mongoose.Types.ObjectId(userId),
                timestamp: { $gte: startDate },
                'metadata.topic': { $exists: true, $ne: null }
            }
        },
        {
            $group: {
                _id: '$metadata.topic',
                count: { $sum: 1 },
                avgEngagement: { $avg: '$metadata.engagementScore' },
                lastInteraction: { $max: '$timestamp' }
            }
        },
        {
            $sort: { count: -1 }
        },
        {
            $limit: 20
        }
    ]);
};

userInteractionSchema.statics.migrateGuestInteractions = async function (sessionId, userId, userEmail) {
    const result = await this.updateMany(
        { sessionId, userId: null, migratedToUser: false },
        {
            $set: {
                userId: new mongoose.Types.ObjectId(userId),
                userEmail,
                migratedToUser: true,
                migratedAt: new Date()
            }
        }
    );

    return result;
};

export default mongoose.models.UserInteraction || mongoose.model('UserInteraction', userInteractionSchema);
