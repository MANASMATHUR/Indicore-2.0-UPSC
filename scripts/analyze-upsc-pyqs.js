import mongoose from 'mongoose';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath });
} else {
    dotenv.config();
}

import PYQ from '../models/PYQ.js';

async function analyze() {
    try {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI);
            console.log('✓ Connected to MongoDB');
        }

        console.log('\n📊 Analyzing UPSC PYQs...\n');

        const totalUPSC = await PYQ.countDocuments({ exam: 'UPSC' });
        console.log(`Total UPSC Questions: ${totalUPSC}`);

        // Group by Level
        const byLevel = await PYQ.aggregate([
            { $match: { exam: 'UPSC' } },
            { $group: { _id: '$level', count: { $sum: 1 } } }
        ]);

        console.log('\n--- By Level ---');
        byLevel.forEach(item => {
            console.log(`${item._id || '[Empty/Null]'}: ${item.count}`);
        });

        // Group by Paper (Top 20)
        const byPaper = await PYQ.aggregate([
            { $match: { exam: 'UPSC' } },
            { $group: { _id: '$paper', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 20 }
        ]);

        console.log('\n--- By Paper (Top 20) ---');
        byPaper.forEach(item => {
            console.log(`${item._id || '[Empty/Null]'}: ${item.count}`);
        });

        // Identify Potential Fixes
        console.log('\n--- Potential Fixes ---');
        const emptyLevel = byLevel.find(i => !i._id || i._id === '')?.count || 0;
        if (emptyLevel > 0) {
            console.log(`⚠️  ${emptyLevel} questions have no Level assigned.`);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n✓ Done');
    }
}

analyze();
