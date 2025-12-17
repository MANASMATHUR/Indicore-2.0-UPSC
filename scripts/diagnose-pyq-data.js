
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

console.log('URI Scheme:', MONGODB_URI.split('://')[0]);
console.log('URI contains backslash:', MONGODB_URI.includes('\\'));

const PyqSchema = new mongoose.Schema({
    exam: String,
    question: String,
    lang: String,
    year: Number
}, { collection: 'pyqs' });

const PYQ = mongoose.models.PYQ || mongoose.model('PYQ', PyqSchema);

async function diagnose() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB successfully.');

        const totalCount = await PYQ.countDocuments();
        console.log(`Total documents: ${totalCount}`);

        console.log('Checking for UPSC questions with lang=ta...');
        const langTaCount = await PYQ.countDocuments({
            exam: 'UPSC',
            lang: 'ta'
        });
        console.log(`Found ${langTaCount} UPSC questions with lang='ta'.`);

        // Regex for Tamil characters - simplified
        const tamilRegex = /[\u0B80-\u0BFF]/;

        console.log('Checking for UPSC questions with Tamil regex...');
        const regexCount = await PYQ.countDocuments({
            exam: 'UPSC',
            question: { $regex: tamilRegex }
        });
        console.log(`Found ${regexCount} UPSC questions with Tamil regex.`);

    } catch (error) {
        console.error('Diagnosis Error:', error); // Print full error object
    } finally {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
            console.log('Disconnected');
        }
    }
}

diagnose();
