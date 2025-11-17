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

// Essay Schema (simplified for querying)
const essaySchema = new mongoose.Schema({
  topic: { type: String, required: true, unique: true, index: true },
  content: { type: String, required: true },
  letter: { type: String, required: true, index: true }
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

async function checkEssayCoverage() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected successfully!\n');

    // Flatten all topics into a single array with their letters
    const allTopics = [];
    essayTopics.forEach(section => {
      section.topics.forEach(topic => {
        allTopics.push({ topic: topic.trim(), letter: section.letter });
      });
    });

    console.log(`Total topics listed on website: ${allTopics.length}\n`);

    // Get all existing essays from database
    const existingEssays = await Essay.find({}).select('topic letter').lean();
    const existingTopicsSet = new Set(existingEssays.map(e => e.topic.trim()));

    console.log(`Total presaved essays in database: ${existingEssays.length}\n`);

    // Find missing essays
    const missingEssays = [];
    const existingEssaysList = [];

    allTopics.forEach(({ topic, letter }) => {
      if (existingTopicsSet.has(topic)) {
        existingEssaysList.push({ topic, letter });
      } else {
        missingEssays.push({ topic, letter });
      }
    });

    // Group missing essays by letter
    const missingByLetter = {};
    missingEssays.forEach(({ topic, letter }) => {
      if (!missingByLetter[letter]) {
        missingByLetter[letter] = [];
      }
      missingByLetter[letter].push(topic);
    });

    // Group existing essays by letter
    const existingByLetter = {};
    existingEssaysList.forEach(({ topic, letter }) => {
      if (!existingByLetter[letter]) {
        existingByLetter[letter] = [];
      }
      existingByLetter[letter].push(topic);
    });

    // Print summary
    console.log('='.repeat(80));
    console.log('ESSAY COVERAGE SUMMARY');
    console.log('='.repeat(80));
    console.log(`\n✅ Topics with presaved essays: ${existingEssaysList.length}`);
    console.log(`❌ Topics missing presaved essays: ${missingEssays.length}`);
    console.log(`📊 Coverage: ${((existingEssaysList.length / allTopics.length) * 100).toFixed(1)}%\n`);

    if (missingEssays.length > 0) {
      console.log('='.repeat(80));
      console.log('MISSING ESSAYS BY LETTER');
      console.log('='.repeat(80));
      Object.keys(missingByLetter).sort().forEach(letter => {
        console.log(`\n📝 Letter ${letter} (${missingByLetter[letter].length} missing):`);
        missingByLetter[letter].forEach(topic => {
          console.log(`   - ${topic}`);
        });
      });
    }

    // Check for essays in database that aren't in the website list
    const extraEssays = existingEssays.filter(e => {
      const topic = e.topic.trim();
      return !allTopics.some(t => t.topic === topic);
    });

    if (extraEssays.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('EXTRA ESSAYS IN DATABASE (not listed on website)');
      console.log('='.repeat(80));
      extraEssays.forEach(e => {
        console.log(`   - ${e.topic} (Letter: ${e.letter})`);
      });
    }

    // Detailed breakdown by letter
    console.log('\n' + '='.repeat(80));
    console.log('DETAILED BREAKDOWN BY LETTER');
    console.log('='.repeat(80));
    essayTopics.forEach(section => {
      const total = section.topics.length;
      const existing = existingEssaysList.filter(e => e.letter === section.letter).length;
      const missing = missingEssays.filter(m => m.letter === section.letter).length;
      const percentage = total > 0 ? ((existing / total) * 100).toFixed(1) : 0;
      const status = existing === total ? '✅' : existing > 0 ? '⚠️' : '❌';
      
      console.log(`\n${status} Letter ${section.letter}: ${existing}/${total} essays (${percentage}%)`);
      if (missing > 0) {
        console.log(`   Missing: ${missing}`);
      }
    });

    console.log('\n' + '='.repeat(80));
    console.log('ANALYSIS COMPLETE');
    console.log('='.repeat(80));

    await mongoose.connection.close();
    console.log('\nDatabase connection closed.');
    process.exit(0);
  } catch (error) {
    console.error('Error checking essay coverage:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

checkEssayCoverage();

