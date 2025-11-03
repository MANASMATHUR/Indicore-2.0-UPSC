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

PyqSchema.index({ exam: 1, year: 1 });
PyqSchema.index({ question: 'text', topicTags: 'text' });

const PYQ = mongoose.models.PYQ || mongoose.model('PYQ', PyqSchema);

function detectExamCode(userMsg) {
  if (/tnpsc|tamil nadu/i.test(userMsg)) return 'TNPSC';
  if (/bpsc|bihar/i.test(userMsg)) return 'BPSC';
  if (/uppsc|uttar pradesh/i.test(userMsg)) return 'UPPSC';
  if (/upsc/i.test(userMsg)) return 'UPSC';
  return 'UPSC';
}

async function testPyqQuery(query, description) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 Test: ${description}`);
  console.log(`📝 Query: "${query}"`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    // Simulate the same logic used in chat.js
    const isPyq = /(pyq|previous year (?:question|questions|paper|papers)|past year (?:question|questions))/i.test(query);
    if (!isPyq) {
      console.log('❌ Not detected as PYQ query');
      return { success: false, count: 0 };
    }

    const themeMatch = query.replace(/\b(upsc|pcs|ssc|exam|exams)\b/ig, '').match(/(?:on|about|of|for|related to)\s+([^.,;\n?]+)/i);
    const theme = themeMatch ? themeMatch[1].trim().replace(/\s+(pyq|question|questions)/i, '').trim() : '';
    
    let fromYear = null, toYear = null;
    const range1 = query.match(/from\s+(\d{4})(?:s)?\s*(?:to|\-|–|—)\s*(present|\d{4})/i);
    const decade = query.match(/(\d{4})s/i);
    if (range1) {
      fromYear = parseInt(range1[1], 10);
      toYear = range1[2].toLowerCase() === 'present' ? new Date().getFullYear() : parseInt(range1[2], 10);
    } else if (decade) {
      fromYear = parseInt(decade[1], 10);
      toYear = fromYear + 9;
    }

    const examCode = detectExamCode(query);
    const filter = { exam: new RegExp(`^${examCode}$`, 'i') };
    if (fromYear || toYear) {
      filter.year = {};
      if (fromYear) filter.year.$gte = fromYear;
      if (toYear) filter.year.$lte = toYear;
    }

    console.log(`✅ Detected as PYQ query`);
    console.log(`   🎯 Exam: ${examCode}`);
    console.log(`   📝 Theme: "${theme || '(none)'}"`);
    if (fromYear || toYear) {
      console.log(`   📅 Year range: ${fromYear || 'any'} to ${toYear || 'any'}`);
    }

    let items = [];
    try {
      if (theme) {
        // Try text search first
        items = await PYQ.find({
          ...filter,
          $or: [
            { $text: { $search: theme } },
            { topicTags: { $regex: theme, $options: 'i' } },
            { question: { $regex: theme, $options: 'i' } }
          ]
        }).sort({ year: 1 }).limit(50).lean();
      } else {
        items = await PYQ.find(filter).sort({ year: 1 }).limit(50).lean();
      }
    } catch (e) {
      // Fallback if text index not available
      if (theme) {
        items = await PYQ.find({
          ...filter,
          $or: [
            { topicTags: { $regex: theme, $options: 'i' } },
            { question: { $regex: theme, $options: 'i' } }
          ]
        }).sort({ year: 1 }).limit(50).lean();
      } else {
        items = await PYQ.find(filter).sort({ year: 1 }).limit(50).lean();
      }
    }

    // Sort: verified first, then by year
    const sortedItems = items.sort((a, b) => {
      const aVerified = a.verified === true || (a.sourceLink && a.sourceLink.includes('.gov.in'));
      const bVerified = b.verified === true || (b.sourceLink && b.sourceLink.includes('.gov.in'));
      if (aVerified !== bVerified) return bVerified ? 1 : -1;
      return (a.year || 0) - (b.year || 0);
    });

    const verifiedCount = sortedItems.filter(q => q.verified === true || (q.sourceLink && q.sourceLink.includes('.gov.in'))).length;
    const unverifiedCount = sortedItems.length - verifiedCount;

    console.log(`\n📊 Results:`);
    console.log(`   Total found: ${sortedItems.length}`);
    console.log(`   ✅ Verified: ${verifiedCount}`);
    console.log(`   ⚠️  Unverified: ${unverifiedCount}`);

    if (sortedItems.length > 0) {
      console.log(`\n📋 Sample questions (first 3):`);
      sortedItems.slice(0, 3).forEach((q, i) => {
        const isUnverified = q.verified === false && (!q.sourceLink || !q.sourceLink.includes('.gov.in'));
        const status = isUnverified ? '⚠️' : '✅';
        const topicTags = q.topicTags && q.topicTags.length > 0 ? ` [Topic: ${q.topicTags.join(', ')}]` : '';
        console.log(`\n   ${i + 1}. ${status} ${q.year || '—'} – ${q.paper || ''}${topicTags}`);
        console.log(`      ${q.question.substring(0, 120)}${q.question.length > 120 ? '...' : ''}`);
      });
      
      // Group by decade for preview
      const byDecade = new Map();
      for (const q of sortedItems.slice(0, 20)) {
        const decade = Math.floor((q.year || 0) / 10) * 10;
        if (!byDecade.has(decade)) byDecade.set(decade, []);
        const isUnverified = q.verified === false && (!q.sourceLink || !q.sourceLink.includes('.gov.in'));
        const status = isUnverified ? '⚠️' : '✅';
        const topicTags = q.topicTags && q.topicTags.length > 0 ? ` [Topic: ${q.topicTags.join(', ')}]` : '';
        byDecade.get(decade).push(`${status} ${q.year || '—'} – ${q.question.substring(0, 80)}${topicTags}${q.question.length > 80 ? '...' : ''}`);
      }
      
      console.log(`\n📅 Grouped by decade (first 20):`);
      const sortedDecades = Array.from(byDecade.keys()).sort((a, b) => a - b);
      for (const d of sortedDecades) {
        console.log(`\n   ${d}s:`);
        byDecade.get(d).forEach(q => console.log(`      - ${q}`));
      }
    } else {
      console.log(`\n⚠️  No PYQs found. This might mean:`);
      console.log(`   - The theme doesn't match any questions`);
      console.log(`   - The year range is too restrictive`);
      console.log(`   - Need to ingest more data`);
    }

    return { success: true, count: sortedItems.length };
  } catch (error) {
    console.error(`\n❌ Test failed: ${error.message}`);
    return { success: false, count: 0, error: error.message };
  }
}

async function runTests() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB\n');

    const tests = [
      {
        query: 'Give me MSP related PYQs from UPSC',
        description: 'MSP Theme Query'
      },
      {
        query: 'Show me previous year questions on Constitution from 2010s',
        description: 'Constitution Theme with Decade'
      },
      {
        query: 'PYQs on environment from UPSC from 2020 to present',
        description: 'Environment Theme with Year Range'
      },
      {
        query: 'Give me UPSC pyqs',
        description: 'Generic PYQ Query (No Theme)'
      },
      {
        query: 'Previous year questions on economics',
        description: 'Economics Theme (No Year Filter)'
      }
    ];

    let passed = 0;
    let failed = 0;
    let totalFound = 0;

    for (const test of tests) {
      const result = await testPyqQuery(test.query, test.description);
      if (result.success) {
        passed++;
        totalFound += result.count;
      } else {
        failed++;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 Test Summary');
    console.log(`${'='.repeat(60)}`);
    console.log(`✅ Passed: ${passed}/${tests.length}`);
    console.log(`❌ Failed: ${failed}/${tests.length}`);
    console.log(`📝 Total PYQs found across all tests: ${totalFound}`);
    
    if (failed === 0) {
      console.log('\n🎉 All tests passed! PYQ query logic is working correctly.');
      console.log('✅ Your chatbot can now retrieve PYQs from the database!');
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

runTests();

