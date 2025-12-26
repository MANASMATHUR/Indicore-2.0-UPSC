import mongoose from 'mongoose';

const recommendationItemSchema = new mongoose.Schema({
    item: {
        type: String,
        required: true
    },
    itemType: {
        type: String,
        enum: ['topic', 'subject', 'question', 'essay', 'test', 'article', 'schedule']
    },
    itemId: String, // Reference to specific content if applicable
    reason: {
        type: String,
        required: true
    },
    priority: {
        type: Number,
        min: 0,
        max: 100,
        default: 50
    },
    confidence: {
        type: Number,
        min: 0,
        max: 1,
        default: 0.5
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, { _id: false });

const recommendationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    userEmail: {
        type: String,
        required: true,
        index: true
    },

    recommendationType: {
        type: String,
        enum: [
            'pyq',
            'essay',
            'mock_test',
            'current_affairs',
            'study_schedule',
            'flashcard',
            'interview',
            'general',
            'weakness_map',
            'performance_history',
            'daily_plan',
            'persona',
            'nudges',
            'prediction',
            'achievements'
        ],
        required: true,
        index: true
    },

    recommendations: [recommendationItemSchema],

    // Generation metadata
    generationContext: {
        basedOn: {
            type: String,
            enum: ['performance', 'behavior', 'preferences', 'mixed'],
            default: 'mixed'
        },
        dataPoints: {
            type: Number,
            default: 0 // Number of interactions analyzed
        },
        algorithm: {
            type: String,
            default: 'engagement_weighted'
        },
        version: {
            type: String,
            default: '1.0'
        }
    },

    // Timestamps
    generatedAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    expiresAt: {
        type: Date,
        required: true,
        index: true
    },

    // User interaction with recommendations
    viewed: {
        type: Boolean,
        default: false,
        index: true
    },
    viewedAt: Date,

    acted: {
        type: Boolean,
        default: false,
        index: true
    },
    actedAt: Date,

    actedItems: [{
        item: String,
        actionType: String,
        timestamp: Date
    }],

    // Feedback
    feedback: {
        helpful: {
            type: Boolean,
            default: null
        },
        rating: {
            type: Number,
            min: 1,
            max: 5
        },
        comment: String,
        submittedAt: Date
    },

    // Status
    status: {
        type: String,
        enum: ['active', 'expired', 'archived', 'dismissed'],
        default: 'active',
        index: true
    }

}, {
    timestamps: true
});

// Compound indexes
recommendationSchema.index({ userId: 1, recommendationType: 1, status: 1 });
recommendationSchema.index({ userId: 1, generatedAt: -1 });
recommendationSchema.index({ expiresAt: 1, status: 1 });

// TTL index to auto-delete expired recommendations after 7 days
recommendationSchema.index(
    { expiresAt: 1 },
    {
        expireAfterSeconds: 604800, // 7 days after expiration
        partialFilterExpression: { status: 'expired' }
    }
);

// Pre-save middleware to set expiration
recommendationSchema.pre('save', function (next) {
    if (this.isNew && !this.expiresAt) {
        // Default expiration: 24 hours for most types, 7 days for study schedule
        const hoursToExpire = this.recommendationType === 'study_schedule' ? 168 : 24;
        this.expiresAt = new Date(Date.now() + hoursToExpire * 60 * 60 * 1000);
    }
    next();
});

// Methods
recommendationSchema.methods.markViewed = function () {
    this.viewed = true;
    this.viewedAt = new Date();
    return this.save();
};

recommendationSchema.methods.markActed = function (item, actionType) {
    this.acted = true;
    this.actedAt = new Date();
    this.actedItems.push({
        item,
        actionType,
        timestamp: new Date()
    });
    return this.save();
};

recommendationSchema.methods.submitFeedback = function (helpful, rating, comment) {
    this.feedback = {
        helpful,
        rating,
        comment,
        submittedAt: new Date()
    };
    return this.save();
};

recommendationSchema.methods.checkExpiration = function () {
    if (this.expiresAt < new Date() && this.status === 'active') {
        this.status = 'expired';
        return this.save();
    }
    return Promise.resolve(this);
};

// Statics
recommendationSchema.statics.getActiveRecommendations = async function (userId, type = null) {
    const query = {
        userId,
        status: 'active',
        expiresAt: { $gt: new Date() }
    };

    if (type) {
        query.recommendationType = type;
    }

    return this.find(query)
        .sort({ generatedAt: -1 })
        .lean();
};

recommendationSchema.statics.getRecommendationStats = async function (userId) {
    const stats = await this.aggregate([
        {
            $match: {
                userId: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $group: {
                _id: '$recommendationType',
                total: { $sum: 1 },
                viewed: { $sum: { $cond: ['$viewed', 1, 0] } },
                acted: { $sum: { $cond: ['$acted', 1, 0] } },
                avgRating: { $avg: '$feedback.rating' }
            }
        }
    ]);

    return stats;
};

recommendationSchema.statics.cleanupExpired = async function () {
    const result = await this.updateMany(
        {
            status: 'active',
            expiresAt: { $lt: new Date() }
        },
        {
            $set: { status: 'expired' }
        }
    );

    return result;
};

export default mongoose.models.Recommendation || mongoose.model('Recommendation', recommendationSchema);
