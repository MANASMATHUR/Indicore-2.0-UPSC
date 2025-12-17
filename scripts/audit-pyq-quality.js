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

async function auditData() {
    try {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI);
        }

        console.log('--- Data Quality Audit ---\n');

        // 1. Paper Name Inconsistencies
        const papers = await PYQ.aggregate([
            { $match: { exam: 'UPSC' } },
            { $group: { _id: '$paper', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 20 }
        ]);
        console.log('Top 20 Paper Names:');
        papers.forEach(p => console.log(`  "${p._id}": ${p.count}`));

        // 2. Check for bad characters in questions
        const regex = /[<>]/; // Simple check for HTML tags
        const dirtyQuestions = await PYQ.countDocuments({
            exam: 'UPSC',
            question: { $regex: regex }
        });
        console.log(`\nQuestions containing HTML tags (< >): ${dirtyQuestions}`);

        // 3. Sample "Messy" looking questions (short or very long)
        console.log('\nSample potentially messy questions (very short):');
        const shortQs = await PYQ.find({ exam: 'UPSC', $expr: { $lt: [{ $strLenCP: "$question" }, 30] } }).limit(5);
        shortQs.forEach(q => console.log(`  [${q._id}] "${q.question}"`));

        // 4. Inconsistent Topic Tags
        const tags = await PYQ.aggregate([
            { $match: { exam: 'UPSC' } },
            { $unwind: "$topicTags" },
            { $group: { _id: "$topicTags", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);
        console.log('\nTop 10 Topic Tags:');
        tags.forEach(t => console.log(`  "${t._id}": ${t.count}`));

    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.disconnect();
    }
}

auditData();
