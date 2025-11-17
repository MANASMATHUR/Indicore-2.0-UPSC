import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import readline from 'readline';

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

async function saveEssay(topic, letter, content) {
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
      return { success: false, error: 'Essay already exists' };
    }

    const essay = await Essay.create(essayData);
    return { success: true, essay, wordCount };
  } catch (error) {
    if (error.code === 11000) {
      return { success: false, error: 'Essay already exists' };
    }
    return { success: false, error: error.message };
  }
}

async function saveEssayBatch(essays) {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected successfully!\n');

    let successCount = 0;
    let errorCount = 0;

    for (const { topic, letter, content } of essays) {
      console.log(`Saving: "${topic}"...`);
      const result = await saveEssay(topic, letter, content);
      
      if (result.success) {
        console.log(`✅ Saved: "${topic}" (${result.wordCount} words)`);
        successCount++;
      } else {
        console.log(`❌ Failed: "${topic}" - ${result.error}`);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log(`✅ Successfully saved: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    
    const finalCount = await Essay.countDocuments({});
    console.log(`📚 Total essays in database: ${finalCount}`);

    await mongoose.connection.close();
    console.log('\nDatabase connection closed.');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Export for use
export { saveEssay, saveEssayBatch, Essay, mongoose, MONGODB_URI };

// If called with essays as argument, save them
if (process.argv[2]) {
  try {
    const essays = JSON.parse(process.argv[2]);
    saveEssayBatch(essays);
  } catch (error) {
    console.error('Error: Invalid JSON format');
    process.exit(1);
  }
}

