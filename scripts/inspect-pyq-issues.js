/**
 * Inspect PYQ Data Issues
 * Run: node scripts/inspect-pyq-issues.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from parent dir
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;

// PYQ Schema
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

async function inspect() {
    console.log('🔍 Inspecting PYQ Data Issues...\n');

    try {
        if (!MONGODB_URI) {
            throw new Error('MONGODB_URI is not defined in .env.local');
        }
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // 1. Check Year 2025
        const count2025 = await PYQ.countDocuments({ year: 2025 });
        console.log(`\n📅 Questions from Year 2025: ${count2025}`);

        if (count2025 > 0) {
            const sample2025 = await PYQ.find({ year: 2025 }).limit(3);
            console.log('   Sample 2025 questions:');
            sample2025.forEach(q => console.log(`   - [${q.level}] ${q.question.substring(0, 80)}... (Tags: ${q.topicTags}, Theme: ${q.theme})`));
        }

        // 2. Check Mains questions that might be MCQs
        // Criteria: Level=Mains AND (options has items OR starts with "Who among the following")
        const fakeMains = await PYQ.find({
            level: 'Mains',
            $or: [
                { options: { $not: { $size: 0 } } },
                { question: /^(Who among the following|Which of the following|Which one of the following)/i }
            ]
        }).limit(5);

        console.log(`\n🤔 Suspicious Mains Questions (MCQ style or options present):`);
        console.log(`   Found ${fakeMains.length} sample items.`);
        fakeMains.forEach(q => {
            console.log(`   - ${q.question.substring(0, 80)}...`);
            console.log(`     Has Options: ${q.options && q.options.length > 0 ? 'Yes' : 'No'}`);
            console.log(`     Theme: ${q.theme}`);
        });

        // 3. Check "Art and Architecture" specifically
        // The user complained about Aptitude in Art and Architecture
        const artQuestions = await PYQ.find({
            $or: [
                { theme: /Art and Architecture/i },
                { topicTags: /Art and Architecture/i }
            ]
        }).limit(10);

        console.log(`\n🎨 Sample "Art and Architecture" Questions:`);
        artQuestions.forEach(q => {
            // Check if it looks like Aptitude (Logic, Math?) or History mismatch
            console.log(`   - [${q.year}] ${q.question.substring(0, 80)}...`);
        });

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n📡 Disconnected');
    }
}

inspect();
