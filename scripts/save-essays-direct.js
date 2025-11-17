import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!MONGODB_URI) {
  console.error('Error: MONGODB_URI environment variable is not set');
  process.exit(1);
}

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
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to database\n');

    let success = 0;
    let skipped = 0;
    let errors = 0;

    for (const { topic, letter, content } of essays) {
      try {
        const existing = await Essay.findOne({ topic: topic.trim() });
        if (existing) {
          console.log(`⏭️  Skipped: "${topic}" (exists)`);
          skipped++;
          continue;
        }

        const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
        const essay = await Essay.create({
          topic: topic.trim(),
          content,
          letter,
          wordCount,
          language: 'en',
          essayType: 'general',
          generatedBy: 'preset',
          generatedAt: new Date(),
          lastAccessedAt: new Date(),
          accessCount: 0
        });

        console.log(`✅ Saved: "${topic}" (${wordCount} words)`);
        success++;
      } catch (error) {
        if (error.code === 11000) {
          console.log(`⏭️  Skipped: "${topic}" (duplicate)`);
          skipped++;
        } else {
          console.log(`❌ Error: "${topic}" - ${error.message}`);
          errors++;
        }
      }
    }

    console.log(`\n✅ Saved: ${success} | ⏭️  Skipped: ${skipped} | ❌ Errors: ${errors}`);
    console.log(`📚 Total essays: ${await Essay.countDocuments({})}`);
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Read essays from file
import fs from 'fs';

const essaysFile = process.argv[2];
if (!essaysFile) {
  console.error('Usage: node scripts/save-essays-direct.js <essays.json>');
  process.exit(1);
}

try {
  const essaysData = fs.readFileSync(essaysFile, 'utf8');
  const essays = JSON.parse(essaysData);
  saveEssays(essays);
} catch (error) {
  console.error('Error reading/parsing file:', error.message);
  process.exit(1);
}

