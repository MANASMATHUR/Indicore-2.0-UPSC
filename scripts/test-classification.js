import mongoose from 'mongoose';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';

const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath });
} else {
    dotenv.config();
}

import PYQ from '../models/PYQ.js';

async function testClassification() {
    try {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI);
        }

        const unlabeled = await PYQ.find({
            exam: 'UPSC',
            $or: [{ level: '' }, { level: { $exists: false } }, { level: null }]
        }).limit(50); // Test on 50 items

        console.log(`\nTesting classification on ${unlabeled.length} unlabeled questions...\n`);

        let mainsCount = 0;
        let prelimsCount = 0;
        let unsureCount = 0;

        unlabeled.forEach(q => {
            let proposed = '?';
            const text = q.question.toLowerCase().trim();
            const hasOptions = q.options && q.options.length > 0;

            // Heuristic Logic
            if (hasOptions) {
                proposed = 'Prelims (Has Options)';
            } else {
                // Mains keywords
                const mainsKeywords = ['discuss', 'analyze', 'examine', 'elucidate', 'critically', 'comment', 'substantiate', 'trace', 'evaluate', 'distinguish', 'account for', 'give reasons'];
                const isMainsStart = mainsKeywords.some(k => text.startsWith(k) || text.includes(` ${k} `));

                // Prelims keywords
                const prelimsKeywords = ['consider the following', 'which of the following', 'with reference to', 'which one of'];
                const isPrelimsStart = prelimsKeywords.some(k => text.includes(k));

                if (isMainsStart) proposed = 'Mains (Keyword)';
                else if (isPrelimsStart) proposed = 'Prelims (Keyword)';
                else if (text.length > 250) proposed = 'Mains (Length)'; // Long text without options -> likely Mains
                else if (text.length < 100) proposed = 'Prelims (Short)'; // Very short -> likely Prelims fact
            }

            if (proposed.includes('Mains')) mainsCount++;
            else if (proposed.includes('Prelims')) prelimsCount++;
            else unsureCount++;

            console.log(`[${proposed}] ${q.question.substring(0, 60)}...`);
        });

        console.log('\n--- Summary ---');
        console.log(`Proposed Mains: ${mainsCount}`);
        console.log(`Proposed Prelims: ${prelimsCount}`);
        console.log(`Unsure: ${unsureCount}`);

    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.disconnect();
    }
}

testClassification();
