
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;

const PyqSchema = new mongoose.Schema({
    exam: String,
    question: String,
    lang: String,
    year: Number
}, { strict: false });

const PYQ = mongoose.models.PYQ || mongoose.model('PYQ', PyqSchema);

async function fix() {
    try {
        console.log('Connecting...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected.');

        const tamilRegex = /[\u0B80-\u0BFF]/;

        // 1. Find based on Language 'ta' and Exam 'UPSC'
        const docs1 = await PYQ.find({ exam: 'UPSC', lang: 'ta' });
        console.log(`Docs with lang='ta' found: ${docs1.length}`);

        for (const doc of docs1) {
            doc.exam = 'TNPSC';
            await doc.save();
        }
        console.log('Updated lang=ta docs.');

        // 2. Find based on Tamil characters
        const docs2 = await PYQ.find({ exam: 'UPSC', question: { $regex: tamilRegex } });
        console.log(`Docs with Tamil text found: ${docs2.length}`);

        for (const doc of docs2) {
            doc.exam = 'TNPSC';
            doc.lang = 'ta';
            await doc.save();
        }
        console.log('Updated Tamil text docs.');

        const remaining = await PYQ.countDocuments({
            exam: 'UPSC',
            $or: [
                { lang: 'ta' },
                { question: { $regex: tamilRegex } }
            ]
        });
        console.log(`Remaining incorrect: ${remaining}`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
        console.log('Disconnected');
    }
}

fix();
