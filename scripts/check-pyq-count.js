import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGO_URI environment variable not found!');
  process.exit(1);
}

const PyqSchema = new mongoose.Schema({
  exam: String,
  level: String,
  paper: String,
  year: Number,
  question: String,
  topicTags: [String],
  sourceLink: String,
  verified: Boolean,
}, { timestamps: true });

const PYQ = mongoose.models.PYQ || mongoose.model('PYQ', PyqSchema);

async function checkCounts() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB\n');

    // Total count
    const total = await PYQ.countDocuments();
    console.log(`📊 Total PYQs: ${total.toLocaleString()}`);

    // Count by exam
    console.log('\n📝 Count by Exam:');
    const byExam = await PYQ.aggregate([
      { $group: { _id: '$exam', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    byExam.forEach(({ _id, count }) => {
      console.log(`   ${_id || '(no exam)'}: ${count.toLocaleString()}`);
    });

    // Count by verification status
    console.log('\n✅ Verification Status:');
    const verified = await PYQ.countDocuments({ verified: true });
    const unverified = await PYQ.countDocuments({ verified: false });
    console.log(`   Verified: ${verified.toLocaleString()}`);
    console.log(`   Unverified: ${unverified.toLocaleString()}`);

    // Count by year (top 10 years)
    console.log('\n📅 Top 10 Years:');
    const byYear = await PYQ.aggregate([
      { $match: { year: { $ne: null } } },
      { $group: { _id: '$year', count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
      { $limit: 10 }
    ]);
    byYear.forEach(({ _id, count }) => {
      console.log(`   ${_id}: ${count.toLocaleString()} questions`);
    });

    // Sample questions
    console.log('\n📋 Sample Questions (latest 3):');
    const samples = await PYQ.find()
      .sort({ createdAt: -1 })
      .limit(3)
      .select('exam year question verified topicTags')
      .lean();
    samples.forEach((q, i) => {
      console.log(`\n   ${i + 1}. [${q.exam || 'N/A'}] ${q.year || 'N/A'} ${q.verified ? '✅' : '⚠️'}`);
      console.log(`      ${q.question.substring(0, 100)}${q.question.length > 100 ? '...' : ''}`);
      if (q.topicTags && q.topicTags.length > 0) {
        console.log(`      Tags: ${q.topicTags.join(', ')}`);
      }
    });

    await mongoose.disconnect();
    console.log('\n✓ Done!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkCounts();

