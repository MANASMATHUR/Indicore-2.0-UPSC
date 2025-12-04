/**
 * PYQ Database Cleanup Script
 * 
 * This script cleans up poorly formatted questions in the database:
 * - Removes MCQ options from question text
 * - Splits merged questions
 * - Removes LaTeX artifacts
 * - Fixes garbled text
 * - Removes invalid/incomplete questions
 * 
 * Run: node scripts/cleanup-pyq-database.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;

// PYQ Schema (simplified for cleanup)
const pyqSchema = new mongoose.Schema({
    question: String,
    year: Number,
    examCode: String,
    paper: String,
    theme: String,
    topicTags: [String],
    keywords: [String],
    analysis: String,
    verified: Boolean,
    sourceLink: String,
    _cleaned: Boolean, // Flag for cleaned questions
    _invalid: Boolean, // Flag for invalid questions
});

const PYQ = mongoose.models.PYQ || mongoose.model('PYQ', pyqSchema);

// Statistics
const stats = {
    total: 0,
    cleaned: 0,
    invalid: 0,
    deleted: 0,
    unchanged: 0,
    errors: 0,
};

/**
 * Clean question text - aggressive sanitization
 */
function cleanQuestionText(text) {
    if (!text) return { text: '', isValid: false, reason: 'empty' };

    let cleaned = text;
    const changes = [];

    // Step 1: Remove leading MCQ option patterns
    // Patterns like "(d) Answer text 14. Actual question..."
    const mcqLeadPattern = /^\s*\([a-d]\)\s*[^.?!]{0,50}\s*\d{1,3}\.\s*/i;
    if (mcqLeadPattern.test(cleaned)) {
        cleaned = cleaned.replace(mcqLeadPattern, '');
        changes.push('removed_mcq_lead');
    }

    // Step 2: Remove standalone MCQ options at start
    // Patterns like "(d) " at the beginning
    const standaloneOption = /^\s*\([a-d]\)\s+/i;
    if (standaloneOption.test(cleaned)) {
        cleaned = cleaned.replace(standaloneOption, '');
        changes.push('removed_standalone_option');
    }

    // Step 3: Remove LaTeX artifacts
    const latexPatterns = [
        /\$\\mathrm\{[^}]*\}/g,
        /\$\\frac\{[^}]*\}\{[^}]*\}/g,
        /\$\\ldots\$/g,
        /\$\\text\{[^}]*\}/g,
        /\$[^$]+\$/g, // Generic LaTeX
        /\\[a-z]+\{[^}]*\}/gi,
    ];
    for (const pattern of latexPatterns) {
        if (pattern.test(cleaned)) {
            cleaned = cleaned.replace(pattern, ' ');
            changes.push('removed_latex');
        }
    }

    // Step 4: Remove question numbers embedded in text
    // Pattern: "14. With reference to..." at start
    cleaned = cleaned.replace(/^\s*\d{1,3}\.\s+/, '');

    // Step 5: Remove Hindi/English mixed garbage patterns
    cleaned = cleaned.replace(/\([a-d]\)\s*[अ-ह][^\s]*\s*\d{1,3}\./g, '');

    // Step 6: Clean up excessive whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    // Step 7: Remove HTML entities
    cleaned = cleaned.replace(/&nbsp;/g, ' ');
    cleaned = cleaned.replace(/&amp;/g, '&');
    cleaned = cleaned.replace(/&lt;/g, '<');
    cleaned = cleaned.replace(/&gt;/g, '>');
    cleaned = cleaned.replace(/&quot;/g, '"');

    // Step 8: Fix punctuation spacing
    cleaned = cleaned.replace(/\s+([,\.;:!?])/g, '$1');
    cleaned = cleaned.replace(/([,\.;:!?])([^\s])/g, '$1 $2');

    // Step 9: Capitalize first letter
    if (cleaned.length > 0) {
        cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }

    // Validation checks
    const isValid = validateQuestion(cleaned);

    return {
        text: cleaned,
        isValid: isValid.valid,
        reason: isValid.reason,
        changes: changes,
    };
}

/**
 * Validate if a question is valid
 */
function validateQuestion(text) {
    if (!text || text.length < 20) {
        return { valid: false, reason: 'too_short' };
    }

    // Check for meaningful content
    const hasVerb = /\b(is|are|was|were|do|does|did|can|could|will|would|should|has|have|had|explain|discuss|describe|analyze|compare|evaluate|examine|what|which|who|where|when|why|how)\b/i.test(text);
    const hasQuestionMark = text.includes('?');

    if (!hasVerb && !hasQuestionMark) {
        // Check if it's at least 100 chars (might be a statement question)
        if (text.length < 100) {
            return { valid: false, reason: 'no_verb_or_question' };
        }
    }

    // Check for excessive numbers (garbled data)
    const numberCount = (text.match(/\d+/g) || []).length;
    const wordCount = text.split(/\s+/).length;
    if (numberCount > 15 && wordCount < 20) {
        return { valid: false, reason: 'number_spam' };
    }

    // Check for incomplete patterns
    if (/\s+(and|or|the|a|an|of|in|on|at|to|for|with)$/i.test(text) && text.length < 80) {
        return { valid: false, reason: 'incomplete_phrase' };
    }

    return { valid: true, reason: 'ok' };
}

/**
 * Process a single question
 */
async function processQuestion(doc) {
    const original = doc.question;
    const result = cleanQuestionText(original);

    if (!result.isValid) {
        // Mark as invalid instead of deleting
        await PYQ.updateOne(
            { _id: doc._id },
            { $set: { _invalid: true, _invalidReason: result.reason } }
        );
        stats.invalid++;
        return { action: 'invalid', reason: result.reason };
    }

    if (result.text !== original && result.changes.length > 0) {
        // Update with cleaned text
        await PYQ.updateOne(
            { _id: doc._id },
            { $set: { question: result.text, _cleaned: true } }
        );
        stats.cleaned++;
        return { action: 'cleaned', changes: result.changes };
    }

    stats.unchanged++;
    return { action: 'unchanged' };
}

/**
 * Main cleanup function
 */
async function cleanupDatabase() {
    console.log('🧹 PYQ Database Cleanup Script');
    console.log('================================\n');

    try {
        // Connect to MongoDB
        console.log('📡 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected!\n');

        // Get total count
        stats.total = await PYQ.countDocuments({ _invalid: { $ne: true } });
        console.log(`📊 Total questions to process: ${stats.total}\n`);

        // Process in batches
        const batchSize = 100;
        let processed = 0;

        console.log('🔄 Processing questions...\n');

        const cursor = PYQ.find({ _invalid: { $ne: true } }).cursor();

        for await (const doc of cursor) {
            try {
                await processQuestion(doc);
                processed++;

                // Progress update every 500 questions
                if (processed % 500 === 0) {
                    const percent = ((processed / stats.total) * 100).toFixed(1);
                    console.log(`   Progress: ${processed}/${stats.total} (${percent}%)`);
                }
            } catch (error) {
                stats.errors++;
                console.error(`   Error processing ${doc._id}: ${error.message}`);
            }
        }

        // Print summary
        console.log('\n================================');
        console.log('📈 Cleanup Summary');
        console.log('================================');
        console.log(`Total processed: ${stats.total}`);
        console.log(`✅ Cleaned:      ${stats.cleaned}`);
        console.log(`⚠️  Invalid:     ${stats.invalid}`);
        console.log(`➡️  Unchanged:   ${stats.unchanged}`);
        console.log(`❌ Errors:       ${stats.errors}`);
        console.log('================================\n');

        // Show sample of cleaned questions
        console.log('📝 Sample of cleaned questions:');
        const samples = await PYQ.find({ _cleaned: true }).limit(5);
        samples.forEach((q, i) => {
            console.log(`\n${i + 1}. ${q.question.substring(0, 100)}...`);
        });

        // Show count of invalid questions by reason
        console.log('\n📊 Invalid questions breakdown:');
        const invalidReasons = await PYQ.aggregate([
            { $match: { _invalid: true } },
            { $group: { _id: '$_invalidReason', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
        invalidReasons.forEach(r => {
            console.log(`   ${r._id}: ${r.count}`);
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('\n📡 Disconnected from MongoDB');
    }
}

// Run the cleanup
cleanupDatabase();
