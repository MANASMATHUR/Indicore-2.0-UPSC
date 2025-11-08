import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { detectLanguages, separateLanguages, isMultiLanguage, getPrimaryLanguage } from '../lib/languageDetector.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGO_URI environment variable not found!');
  process.exit(1);
}

// PYQ schema with language field
const PyqSchema = new mongoose.Schema({
  exam: String,
  level: String,
  paper: String,
  year: Number,
  question: String,
  answer: String,
  lang: String,
  topicTags: [String],
  theme: String,
  sourceLink: String,
  verified: Boolean,
}, { timestamps: true, strict: false });

const PYQ = mongoose.models.PYQ || mongoose.model('PYQ', PyqSchema);

async function separateMultiLanguageQuestions() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB\n');

    // Get total count
    const total = await PYQ.countDocuments();
    console.log(`📊 Total PYQs: ${total.toLocaleString()}\n`);

    if (total === 0) {
      console.log('No PYQs found in database.');
      process.exit(0);
    }

    let processed = 0;
    let separated = 0;
    let created = 0;
    let deleted = 0;
    let updated = 0;

    // Process in batches
    const batchSize = 500;
    const totalBatches = Math.ceil(total / batchSize);

    for (let batch = 0; batch < totalBatches; batch++) {
      const skip = batch * batchSize;
      const pyqs = await PYQ.find({}).skip(skip).limit(batchSize).lean();

      console.log(`Processing batch ${batch + 1}/${totalBatches} (${pyqs.length} items)...`);

      for (const pyq of pyqs) {
        processed++;
        
        const question = pyq.question || '';
        const answer = pyq.answer || '';
        
        // Check if question is multi-language
        const questionIsMulti = isMultiLanguage(question);
        const answerIsMulti = answer && isMultiLanguage(answer);
        const isMulti = questionIsMulti || answerIsMulti;

        if (isMulti) {
          separated++;
          
          // Separate question languages
          const questionSegments = separateLanguages(question);
          const answerSegments = answer ? separateLanguages(answer) : [{ language: 'en', text: '' }];

          // Create separate entries for each language
          if (questionSegments.length > 1) {
            // Delete original multi-language entry using collection.deleteOne directly
            await PYQ.collection.deleteOne({ _id: pyq._id });
            deleted++;

            // Create new entries for each language
            for (const qSegment of questionSegments) {
              // Try to match answer segment with same language
              const matchingAnswer = answerSegments.find(
                a => a.language === qSegment.language || 
                (qSegment.language === 'multi' && a.language !== 'multi')
              ) || answerSegments[0];

              try {
                // Use collection.insertOne directly to avoid text index language override issue
                await PYQ.collection.insertOne({
                  exam: pyq.exam,
                  level: pyq.level || '',
                  paper: pyq.paper || '',
                  year: pyq.year,
                  question: qSegment.text,
                  answer: matchingAnswer.text,
                  lang: qSegment.language,
                  topicTags: Array.isArray(pyq.topicTags) ? pyq.topicTags : [],
                  theme: pyq.theme || '',
                  sourceLink: pyq.sourceLink || '',
                  verified: Boolean(pyq.verified),
                  createdAt: new Date(),
                  updatedAt: new Date()
                });
                created++;
              } catch (e) {
                // Handle duplicate errors
                if (e.code === 11000) {
                  // Try to update existing entry using collection.updateOne directly
                  await PYQ.collection.updateOne(
                    {
                      exam: pyq.exam,
                      year: pyq.year,
                      question: { $regex: qSegment.text.substring(0, 50).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
                    },
                    {
                      $set: {
                        lang: qSegment.language,
                        answer: matchingAnswer.text,
                        updatedAt: new Date()
                      }
                    }
                  );
                  updated++;
                } else {
                  console.warn(`   ⚠️  Could not create PYQ: ${e.message}`);
                }
              }
            }
          } else {
            // Single segment but marked as multi-language, just update language field
            const primaryLanguage = getPrimaryLanguage(question);
            // Use collection.updateOne directly to avoid text index language override issue
            await PYQ.collection.updateOne(
              { _id: pyq._id },
              { $set: { lang: primaryLanguage, updatedAt: new Date() } }
            );
            updated++;
          }
        } else {
          // Single language, just set the language field
          const language = getPrimaryLanguage(question);
          if (pyq.lang !== language) {
            // Use collection.updateOne directly to avoid text index language override issue
            await PYQ.collection.updateOne(
              { _id: pyq._id },
              { $set: { lang: language, updatedAt: new Date() } }
            );
            updated++;
          }
        }
      }
    }

    console.log(`\n✅ Separation complete!`);
    console.log(`   Processed: ${processed.toLocaleString()}`);
    console.log(`   Multi-language found: ${separated.toLocaleString()}`);
    console.log(`   Created: ${created.toLocaleString()}`);
    console.log(`   Updated: ${updated.toLocaleString()}`);
    console.log(`   Deleted (merged): ${deleted.toLocaleString()}`);

    // Statistics by language
    const byLanguage = await PYQ.aggregate([
      { $group: { _id: '$lang', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    console.log(`\n📊 Statistics by Language:`);
    byLanguage.forEach(({ _id, count }) => {
      const langName = _id || 'unknown';
      console.log(`   ${langName}: ${count.toLocaleString()}`);
    });

    await mongoose.disconnect();
    console.log(`\n✅ Done!`);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

separateMultiLanguageQuestions();

