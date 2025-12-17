
import mongoose from 'mongoose';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('MONGODB_URI is not defined in .env.local');
    process.exit(1);
}

const PyqSchema = new mongoose.Schema({
    exam: String,
    question: String,
    lang: String,
    year: Number
}, { collection: 'pyqs' });

const PYQ = mongoose.models.PYQ || mongoose.model('PYQ', PyqSchema);

async function fixTagging() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected.');

        const tamilRegex = /[\u0B80-\u0BFF]/;

        // 1. Find count of incorrectly tagged
        console.log('Finding UPSC questions with Tamil text...');
        const incorrectCount = await PYQ.countDocuments({
            exam: 'UPSC',
            question: { $regex: tamilRegex }
        });

        console.log(`Found ${incorrectCount} incorrectly tagged questions.`);

        if (incorrectCount > 0) {
            console.log('Fixing incorrect tagging...');
            const result = await PYQ.updateMany(
                {
                    exam: 'UPSC',
                    question: { $regex: tamilRegex }
                },
                {
                    $set: {
                        exam: 'TNPSC',
                        lang: 'ta'
                    }
                }
            );

            console.log('Update Result:', result);
            console.log(`Successfully updated ${result.modifiedCount} documents.`);
        } else {
            console.log('No incorrectly tagged questions found.');
        }

    } catch (error) {
        console.error('Fix Error:', error);
    } finally {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
            console.log('Disconnected');
        }
    }
}

fixTagging();
