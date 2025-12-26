
import connectToDatabase from './lib/mongodb.js';
import PYQ from './models/PYQ.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
dotenv.config({ path: path.join(__dirname, '.env.local') });

async function check() {
    console.log('Connecting to database...');
    await connectToDatabase();
    console.log('Searching for "encashment"...');
    const questions = await PYQ.find({ question: /encashment/i }).limit(5);
    console.log('Found questions count:', questions.length);
    if (questions.length > 0) {
        console.log('Found questions:', JSON.stringify(questions, null, 2));
    } else {
        // Try theme search
        console.log('Searching by theme...');
        const themeQuestions = await PYQ.find({ topicTags: /encashment/i }).limit(5);
        console.log('Found by theme:', themeQuestions.length);
    }
    process.exit(0);
}

check().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
