import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

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

// Essay topics from app/essay-builder/page.js
const essayTopics = [
  { letter: 'A', topics: ['Agriculture & Rural Development', 'Administrative Reforms', 'Arts & Culture', 'Awards & Honours', 'Accountability in Governance'] },
  { letter: 'B', topics: ['Banking & Finance', 'Biotechnology', 'Budget & Fiscal Policy', 'Biodiversity Conservation', 'Basic Rights & Duties'] },
  { letter: 'C', topics: ['Climate Change & Global Warming', 'Constitutional Values', 'Current Affairs Analysis', 'Cyber Security', 'Cooperative Federalism'] },
  { letter: 'D', topics: ['Democracy & Democratic Values', 'Development & Growth', 'Digital India Initiative', 'Disaster Management', 'Defense & National Security'] },
  { letter: 'E', topics: ['Economic Development', 'Education System Reforms', 'Environmental Conservation', 'Ethics in Public Life', 'Energy Security'] },
  { letter: 'F', topics: ['Federalism in India', 'Financial Inclusion', 'Foreign Policy & Diplomacy', 'Fundamental Rights', 'Food Security'] },
  { letter: 'G', topics: ['Good Governance', 'Globalization & Its Impact', 'Gender Equality & Women Empowerment', 'Geographical Diversity', 'Green Energy Transition'] },
  { letter: 'H', topics: ['Healthcare System', 'Historical Perspectives', 'Human Rights', 'Hunger & Malnutrition', 'Housing for All'] },
  { letter: 'I', topics: ['Indian Society & Social Change', 'International Relations', 'Innovation & Technology', 'Infrastructure Development', 'Industrial Policy'] },
  { letter: 'J', topics: ['Judicial Reforms', 'Justice & Equality', 'Job Creation & Employment', 'Journalism & Media Ethics'] },
  { letter: 'K', topics: ['Knowledge Economy', 'Kisan Welfare', 'Knowledge Society'] },
  { letter: 'L', topics: ['Legal Reforms', 'Literacy & Education', 'Local Self-Governance', 'Land Reforms & Agriculture'] },
  { letter: 'M', topics: ['Migration & Urbanization', 'Media & Democracy', 'Modernization vs Tradition', 'Monetary Policy', 'Multiculturalism in India'] },
  { letter: 'N', topics: ['National Integration', 'National Security', 'Natural Resource Management', 'Nuclear Energy Policy'] },
  { letter: 'O', topics: ['Opportunity & Equality', 'Organizational Structure', 'Oil & Energy Security', 'Outer Space Exploration'] },
  { letter: 'P', topics: ['Political System', 'Poverty Alleviation', 'Population Policy', 'Public Health System', 'Parliamentary Democracy'] },
  { letter: 'Q', topics: ['Quality in Education', 'Quantum Technology', 'Quality of Life'] },
  { letter: 'R', topics: ['Reforms & Modernization', 'Rural Development', 'Regionalism & Nationalism', 'Religious Harmony', 'Research & Development'] },
  { letter: 'S', topics: ['Science & Technology Development', 'Social Justice & Equality', 'Sustainable Development Goals', 'Sports & National Pride', 'Security Challenges'] },
  { letter: 'T', topics: ['Technology & Society', 'Trade & Commerce', 'Transport Infrastructure', 'Tourism Development', 'Terrorism & Security'] },
  { letter: 'U', topics: ['Urban Development', 'Unemployment & Skill Development', 'Universal Basic Income', 'United Nations & Global Governance'] },
  { letter: 'V', topics: ['Values & Ethics', 'Voting & Democracy', 'Village Economy', 'Vaccination & Public Health'] },
  { letter: 'W', topics: ['Women Empowerment', 'Water Resource Management', 'Welfare Schemes', 'World Peace & Cooperation'] },
  { letter: 'X', topics: ['Xenophobia & Inclusivity'] },
  { letter: 'Y', topics: ['Youth & Nation Building', 'Yoga & Wellness', 'Yearly Development Goals'] },
  { letter: 'Z', topics: ['Zero Tolerance Policy', 'Zonal Development'] }
];

// This script will be used to generate essays interactively
// The actual essay generation will be done through AI assistance
// This script provides the framework to save essays to database

async function saveEssay(topic, letter, content) {
  const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
  
  if (wordCount < 800) {
    console.warn(`     ⚠️  Warning: Essay is only ${wordCount} words (recommended: 1000-1500)`);
  }
  
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
    const essay = await Essay.findOneAndUpdate(
      { topic: topic.trim() },
      essayData,
      { upsert: true, new: true }
    );
    return { success: true, essay, wordCount };
  } catch (error) {
    if (error.code === 11000) {
      return { success: true, skipped: true, wordCount: 0 };
    }
    return { success: false, error: error.message };
  }
}

async function generateAllEssays() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected successfully!\n');

    // Flatten all topics
    const allTopics = [];
    essayTopics.forEach(section => {
      section.topics.forEach(topic => {
        allTopics.push({ topic: topic.trim(), letter: section.letter });
      });
    });

    // Get existing essays
    const existingEssays = await Essay.find({}).select('topic').lean();
    const existingTopicsSet = new Set(existingEssays.map(e => e.topic.trim()));

    // Find missing topics
    const missingTopics = allTopics.filter(({ topic }) => !existingTopicsSet.has(topic));

    console.log('='.repeat(80));
    console.log('ESSAY GENERATION FRAMEWORK');
    console.log('='.repeat(80));
    console.log(`Total topics: ${allTopics.length}`);
    console.log(`Existing essays: ${existingEssays.length}`);
    console.log(`Missing essays: ${missingTopics.length}`);
    console.log('='.repeat(80));
    console.log('\n⚠️  This script provides the framework for saving essays.');
    console.log('⚠️  Essays should be generated with accurate, exam-specific content.');
    console.log('⚠️  Use this script with AI assistance to generate essays one by one.\n');

    if (missingTopics.length === 0) {
      console.log('✅ All essays are already generated!');
      await mongoose.connection.close();
      process.exit(0);
    }

    console.log(`\n📝 Missing essays (${missingTopics.length}):\n`);
    missingTopics.forEach(({ topic, letter }, index) => {
      console.log(`${index + 1}. [${letter}] ${topic}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('TO USE THIS SCRIPT:');
    console.log('='.repeat(80));
    console.log('1. Generate essays using AI assistance (one by one or in batches)');
    console.log('2. Each essay should be:');
    console.log('   - 1000-1500 words');
    console.log('   - Exam-specific with accurate facts');
    console.log('   - Well-structured (Introduction, Body, Conclusion)');
    console.log('   - Include real examples, data, and current affairs');
    console.log('   - No hallucinations or made-up facts');
    console.log('3. Use the saveEssay() function to save each essay');
    console.log('='.repeat(80));

    await mongoose.connection.close();
    console.log('\nDatabase connection closed.');
    console.log('\n💡 Tip: Generate essays interactively and save them using this framework.');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Export functions for use in interactive generation
export { saveEssay, Essay, essayTopics, mongoose, MONGODB_URI };

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n⚠️  Interrupted by user. Closing database connection...');
  await mongoose.connection.close();
  process.exit(0);
});

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateAllEssays();
}

