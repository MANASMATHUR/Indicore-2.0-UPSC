import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('Please define the MONGODB_URI environment variable inside .env.local');
    process.exit(1);
}

const essaySchema = new mongoose.Schema({
    topic: String,
    language: String,
    generatedBy: String
}, { strict: false });

const Essay = mongoose.models.Essay || mongoose.model('Essay', essaySchema);

async function checkEssays() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        const searchTopic = "Cyber Security";
        const constValues = "Constitutional Values";

        console.log(`\n--- Searching for: "${searchTopic}" ---`);

        // 1. Regex case-insensitive
        const regex = new RegExp(`^${searchTopic.trim()}$`, 'i');
        console.log(`Regex: ${regex}`);
        const regexMatch = await Essay.findOne({ topic: { $regex: regex } });
        console.log(regexMatch ? `[MATCH] Found: "${regexMatch.topic}" | Lang: ${regexMatch.language} | By: ${regexMatch.generatedBy}` : '[NO MATCH]');

        console.log(`\n--- Searching for: "${constValues}" ---`);
        const regex2 = new RegExp(`^${constValues.trim()}$`, 'i');
        console.log(`Regex: ${regex2}`);
        const regexMatch2 = await Essay.findOne({ topic: { $regex: regex2 } });
        console.log(regexMatch2 ? `[MATCH] Found: "${regexMatch2.topic}" | Lang: ${regexMatch2.language} | By: ${regexMatch2.generatedBy}` : '[NO MATCH]');

        // 3. List all topics slightly matching "cyber" or "constitutional"
        console.log('\n--- All similar topics (Partial Match) ---');
        const allSimilar = await Essay.find({
            $or: [
                { topic: { $regex: /cyber/i } },
                { topic: { $regex: /constitutional/i } }
            ]
        }).select('topic language generatedBy');

        if (allSimilar.length === 0) {
            console.log('No partial matches found either.');
        } else {
            allSimilar.forEach(e => console.log(`- "${e.topic}" [${e.language}] (by ${e.generatedBy})`));
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

checkEssays();
