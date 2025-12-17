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

async function verify() {
    try {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI);
        }

        console.log('--- Verifying AI Normalization ---\n');
        const samples = await PYQ.find({
            exam: 'UPSC',
            updatedAt: { $gt: new Date(Date.now() - 10 * 60 * 1000) }, // Updated in last 10 mins
            topicTags: { $exists: true, $not: { $size: 0 } }
        }).sort({ updatedAt: -1 }).limit(10);

        samples.forEach((d, i) => {
            console.log(`[${i + 1}] ${d.question.substring(0, 40)}...`);
            console.log(`    Paper: ${d.paper}`);
            console.log(`    Tags: ${d.topicTags.join(', ')}\n`);
        });

    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.disconnect();
    }
}

verify();
