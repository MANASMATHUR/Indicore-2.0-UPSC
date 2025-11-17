import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!MONGODB_URI) {
  console.error('Error: MONGODB_URI environment variable is not set');
  process.exit(1);
}

// Essay Schema
const essaySchema = new mongoose.Schema({
  topic: { type: String, required: true, unique: true, index: true },
  content: { type: String, required: true },
  letter: { type: String, required: true, index: true },
  wordCount: { type: Number, default: 0 },
  language: { type: String, default: 'en' },
  essayType: { type: String, default: 'general' },
  generatedBy: { type: String, enum: ['perplexity', 'manual', 'preset'], default: 'preset' },
  generatedAt: { type: Date, default: Date.now },
  lastAccessedAt: { type: Date, default: Date.now },
  accessCount: { type: Number, default: 0 }
}, { timestamps: true });

const Essay = mongoose.models.Essay || mongoose.model('Essay', essaySchema);

async function saveEssays(essays) {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected successfully!\n');

    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const { topic, letter, content } of essays) {
      const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
      
      const essayData = {
        topic: topic.trim(),
        content: content,
        letter: letter,
        wordCount: wordCount,
        language: 'en',
        essayType: 'general',
        generatedBy: 'preset',
        generatedAt: new Date(),
        lastAccessedAt: new Date(),
        accessCount: 0
      };

      try {
        const existing = await Essay.findOne({ topic: topic.trim() });
        if (existing) {
          console.log(`⏭️  Skipped: "${topic}" (already exists)`);
          skippedCount++;
          continue;
        }

        const essay = await Essay.create(essayData);
        console.log(`✅ Saved: "${topic}" (${wordCount} words)`);
        successCount++;
      } catch (error) {
        if (error.code === 11000) {
          console.log(`⏭️  Skipped: "${topic}" (duplicate)`);
          skippedCount++;
        } else {
          console.log(`❌ Error saving "${topic}": ${error.message}`);
          errors.push({ topic, error: error.message });
          errorCount++;
        }
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('SAVE SUMMARY');
    console.log('='.repeat(80));
    console.log(`✅ Successfully saved: ${successCount}`);
    console.log(`⏭️  Skipped: ${skippedCount}`);
    console.log(`❌ Failed: ${errorCount}`);

    if (errors.length > 0) {
      console.log('\nErrors:');
      errors.forEach(({ topic, error }) => {
        console.log(`   - ${topic}: ${error}`);
      });
    }

    const finalCount = await Essay.countDocuments({});
    console.log(`\n📚 Total essays in database: ${finalCount}`);

    await mongoose.connection.close();
    console.log('\nDatabase connection closed.');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Read essays from command line argument (JSON file)
const essaysFile = process.argv[2];
if (!essaysFile) {
  console.error('Usage: node scripts/save-essay-batch.js <essays.json>');
  process.exit(1);
}

try {
  const essaysData = JSON.parse(fs.readFileSync(essaysFile, 'utf8'));
  saveEssays(essaysData);
} catch (error) {
  console.error('Error reading essays file:', error.message);
  process.exit(1);
}

