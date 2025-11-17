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

// Comprehensive essay template generator
function generateEssay(topic) {
  // This is a template-based generator that creates comprehensive essays
  // For actual implementation, this would use AI generation without API calls
  // For now, I'll create a structured template that can be filled
  
  const introduction = `The topic of "${topic}" stands as a cornerstone in understanding contemporary India's socio-economic, political, and cultural landscape. This subject encompasses multiple dimensions that are crucial for comprehensive analysis, particularly in the context of competitive examinations like UPSC, PCS, and SSC Mains. As India continues its journey towards becoming a developed nation, the significance of ${topic.toLowerCase()} becomes increasingly apparent in shaping policy frameworks, governance mechanisms, and societal transformation.`;

  const bodyParagraph1 = `From a historical perspective, ${topic.toLowerCase()} has evolved significantly over the decades. The foundational aspects of this domain can be traced back to India's independence movement and the subsequent constitutional framework. The framers of the Indian Constitution recognized the importance of ${topic.toLowerCase()} and incorporated relevant provisions to ensure its proper implementation. Over the years, various policy interventions, legislative measures, and administrative reforms have been introduced to strengthen this area. The journey has been marked by both achievements and challenges, reflecting the complex nature of governance and development in a diverse democracy like India.`;

  const bodyParagraph2 = `In the current scenario, ${topic.toLowerCase()} presents a dynamic landscape characterized by rapid changes and emerging challenges. Recent developments, including government initiatives, policy reforms, and technological interventions, have significantly impacted this domain. For instance, schemes like Digital India, Make in India, and various welfare programs have created new opportunities while also highlighting existing gaps. The integration of technology, data-driven governance, and citizen-centric approaches has transformed traditional methods of addressing issues related to ${topic.toLowerCase()}. However, challenges such as implementation gaps, resource constraints, and regional disparities continue to pose significant hurdles.`;

  const bodyParagraph3 = `The challenges and opportunities in ${topic.toLowerCase()} are multifaceted. On one hand, India's demographic dividend, technological advancement, and growing economy provide immense opportunities for progress. The increasing awareness among citizens, active civil society participation, and judicial interventions have created a conducive environment for positive change. On the other hand, issues such as bureaucratic inefficiencies, corruption, lack of coordination between different levels of government, and inadequate infrastructure continue to hamper effective implementation. The need for capacity building, skill development, and institutional strengthening remains critical. Additionally, ensuring equitable distribution of benefits across different sections of society, including marginalized communities, is essential for inclusive development.`;

  const bodyParagraph4 = `Looking ahead, the way forward for ${topic.toLowerCase()} requires a multi-pronged approach. First, there is a need for comprehensive policy reforms that address structural issues and create an enabling environment. Second, strengthening institutional mechanisms and improving governance structures will enhance effectiveness. Third, leveraging technology and innovation can provide solutions to traditional problems. Fourth, ensuring adequate financial resources and their efficient utilization is crucial. Fifth, building partnerships between government, private sector, and civil society can create synergies. Finally, continuous monitoring, evaluation, and course correction based on feedback and data will ensure that initiatives remain relevant and effective. The role of citizens as active participants rather than passive recipients is also crucial in this journey.`;

  const conclusion = `In conclusion, ${topic.toLowerCase()} represents a critical aspect of India's development narrative. While significant progress has been made, much remains to be accomplished. The path forward requires sustained commitment, innovative thinking, and collaborative efforts from all stakeholders. As India aspires to become a global leader and achieve its developmental goals, addressing challenges in ${topic.toLowerCase()} will be instrumental in realizing the vision of a prosperous, inclusive, and sustainable future. The journey is ongoing, and each step taken in the right direction brings the nation closer to its aspirations.`;

  const essayContent = `${introduction}\n\n${bodyParagraph1}\n\n${bodyParagraph2}\n\n${bodyParagraph3}\n\n${bodyParagraph4}\n\n${conclusion}`;
  
  return essayContent;
}

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
    const essay = await Essay.findOneAndUpdate(
      { topic: topic.trim() },
      essayData,
      { upsert: true, new: true }
    );
    return { success: true, essay, wordCount };
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key - essay already exists
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
    console.log('LOCAL ESSAY GENERATION (NO API CREDITS)');
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

    console.log(`📝 Generating ${missingTopics.length} essays locally (no API calls)...\n`);

    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors = [];

    for (let i = 0; i < missingTopics.length; i++) {
      const { topic, letter } = missingTopics[i];
      const progress = `[${i + 1}/${missingTopics.length}]`;

      console.log(`${progress} 📝 Generating: "${topic}"...`);

      const essayContent = generateEssay(topic);
      const result = await saveEssay(topic, letter, essayContent);

      if (result.success) {
        if (result.skipped) {
          skippedCount++;
          console.log(`     ⏭️  Skipped (already exists)`);
        } else {
          successCount++;
          console.log(`     ✅ Success! (${result.wordCount} words)`);
        }
      } else {
        errorCount++;
        errors.push({ topic, error: result.error });
        console.log(`     ❌ Failed: ${result.error}`);
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

