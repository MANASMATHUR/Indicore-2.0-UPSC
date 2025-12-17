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

async function checkMisplacedMains() {
    try {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI);
        }

        const regex = /^(Discuss|Analyze|Examine|Critically|Comment|Substantiate|Trace|Evaluate|Distinguish|Account for|Give reasons)/i;

        // Check in Prelims
        const misplaced = await PYQ.find({
            exam: 'UPSC',
            level: 'Prelims',
            question: { $regex: regex }
        }).limit(10);

        console.log(`\nFound ${misplaced.length} sample 'Prelims' questions starting with Mains keywords:\n`);

        misplaced.forEach((q, i) => {
            console.log(`[${i + 1}] (${q.level}) ${q.question.substring(0, 80)}...`);
        });

    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.disconnect();
    }
}

checkMisplacedMains();
