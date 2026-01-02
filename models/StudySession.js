import mongoose from 'mongoose';

const studySessionSchema = new mongoose.Schema({
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
    startTime: {
        type: Date,
        required: true
    },
    endTime: {
        type: Date,
        required: true
    },
    duration: {
        type: Number, // in minutes
        required: true
    },
    sessionType: {
        type: String,
        enum: ['chat', 'mock_test', 'pyq', 'essay', 'flashcard', 'reading', 'mixed'],
        default: 'mixed'
    },
    topicsCovered: [{
        topic: String,
        category: String, // GS-1, GS-2, etc.
        timeSpent: Number // minutes
    }],
    questionsAttempted: {
        type: Number,
        default: 0
    },
    questionsCorrect: {
        type: Number,
        default: 0
    },
    // Behavioral metrics
    focusScore: {
        type: Number, // 0-1 (based on interaction patterns)
        default: 0.5
    },
    productivityScore: {
        type: Number, // 0-1
        default: 0.5
    },
    engagementLevel: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    // Interaction patterns
    messageCount: {
        type: Number,
        default: 0
    },
    averageResponseTime: {
        type: Number, // seconds
        default: 0
    },
    followUpQuestions: {
        type: Number,
        default: 0
    },
    clarificationRequests: {
        type: Number,
        default: 0
    },
    // Break patterns
    breaksTaken: {
        type: Number,
        default: 0
    },
    longestFocusPeriod: {
        type: Number, // minutes
        default: 0
    },
    // Performance
    comprehensionScore: {
        type: Number, // 0-100
        default: 50
    },
    retentionIndicators: {
        revisitedTopics: Number,
        correctAnswersOnRevision: Number
    },
    // Context
    timeOfDay: {
        type: String,
        enum: ['early_morning', 'morning', 'afternoon', 'evening', 'night', 'late_night']
    },
    dayOfWeek: {
        type: String,
        enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    },
    // Metadata
    deviceType: String,
    notes: String
}, {
    timestamps: true
});

// Indexes for efficient queries
studySessionSchema.index({ userEmail: 1, startTime: -1 });
studySessionSchema.index({ userEmail: 1, sessionType: 1 });
studySessionSchema.index({ startTime: -1 });

// Virtual for accuracy rate
studySessionSchema.virtual('accuracyRate').get(function () {
    if (this.questionsAttempted === 0) return 0;
    return (this.questionsCorrect / this.questionsAttempted) * 100;
});

// Method to calculate time of day category
studySessionSchema.methods.calculateTimeOfDay = function () {
    const hour = new Date(this.startTime).getHours();
    if (hour >= 4 && hour < 7) return 'early_morning';
    if (hour >= 7 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 20) return 'evening';
    if (hour >= 20 && hour < 23) return 'night';
    return 'late_night';
};

// Static method to get user's peak productivity hours
studySessionSchema.statics.getPeakProductivityHours = async function (userEmail, days = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const sessions = await this.find({
        userEmail,
        startTime: { $gte: cutoffDate },
        productivityScore: { $gte: 0.6 }
    });

    const hourlyScores = {};
    sessions.forEach(session => {
        const hour = new Date(session.startTime).getHours();
        if (!hourlyScores[hour]) {
            hourlyScores[hour] = { total: 0, count: 0 };
        }
        hourlyScores[hour].total += session.productivityScore;
        hourlyScores[hour].count += 1;
    });

    const averages = Object.entries(hourlyScores).map(([hour, data]) => ({
        hour: parseInt(hour),
        avgScore: data.total / data.count,
        sessionCount: data.count
    }));

    return averages.sort((a, b) => b.avgScore - a.avgScore);
};

export default mongoose.models.StudySession || mongoose.model('StudySession', studySessionSchema);
