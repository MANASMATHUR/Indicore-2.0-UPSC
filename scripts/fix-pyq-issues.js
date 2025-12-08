/**
 * Fix PYQ Data Issues
 * Run: node scripts/fix-pyq-issues.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;

const PyqSchema = new mongoose.Schema({
    exam: String,
    level: String,
    year: Number,
    question: String,
    options: [Object],
    topicTags: [String],
    theme: String,
    _invalid: Boolean
});

const PYQ = mongoose.models.PYQ || mongoose.model('PYQ', PyqSchema);

async function fix() {
    console.log('🛠️ Fixing PYQ Data Issues...\n');

    try {
        if (!MONGODB_URI) {
            throw new Error('MONGODB_URI is not defined in .env.local');
        }
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // 1. Delete all 2025 questions
        console.log('\n🗑️ Deleting questions from Year 2025...');
        const deleteResult = await PYQ.deleteMany({ year: 2025 });
        console.log(`   Deleted ${deleteResult.deletedCount} questions.`);

        // 2. Fix Mains -> Prelims mismatch
        // If it sends as Mains but has options, it's Prelims
        console.log('\n🔄 Fixing Mains questions that are actually MCQs (Prelims)...');

        const updateResult = await PYQ.updateMany(
            {
                level: 'Mains',
                $or: [
                    { options: { $not: { $size: 0 } } },
                    { question: /^(Who among the following|Which of the following|Which one of the following)/i }
                ]
            },
            { $set: { level: 'Prelims' } }
        );

        console.log(`   Updated ${updateResult.modifiedCount} "Mains" questions to "Prelims".`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n📡 Disconnected');
    }
}

fix();
