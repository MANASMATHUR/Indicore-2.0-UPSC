import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('Please define the MONGODB_URI environment variable inside .env.local');
    process.exit(1);
}

// Define Schema locally to avoid import issues
const essaySchema = new mongoose.Schema({
    topic: String,
    language: String,
    generatedBy: String
}, { strict: false });

const Essay = mongoose.models.Essay || mongoose.model('Essay', essaySchema);

async function verifyLogic() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected.');

        // Simulate user input
        // User might type "Banking and Finance"
        // DB has "Banking & Finance"
        const userInput = "Banking and Finance";

        console.log(`\n\n--- SIMULATION: User requests "${userInput}" ---`);

        // 1. First Attempt: Standard Case-Insensitive Regex
        console.log(`1. Trying standard case-insensitive search...`);
        let essay = await Essay.findOne({
            topic: { $regex: new RegExp(`^${userInput.trim()}$`, 'i') }
        });

        if (essay) {
            console.log(`[SUCCESS] Found exactly: "${essay.topic}"`);
        } else {
            console.log(`[FAIL] No direct match found.`);

            // 2. Fallback Logic (Exactly as implemented in API)
            console.log(`2. Engaging fallback logic (checking '&' vs 'and')...`);

            const topicNormalized = userInput.trim();
            let alternateTopic = '';

            if (topicNormalized.includes('&')) {
                alternateTopic = topicNormalized.replace(/&/g, 'and');
            } else if (/\band\b/i.test(topicNormalized)) {
                alternateTopic = topicNormalized.replace(/\band\b/gi, '&');
            }

            if (alternateTopic) {
                console.log(`   Generated alternate topic: "${alternateTopic}"`);
                essay = await Essay.findOne({
                    topic: { $regex: new RegExp(`^${alternateTopic.trim()}$`, 'i') }
                });

                if (essay) {
                    console.log(`[SUCCESS] Found via fallback: "${essay.topic}"`);
                    console.log(`   Content Preview: ${JSON.stringify(essay).substring(0, 100)}...`);
                } else {
                    console.log(`[FAIL] Still no match found.`);
                }
            } else {
                console.log(`   No alternate topic generation possible.`);
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

verifyLogic();
