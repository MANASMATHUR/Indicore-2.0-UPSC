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

async function inspect() {
    try {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI);
        }

        // Get 5 samples with empty level
        const samples = await PYQ.find({
            exam: 'UPSC',
            $or: [{ level: '' }, { level: { $exists: false } }, { level: null }]
        }).limit(5);

        console.log('\n--- Details of Unlabeled PYQs ---');
        samples.forEach((q, i) => {
            console.log(`\n[${i + 1}] Year: ${q.year}, Q: ${q.question.substring(0, 50)}...`);
            console.log(`    Options: ${q.options?.length || 0}`);
            console.log(`    Tags: ${q.topicTags?.join(', ')}`);
            console.log(`    Paper: ${q.paper}`);
        });

        // Check correlation between 'options' and 'level'
        const prelimsWithOptions = await PYQ.countDocuments({
            exam: 'UPSC',
            level: 'Prelims',
            'options.0': { $exists: true }
        });

        const prelimsNoOptions = await PYQ.countDocuments({
            exam: 'UPSC',
            level: 'Prelims',
            'options': { $size: 0 }
        });

        console.log(`\nPrelims with Options: ${prelimsWithOptions}`);
        console.log(`Prelims without Options: ${prelimsNoOptions}`);

    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.disconnect();
    }
}

inspect();
