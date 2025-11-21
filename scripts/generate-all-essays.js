import mongoose from 'mongoose';
import axios from 'axios';
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

if (!process.env.PERPLEXITY_API_KEY) {
  console.error('Error: PERPLEXITY_API_KEY environment variable is not set');
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
  generatedBy: { type: String, enum: ['perplexity', 'manual', 'preset'], default: 'perplexity' },
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

const systemPrompt = `You are Indicore, an AI-powered essay writing specialist for competitive exams like UPSC, PCS, and SSC. You excel at writing comprehensive, well-structured essays that are:

1. **Well-Organized**: Clear introduction, body paragraphs with sub-points, and a strong conclusion
2. **Content-Rich**: Include relevant examples, data, facts, and current affairs
3. **Exam-Focused**: Written in a style suitable for competitive exam essay papers
4. **Balanced Perspective**: Present multiple viewpoints and balanced analysis
5. **Academic Language**: Use formal, academic vocabulary appropriate for competitive exams
6. **Comprehensive**: Cover all important aspects of the topic

**Essay Requirements:**
- Length: Approximately 1000-1500 words
- Structure: Introduction, Body (3-4 paragraphs), Conclusion
- Include relevant examples, case studies, and current affairs
- Use formal academic language
- Ensure logical flow and coherence
- Make it suitable for UPSC/PCS/SSC Mains examination`;

function createUserPrompt(topic) {
  return `Write a comprehensive essay on the topic: "${topic}"

**Requirements:**
- Write a complete, well-structured essay suitable for competitive exams (UPSC/PCS/SSC Mains)
- Include introduction, body paragraphs with sub-points, and conclusion
- Add relevant examples, data, and current affairs
- Use formal academic language
- Length: Approximately 1000-1500 words
- Ensure the essay is comprehensive, balanced, and exam-ready

**Essay Topic:** ${topic}

Please provide the complete essay text only, without any additional explanations or metadata.`;
}

async function generateEssay(topic, letter) {
  try {
    const userPrompt = createUserPrompt(topic);
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    let essayContent = '';

    const response = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      {
        model: 'sonar-pro',
        messages,
        max_tokens: 4000,
        temperature: 0.7,
        top_p: 0.9,
        stream: false
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 120000 // 2 minutes timeout
      }
    );

    essayContent = response.data?.choices?.[0]?.message?.content?.trim() || '';

    if (!essayContent) {
      throw new Error('AI provider returned an empty response');
    }
    const wordCount = essayContent.split(/\s+/).filter(word => word.length > 0).length;

    const essayData = {
      topic: topic.trim(),
      content: essayContent,
      letter: letter,
      wordCount: wordCount,
      language: 'en',
      essayType: 'general',
      generatedBy: 'perplexity',
      generatedAt: new Date(),
      lastAccessedAt: new Date(),
      accessCount: 0
    };

    // Use findOneAndUpdate with upsert to handle race conditions
    const essay = await Essay.findOneAndUpdate(
      { topic: topic.trim() },
      essayData,
      { upsert: true, new: true }
    );

    return { success: true, essay, wordCount };
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      if (status === 429) {
        return { success: false, error: 'RATE_LIMIT', message: 'Rate limit exceeded' };
      } else if (status === 401 || status === 402) {
        return { success: false, error: 'API_CREDITS', message: 'API credits exhausted' };
      } else if (status === 403) {
        return { success: false, error: 'API_PERMISSION', message: 'API permission denied' };
      }
      return { success: false, error: 'API_ERROR', message: error.response.data?.message || `HTTP ${status}` };
    }
    return { success: false, error: 'UNKNOWN', message: error.message };
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
    console.log('ESSAY GENERATION SCRIPT');
    console.log('='.repeat(80));
    console.log(`Total topics: ${allTopics.length}`);
    console.log(`Existing essays: ${existingEssays.length}`);
    console.log(`Missing essays: ${missingTopics.length}`);
    console.log('='.repeat(80));
    console.log('');

    if (missingTopics.length === 0) {
      console.log('✅ All essays are already generated!');
      await mongoose.connection.close();
      process.exit(0);
    }

    // Ask for confirmation
    console.log(`\n⚠️  This will generate ${missingTopics.length} essays using the Perplexity API.`);
    console.log('⚠️  This may take a significant amount of time and use API credits.');
    console.log('⚠️  Rate limits: ~20 requests per minute (will add delays between requests)\n');

    // Process with delays to avoid rate limits
    const DELAY_BETWEEN_REQUESTS = 3500; // 3.5 seconds between requests (allows ~17 requests/minute)
    const DELAY_ON_RATE_LIMIT = 60000; // 1 minute wait on rate limit

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    const errors = [];

    for (let i = 0; i < missingTopics.length; i++) {
      const { topic, letter } = missingTopics[i];
      const progress = `[${i + 1}/${missingTopics.length}]`;

      // Check if essay was created by another process
      const existing = await Essay.findOne({ topic: topic.trim() });
      if (existing) {
        console.log(`${progress} ⏭️  Skipped: "${topic}" (already exists)`);
        skippedCount++;
        continue;
      }

      console.log(`${progress} 📝 Generating: "${topic}"...`);

      const result = await generateEssay(topic, letter);

      if (result.success) {
        successCount++;
        console.log(`     ✅ Success! (${result.wordCount} words)`);
      } else {
        errorCount++;
        if (result.error === 'RATE_LIMIT') {
          console.log(`     ⚠️  Rate limit hit. Waiting ${DELAY_ON_RATE_LIMIT / 1000} seconds...`);
          await sleep(DELAY_ON_RATE_LIMIT);
          // Retry once
          console.log(`     🔄 Retrying: "${topic}"...`);
          const retryResult = await generateEssay(topic, letter);
          if (retryResult.success) {
            successCount++;
            errorCount--;
            console.log(`     ✅ Success on retry! (${retryResult.wordCount} words)`);
          } else {
            errors.push({ topic, error: retryResult.message });
            console.log(`     ❌ Failed: ${retryResult.message}`);
          }
        } else if (result.error === 'API_CREDITS') {
          console.log(`     ❌ API credits exhausted. Stopping generation.`);
          errors.push({ topic, error: 'API_CREDITS_EXHAUSTED' });
          break; // Stop if credits are exhausted
        } else {
          errors.push({ topic, error: result.message });
          console.log(`     ❌ Failed: ${result.message}`);
        }
      }

      // Add delay between requests (except for the last one)
      if (i < missingTopics.length - 1) {
        await sleep(DELAY_BETWEEN_REQUESTS);
      }
    }

    // Final summary
    console.log('\n' + '='.repeat(80));
    console.log('GENERATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`✅ Successfully generated: ${successCount}`);
    console.log(`⏭️  Skipped (already existed): ${skippedCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log(`📊 Total processed: ${successCount + skippedCount + errorCount}`);

    if (errors.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('FAILED ESSAYS');
      console.log('='.repeat(80));
      errors.forEach(({ topic, error }) => {
        console.log(`   - ${topic}: ${error}`);
      });
    }

    // Final count check
    const finalCount = await Essay.countDocuments({});
    console.log('\n' + '='.repeat(80));
    console.log(`📚 Total essays in database: ${finalCount} / ${allTopics.length}`);
    console.log(`📈 Coverage: ${((finalCount / allTopics.length) * 100).toFixed(1)}%`);
    console.log('='.repeat(80));

    await mongoose.connection.close();
    console.log('\nDatabase connection closed.');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n⚠️  Interrupted by user. Closing database connection...');
  await mongoose.connection.close();
  process.exit(0);
});

generateAllEssays();

