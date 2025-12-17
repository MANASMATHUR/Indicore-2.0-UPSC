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

async function inspectPrelimsNoOptions() {
    try {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI);
        }

        const count = await PYQ.countDocuments({
            exam: 'UPSC',
            level: 'Prelims',
            $or: [{ options: { $exists: false } }, { options: { $size: 0 } }]
        });

        console.log(`\n'Prelims' Questions with NO Options: ${count}\n`);

        if (count > 0) {
            const samples = await PYQ.find({
                exam: 'UPSC',
                level: 'Prelims',
                $or: [{ options: { $exists: false } }, { options: { $size: 0 } }]
            }).limit(10);

            samples.forEach((q, i) => {
                console.log(`\n[${i + 1}] ${q.question.substring(0, 100)}...`);
                console.log(`    Paper: ${q.paper}`);
                console.log(`    Year: ${q.year}`);
            });
        }

    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.disconnect();
    }
}

inspectPrelimsNoOptions();
