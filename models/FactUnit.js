import mongoose from 'mongoose';

const FactUnitSchema = new mongoose.Schema({
    statement: {
        type: String,
        required: true,
        trim: true,
        index: 'text'
    },
    subject: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        index: true
    },
    topic: {
        type: String,
        trim: true,
        index: true
    },
    gsPaper: {
        type: String,
        enum: ['GS1', 'GS2', 'GS3', 'GS4', 'Essay', 'Optional', 'Prelims'],
        index: true
    },
    maturity: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
        index: true
    },
    verified: {
        type: Boolean,
        default: false,
        index: true
    },
    source: {
        type: String, // Link or Document reference
        trim: true
    },
    sourceType: {
        type: String,
        enum: ['PYQ', 'News', 'Official Document', 'Manual', 'ExamKnowledge'],
        default: 'Manual'
    },
    metadata: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {}
    },
    lastProcessedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Compound index for efficient retrieval
FactUnitSchema.index({ subject: 1, maturity: -1, verified: 1 });
FactUnitSchema.index({ gsPaper: 1, topic: 1 });

export default mongoose.models.FactUnit || mongoose.model('FactUnit', FactUnitSchema);
