import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGO_URI environment variable not found!');
  process.exit(1);
}

// PYQ schema with answer field
const PyqSchema = new mongoose.Schema({
  exam: String,
  level: String,
  paper: String,
  year: Number,
  question: String,
  answer: String,
  topicTags: [String],
  theme: String,
  sourceLink: String,
  verified: Boolean,
}, { timestamps: true, strict: false });

const PYQ = mongoose.models.PYQ || mongoose.model('PYQ', PyqSchema);

// Check if there's a separate answers collection
async function checkForSeparateAnswersCollection() {
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  const answerCollectionNames = collections
    .map(c => c.name)
    .filter(name => 
      name.toLowerCase().includes('answer') && 
      name.toLowerCase() !== 'pyq'
    );
  
  return answerCollectionNames;
}

// Function to merge answers from a separate collection
async function mergeAnswersFromCollection(collectionName) {
  const db = mongoose.connection.db;
  const AnswerCollection = db.collection(collectionName);
  
  console.log(`\n📋 Processing collection: ${collectionName}`);
  const totalAnswers = await AnswerCollection.countDocuments();
  console.log(`   Total answers: ${totalAnswers.toLocaleString()}`);
  
  if (totalAnswers === 0) {
    console.log(`   ⚠️  Collection is empty, skipping...`);
    return { matched: 0, updated: 0, unmatched: 0 };
  }

  let matched = 0;
  let updated = 0;
  let unmatched = 0;

  // Process in batches
  const batchSize = 100;
  const totalBatches = Math.ceil(totalAnswers / batchSize);

  for (let batch = 0; batch < totalBatches; batch++) {
    const skip = batch * batchSize;
    const answers = await AnswerCollection.find({})
      .skip(skip)
      .limit(batchSize)
      .toArray();

    for (const answerDoc of answers) {
      // Try to match by question text (normalized)
      const normalizedQuestion = (answerDoc.question || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 200);

      // Try multiple matching strategies
      let matchedPYQ = null;

      // Strategy 1: Match by exact question text
      if (answerDoc.question) {
        matchedPYQ = await PYQ.findOne({
          question: new RegExp(answerDoc.question.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
        });
      }

      // Strategy 2: Match by exam, year, and partial question match
      if (!matchedPYQ && answerDoc.exam && answerDoc.year) {
        const exam = String(answerDoc.exam).toUpperCase().trim();
        const year = parseInt(answerDoc.year, 10);
        
        if (normalizedQuestion.length > 20) {
          const questionPrefix = normalizedQuestion.substring(0, 50);
          matchedPYQ = await PYQ.findOne({
            exam: exam,
            year: year,
            question: new RegExp(questionPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
          });
        }
      }

      // Strategy 3: Match by exam, year, paper, and level
      if (!matchedPYQ && answerDoc.exam && answerDoc.year) {
        const exam = String(answerDoc.exam).toUpperCase().trim();
        const year = parseInt(answerDoc.year, 10);
        const paper = answerDoc.paper ? String(answerDoc.paper).trim() : '';
        const level = answerDoc.level ? String(answerDoc.level).trim() : '';

        const filter = { exam, year };
        if (paper) filter.paper = new RegExp(paper.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        if (level) filter.level = new RegExp(level.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

        // Get all matching PYQs and try to match by question similarity
        const candidates = await PYQ.find(filter).limit(10).lean();
        
        if (candidates.length > 0 && normalizedQuestion.length > 20) {
          // Find the most similar question
          const questionPrefix = normalizedQuestion.substring(0, 50);
          matchedPYQ = candidates.find(pyq => {
            const pyqQuestion = (pyq.question || '').toLowerCase().substring(0, 50);
            return pyqQuestion.includes(questionPrefix) || questionPrefix.includes(pyqQuestion);
          });
          
          if (matchedPYQ) {
            matchedPYQ = await PYQ.findById(matchedPYQ._id);
          }
        }
      }

      if (matchedPYQ) {
        matched++;
        const answerText = String(answerDoc.answer || answerDoc.text || answerDoc.content || '').trim();
        
        if (answerText && answerText.length > 0) {
          // Only update if answer is not already set or if new answer is longer
          if (!matchedPYQ.answer || answerText.length > matchedPYQ.answer.length) {
            await PYQ.updateOne(
              { _id: matchedPYQ._id },
              { $set: { answer: answerText.substring(0, 10000) } }
            );
            updated++;
          }
        }
      } else {
        unmatched++;
        // If we can't match, create a new PYQ entry if we have enough info
        if (answerDoc.question && answerDoc.exam && answerDoc.year) {
          const answerText = String(answerDoc.answer || answerDoc.text || answerDoc.content || '').trim();
          try {
            await PYQ.create({
              exam: String(answerDoc.exam).toUpperCase().trim(),
              level: answerDoc.level ? String(answerDoc.level).trim() : '',
              paper: answerDoc.paper ? String(answerDoc.paper).trim() : '',
              year: parseInt(answerDoc.year, 10),
              question: String(answerDoc.question).trim().substring(0, 2000),
              answer: answerText.substring(0, 10000),
              topicTags: Array.isArray(answerDoc.topicTags) ? answerDoc.topicTags : [],
              theme: answerDoc.theme ? String(answerDoc.theme).trim() : '',
              sourceLink: answerDoc.sourceLink ? String(answerDoc.sourceLink).trim() : '',
              verified: Boolean(answerDoc.verified)
            });
            updated++;
            matched++; // Count as matched since we created it
            unmatched--; // Don't count as unmatched
          } catch (e) {
            // Ignore duplicate errors
            if (e.code !== 11000) {
              console.warn(`   ⚠️  Could not create PYQ: ${e.message}`);
            }
          }
        }
      }
    }

    if ((batch + 1) % 10 === 0) {
      console.log(`   Processed ${((batch + 1) * batchSize).toLocaleString()} / ${totalAnswers.toLocaleString()} answers...`);
    }
  }

  return { matched, updated, unmatched };
}

async function mergeAnswers() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB\n');

    // Check for separate answer collections
    const answerCollections = await checkForSeparateAnswersCollection();
    
    if (answerCollections.length === 0) {
      console.log('📊 No separate answer collections found.');
      console.log('   Checking if answers are stored in PYQ collection but not linked...\n');
      
      // Check if there are PYQs with answers but questions are separate
      const pyqsWithAnswers = await PYQ.countDocuments({ answer: { $exists: true, $ne: '' } });
      const pyqsWithoutAnswers = await PYQ.countDocuments({ 
        $or: [
          { answer: { $exists: false } },
          { answer: '' },
          { answer: null }
        ]
      });
      
      console.log(`   PYQs with answers: ${pyqsWithAnswers.toLocaleString()}`);
      console.log(`   PYQs without answers: ${pyqsWithoutAnswers.toLocaleString()}`);
      
      if (pyqsWithoutAnswers > 0) {
        console.log('\n   ℹ️  Some PYQs don\'t have answers. This is normal if answers are not available.');
      }
    } else {
      console.log(`📋 Found ${answerCollections.length} potential answer collection(s):`);
      answerCollections.forEach(name => console.log(`   - ${name}`));
      console.log('');

      let totalMatched = 0;
      let totalUpdated = 0;
      let totalUnmatched = 0;

      for (const collectionName of answerCollections) {
        const result = await mergeAnswersFromCollection(collectionName);
        totalMatched += result.matched;
        totalUpdated += result.updated;
        totalUnmatched += result.unmatched;
      }

      console.log(`\n✅ Merge complete!`);
      console.log(`   Matched: ${totalMatched.toLocaleString()}`);
      console.log(`   Updated: ${totalUpdated.toLocaleString()}`);
      console.log(`   Unmatched: ${totalUnmatched.toLocaleString()}`);
    }

    // Final statistics
    const totalPYQs = await PYQ.countDocuments();
    const pyqsWithAnswers = await PYQ.countDocuments({ 
      answer: { $exists: true, $ne: '', $ne: null } 
    });
    const pyqsWithoutAnswers = totalPYQs - pyqsWithAnswers;

    console.log(`\n📊 Final Statistics:`);
    console.log(`   Total PYQs: ${totalPYQs.toLocaleString()}`);
    console.log(`   With answers: ${pyqsWithAnswers.toLocaleString()} (${((pyqsWithAnswers / totalPYQs) * 100).toFixed(1)}%)`);
    console.log(`   Without answers: ${pyqsWithoutAnswers.toLocaleString()} (${((pyqsWithoutAnswers / totalPYQs) * 100).toFixed(1)}%)`);

    await mongoose.disconnect();
    console.log(`\n✅ Done!`);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

mergeAnswers();

