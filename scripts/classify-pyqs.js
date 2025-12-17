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

const MAINS_KEYWORDS = [
    'discuss', 'analyze', 'examine', 'critically', 'comment', 'substantiate',
    'trace', 'evaluate', 'distinguish', 'account for', 'give reasons',
    'elucidate', 'describe', 'explain', 'suggest', 'enumerate', 'highlight'
];

const PRELIMS_KEYWORDS = [
    'consider the following', 'which of the following', 'with reference to',
    'which one of', 'arranged in', 'correct order'
];

async function classify() {
    try {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI);
            console.log('✓ Connected');
        }

        const cursor = PYQ.find({ exam: 'UPSC' }).cursor();

        let updatedCount = 0;
        let processedCount = 0;
        let mainsCount = 0;
        let prelimsCount = 0;

        console.log('Starting classification...');

        for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
            processedCount++;
            let newLevel = doc.level;
            let reason = '';

            const text = doc.question.toLowerCase().trim();
            const hasOptions = doc.options && doc.options.length > 0;
            const paper = (doc.paper || '').toLowerCase();

            // 1. Strongest Signal: Options presence (User's rule: Prelims = MCQ)
            if (hasOptions) {
                newLevel = 'Prelims';
                reason = 'Has Options';
            }
            // 2. Paper Name Check
            else if (paper.includes('essay') || paper.includes('gs-') || paper.includes('optional') || paper.includes('mains')) {
                newLevel = 'Mains';
                reason = 'Paper Name';
            }
            else if (paper.includes('prelim') || paper.includes('csat')) {
                newLevel = 'Prelims';
                reason = 'Paper Name';
            }
            // 3. Keyword Check (Overrides current level if it blatantly contradicts)
            else if (MAINS_KEYWORDS.some(k => text.startsWith(k) || text.includes(` ${k} `))) {
                newLevel = 'Mains';
                reason = 'Keyword Match';
            }
            else if (PRELIMS_KEYWORDS.some(k => text.includes(k))) {
                newLevel = 'Prelims';
                reason = 'Keyword Match';
            }
            // 4. Fallback for unlabeled
            else if (!newLevel) {
                if (text.length > 200) {
                    newLevel = 'Mains';
                    reason = 'Length (Subjective)';
                } else {
                    newLevel = 'Prelims'; // Default short to Prelims (likely broken MCQs)
                    reason = 'Length (Short)';
                }
            }

            // Check for specific "Critically" etc in current "Prelims" to fix them
            if (doc.level === 'Prelims' && !hasOptions) {
                if (MAINS_KEYWORDS.some(k => text.startsWith(k))) {
                    newLevel = 'Mains';
                    reason = 'Fix: Subjective in Prelims';
                }
            }

            if (newLevel !== doc.level) {
                // console.log(`[UPDATE] ${doc._id}: ${doc.level} -> ${newLevel} (${reason})`);
                await PYQ.updateOne({ _id: doc._id }, { $set: { level: newLevel } });
                updatedCount++;
            }

            if (newLevel === 'Mains') mainsCount++;
            else if (newLevel === 'Prelims') prelimsCount++;

            if (processedCount % 1000 === 0) process.stdout.write('.');
        }

        console.log('\n\n--- Classification Complete ---');
        console.log(`Processed: ${processedCount}`);
        console.log(`Updated: ${updatedCount}`);
        console.log(`Final Breakdown -> Mains: ${mainsCount}, Prelims: ${prelimsCount}`);

    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.disconnect();
    }
}

classify();
