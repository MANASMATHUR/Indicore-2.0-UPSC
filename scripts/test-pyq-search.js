import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('❌ MONGO_URI environment variable not found!');
    process.exit(1);
}

const PyqSchema = new mongoose.Schema({
    exam: String,
    level: String,
    paper: String,
    year: Number,
    question: String,
    theme: String,
    topicTags: [String],
    keywords: [String],
    sourceLink: String,
    verified: Boolean,
}, { timestamps: true });

const PYQ = mongoose.models.PYQ || mongoose.model('PYQ', PyqSchema);

async function testSearch() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✓ Connected to MongoDB\n');

        // Test queries from the user's chat
        const testQueries = [
            { query: 'geography', exam: 'UPSC' },
            { query: 'economics', exam: 'UPSC' },
            { query: 'eco', exam: 'UPSC' },
            { query: 'geo', exam: 'UPSC' },
            { query: 'history', exam: 'UPSC' },
        ];

        for (const { query, exam } of testQueries) {
            console.log(`\n🔍 Testing: "${query}" for ${exam}`);

            // Test 1: Direct theme match
            const themeMatch = await PYQ.find({
                exam: exam,
                theme: { $regex: query, $options: 'i' }
            }).limit(5).lean();
            console.log(`   Theme match: ${themeMatch.length} results`);

            // Test 2: Keywords match
            const keywordsMatch = await PYQ.find({
                exam: exam,
                keywords: { $regex: query, $options: 'i' }
            }).limit(5).lean();
            console.log(`   Keywords match: ${keywordsMatch.length} results`);

            // Test 3: Topic tags match
            const topicMatch = await PYQ.find({
                exam: exam,
                topicTags: { $regex: query, $options: 'i' }
            }).limit(5).lean();
            console.log(`   Topic tags match: ${topicMatch.length} results`);

            // Test 4: Question text search
            const questionMatch = await PYQ.find({
                exam: exam,
                question: { $regex: query, $options: 'i' }
            }).limit(5).lean();
            console.log(`   Question text match: ${questionMatch.length} results`);

            // Test 5: Combined search (what pyqService should do)
            const combined = await PYQ.find({
                exam: exam,
                $or: [
                    { theme: { $regex: query, $options: 'i' } },
                    { keywords: { $regex: query, $options: 'i' } },
                    { topicTags: { $regex: query, $options: 'i' } },
                    { question: { $regex: query, $options: 'i' } }
                ]
            }).limit(5).lean();
            console.log(`   Combined search: ${combined.length} results`);

            if (combined.length > 0) {
                console.log(`   Sample: [${combined[0].year}] ${combined[0].question.substring(0, 80)}...`);
                console.log(`   Theme: ${combined[0].theme || 'N/A'}`);
            }
        }

        // Check what themes exist in the database
        console.log('\n\n📊 Available themes in database:');
        const themes = await PYQ.aggregate([
            { $match: { theme: { $ne: null, $ne: '' } } },
            { $group: { _id: '$theme', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 20 }
        ]);
        themes.forEach(({ _id, count }) => {
            console.log(`   ${_id}: ${count} questions`);
        });

        await mongoose.disconnect();
        console.log('\n✓ Done!');
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

testSearch();
