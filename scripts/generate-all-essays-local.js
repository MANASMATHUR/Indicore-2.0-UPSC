import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Knowledge is embedded directly in this script
// No need to import - using structured knowledge from codebase

// Government Schemes (from exam-knowledge.js)
const governmentSchemes = {
  flagship: [
    { name: 'PM Kisan', year: '2019', key: 'Direct income support to farmers, ₹6000/year' },
    { name: 'Ayushman Bharat', year: '2018', key: 'Health insurance, ₹5 lakh coverage' },
    { name: 'Swachh Bharat', year: '2014', key: 'Open defecation free India' },
    { name: 'Digital India', year: '2015', key: 'Digital infrastructure and services' },
    { name: 'Make in India', year: '2014', key: 'Manufacturing and investment promotion' },
    { name: 'Skill India', year: '2015', key: 'Skill development and training' },
    { name: 'Startup India', year: '2016', key: 'Entrepreneurship promotion' },
    { name: 'Smart Cities', year: '2015', key: '100 smart cities development' }
  ],
  rural: [
    { name: 'MGNREGA', year: '2005', key: 'Employment guarantee, 100 days work' },
    { name: 'PM Awas Yojana', year: '2015', key: 'Housing for all by 2022' },
    { name: 'PM Gram Sadak Yojana', year: '2000', key: 'Rural road connectivity' },
    { name: 'Deen Dayal Upadhyaya Gram Jyoti Yojana', year: '2015', key: 'Rural electrification' }
  ],
  education: [
    { name: 'Samagra Shiksha', year: '2018', key: 'Integrated scheme for school education' },
    { name: 'PM Poshan', year: '2021', key: 'Mid-day meal scheme renamed' }
  ],
  health: [
    { name: 'National Health Mission', year: '2013', key: 'Healthcare access in rural areas' },
    { name: 'PM Matru Vandana Yojana', year: '2017', key: 'Maternity benefit scheme' },
    { name: 'Mission Indradhanush', year: '2014', key: 'Universal immunization program' }
  ],
  women: [
    { name: 'Beti Bachao Beti Padhao', year: '2015', key: 'Girl child education and protection' },
    { name: 'Sukanya Samriddhi Yojana', year: '2015', key: 'Girl child savings scheme' },
    { name: 'Ujjwala Yojana', year: '2016', key: 'Free LPG connections to women' }
  ]
};

// Constitutional Articles
const constitutionalArticles = {
  fundamentalRights: [
    { article: '14', title: 'Equality before law' },
    { article: '15', title: 'Prohibition of discrimination' },
    { article: '19', title: 'Freedom of speech' },
    { article: '21', title: 'Protection of life and personal liberty' },
    { article: '21A', title: 'Right to education' },
    { article: '25', title: 'Freedom of religion' },
    { article: '32', title: 'Right to constitutional remedies' }
  ],
  directivePrinciples: [
    { article: '39', title: 'Equal pay for equal work' },
    { article: '40', title: 'Organisation of village panchayats' },
    { article: '44', title: 'Uniform civil code' },
    { article: '48A', title: 'Protection of environment' },
    { article: '51A', title: 'Fundamental duties' }
  ]
};

// Essay topics
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

// Topic-specific knowledge mapping
const topicKnowledge = {
  'Agriculture & Rural Development': {
    schemes: ['PM Kisan', 'MGNREGA', 'PM Awas Yojana', 'PM Gram Sadak Yojana'],
    facts: ['Agriculture contributes 18-20% to GDP', '86% farmers are small and marginal', 'Green Revolution 1960s-70s', 'Food grain production: 330+ million tonnes'],
    keywords: ['Green Revolution', 'M.S. Swaminathan', 'PM-KISAN', 'PMFBY', 'PMKSY']
  },
  'Administrative Reforms': {
    schemes: ['Digital India', 'RTI Act 2005', 'DBT', 'e-NAM'],
    facts: ['First ARC 1966', 'Second ARC 2005', '73rd & 74th Amendments 1992', 'Aadhaar: 1.3 billion enrollments'],
    keywords: ['Right to Information', 'E-governance', 'Panchayati Raj', 'Lateral Entry']
  },
  'Fundamental Rights': {
    articles: ['14', '15', '19', '21', '21A', '25', '32'],
    cases: ['Kesavananda Bharati', 'Maneka Gandhi', 'KS Puttaswamy'],
    facts: ['Part III of Constitution', 'Justiciable rights', 'Article 32: Right to constitutional remedies']
  },
  'Constitutional Values': {
    articles: ['Preamble', '14', '15', '19', '21', '51A'],
    facts: ['Preamble: Sovereign, Socialist, Secular, Democratic, Republic', '42nd Amendment added Socialist, Secular', 'Fundamental Duties added in 1976'],
    keywords: ['Preamble', 'Basic Structure', 'Constitutional Morality']
  },
  'Digital India Initiative': {
    schemes: ['Digital India 2015', 'Aadhaar', 'UPI', 'GSTN', 'e-NAM'],
    facts: ['Launched 2015', 'Aadhaar: 1.3 billion enrollments', 'UPI transactions: Billions monthly', 'Common Service Centres'],
    keywords: ['Digital Infrastructure', 'E-governance', 'Digital Payments', 'Direct Benefit Transfer']
  },
  'Good Governance': {
    schemes: ['RTI Act', 'Lokpal Act', 'Digital India', 'DBT'],
    facts: ['Ease of Doing Business: 63rd rank 2019', 'Transparency and accountability', 'Citizen-centric services'],
    keywords: ['Transparency', 'Accountability', 'E-governance', 'Citizen Participation']
  },
  'Gender Equality & Women Empowerment': {
    schemes: ['Beti Bachao Beti Padhao', 'Sukanya Samriddhi Yojana', 'Ujjwala Yojana', 'PM Matru Vandana Yojana'],
    cases: ['Vishaka', 'Shayara Bano', 'Navtej Johar'],
    facts: ['Women reservation in Panchayats: 33%', 'Maternity Benefit Act 2017', 'Sexual Harassment Act 2013'],
    keywords: ['Gender Justice', 'Women Rights', 'Empowerment', 'Equality']
  },
  'Healthcare System': {
    schemes: ['Ayushman Bharat', 'National Health Mission', 'PM Matru Vandana Yojana', 'Mission Indradhanush'],
    facts: ['Ayushman Bharat: ₹5 lakh coverage', 'NHM 2013', 'Universal Health Coverage goal', 'Life expectancy: 70+ years'],
    keywords: ['Universal Health Coverage', 'Primary Healthcare', 'Health Insurance', 'Public Health']
  },
  'Education System Reforms': {
    schemes: ['Samagra Shiksha', 'PM Poshan', 'Right to Education Act 2009'],
    articles: ['21A'],
    facts: ['RTE Act 2009', 'Article 21A: Right to Education', 'NEP 2020', 'Gross Enrollment Ratio improving'],
    keywords: ['Right to Education', 'NEP 2020', 'Digital Education', 'Skill Development']
  },
  'Economic Development': {
    schemes: ['Make in India', 'Startup India', 'Skill India', 'GST'],
    facts: ['GDP growth: 6-7% average', 'GST implemented 2017', 'Make in India 2014', 'Startup India 2016'],
    keywords: ['GDP', 'GST', 'Economic Growth', 'Industrialization']
  },
  'Climate Change & Global Warming': {
    schemes: ['National Action Plan on Climate Change', 'International Solar Alliance'],
    facts: ['Paris Agreement 2015', 'Net Zero by 2070 target', 'Renewable energy capacity increasing', 'COP commitments'],
    keywords: ['Paris Agreement', 'Renewable Energy', 'Carbon Neutrality', 'Sustainable Development']
  },
  'Federalism in India': {
    articles: ['1', '245', '246', '356'],
    cases: ['SR Bommai'],
    facts: ['Quasi-federal structure', 'Union, State, Concurrent Lists', '15th Finance Commission', 'Cooperative federalism'],
    keywords: ['Federalism', 'Center-State Relations', 'Cooperative Federalism', 'Devolution']
  },
  'Social Justice & Equality': {
    articles: ['14', '15', '16', '17', '46'],
    schemes: ['MGNREGA', 'PM Awas Yojana', 'Reservation policies'],
    facts: ['Reservation: 50% cap (Indra Sawhney)', 'SC/ST/OBC reservations', 'Affirmative action'],
    keywords: ['Social Justice', 'Reservation', 'Affirmative Action', 'Equality']
  }
};

// Generate essay using structured knowledge
function generateEssay(topic, letter) {
  const knowledge = topicKnowledge[topic] || {};
  const topicLower = topic.toLowerCase();
  
  // Introduction
  let introduction = `The topic of "${topic}" represents a fundamental aspect of India's development trajectory and governance framework. This subject holds immense significance in the context of competitive examinations like UPSC, PCS, and SSC Mains, as it encompasses critical dimensions of India's socio-economic, political, and cultural landscape. `;
  
  if (knowledge.facts && knowledge.facts.length > 0) {
    introduction += `India's journey in this domain has been marked by significant milestones, including ${knowledge.facts[0]}. `;
  }
  
  introduction += `As India aspires to become a developed nation and achieve its developmental goals, understanding and addressing challenges related to ${topicLower} becomes crucial for comprehensive policy formulation and effective governance.`;

  // Body Paragraph 1: Historical/Constitutional Context
  let body1 = `From a historical and constitutional perspective, ${topicLower} has deep roots in India's governance structure. `;
  
  if (knowledge.articles && knowledge.articles.length > 0) {
    body1 += `The Indian Constitution provides the foundational framework through various provisions, including Article ${knowledge.articles[0]} which addresses ${knowledge.articles.length > 1 ? 'related aspects' : 'this domain'}. `;
  }
  
  if (knowledge.cases && knowledge.cases.length > 0) {
    body1 += `Landmark judicial pronouncements, such as the ${knowledge.cases[0]} case, have significantly shaped the interpretation and implementation of policies in this area. `;
  }
  
  body1 += `Post-independence, India has witnessed continuous evolution in this domain, with various policy interventions, legislative measures, and administrative reforms being introduced to strengthen the framework. The journey has been characterized by both achievements and challenges, reflecting the complex nature of governance in a diverse democracy like India.`;

  // Body Paragraph 2: Current Scenario and Government Initiatives
  let body2 = `In the contemporary context, ${topicLower} presents a dynamic landscape shaped by rapid changes and emerging opportunities. `;
  
  if (knowledge.schemes && knowledge.schemes.length > 0) {
    body2 += `Government initiatives have been instrumental in addressing various aspects. `;
    knowledge.schemes.slice(0, 3).forEach((scheme, idx) => {
      const schemeInfo = [...governmentSchemes.flagship, ...governmentSchemes.rural, ...governmentSchemes.education, ...governmentSchemes.health, ...governmentSchemes.women]
        .find(s => s.name === scheme || s.name.includes(scheme.split(' ')[0]));
      if (schemeInfo) {
        body2 += `The ${schemeInfo.name} scheme, launched in ${schemeInfo.year}, ${schemeInfo.key}. `;
      } else {
        body2 += `The ${scheme} initiative has created new opportunities. `;
      }
    });
  }
  
  body2 += `The integration of technology, data-driven governance, and citizen-centric approaches has transformed traditional methods. However, challenges such as implementation gaps, resource constraints, regional disparities, and coordination issues continue to pose significant hurdles in achieving desired outcomes.`;

  // Body Paragraph 3: Challenges and Opportunities
  let body3 = `The challenges and opportunities in ${topicLower} are multifaceted and interconnected. `;
  
  if (knowledge.facts && knowledge.facts.length > 1) {
    body3 += `Current data indicates that ${knowledge.facts[1]}, highlighting both the scale and complexity of the issues involved. `;
  }
  
  body3 += `On one hand, India's demographic dividend, technological advancement, growing economy, and increasing awareness among citizens provide immense opportunities for progress. Active civil society participation, judicial interventions, and policy reforms have created a conducive environment for positive change. `;
  
  body3 += `On the other hand, issues such as bureaucratic inefficiencies, inadequate infrastructure, lack of coordination between different levels of government, capacity constraints, and ensuring equitable distribution of benefits across different sections of society, including marginalized communities, continue to hamper effective implementation. The need for capacity building, skill development, institutional strengthening, and innovative solutions remains critical.`;

  // Body Paragraph 4: Way Forward
  let body4 = `Looking ahead, the way forward for ${topicLower} requires a comprehensive, multi-pronged approach. `;
  
  if (knowledge.keywords && knowledge.keywords.length > 0) {
    body4 += `Key focus areas include strengthening ${knowledge.keywords[0]}, enhancing ${knowledge.keywords.length > 1 ? knowledge.keywords[1] : 'implementation mechanisms'}, and ensuring ${knowledge.keywords.length > 2 ? knowledge.keywords[2] : 'effective governance'}. `;
  }
  
  body4 += `First, there is a need for comprehensive policy reforms that address structural issues and create an enabling environment. Second, strengthening institutional mechanisms and improving governance structures will enhance effectiveness and accountability. Third, leveraging technology and innovation can provide solutions to traditional problems and improve service delivery. Fourth, ensuring adequate financial resources and their efficient utilization is crucial for sustainable progress. Fifth, building partnerships between government, private sector, and civil society can create synergies and mobilize additional resources. `;
  
  body4 += `Finally, continuous monitoring, evaluation, and course correction based on feedback and data will ensure that initiatives remain relevant and effective. The role of citizens as active participants rather than passive recipients is also crucial in this journey towards inclusive and sustainable development.`;

  // Conclusion
  let conclusion = `In conclusion, ${topicLower} represents a critical aspect of India's development narrative and governance framework. While significant progress has been made through various initiatives, policy interventions, and institutional reforms, much remains to be accomplished. `;
  
  conclusion += `The path forward requires sustained commitment, innovative thinking, collaborative efforts from all stakeholders, and a focus on inclusive and sustainable development. As India aspires to become a global leader and achieve its developmental goals, addressing challenges and leveraging opportunities in ${topicLower} will be instrumental in realizing the vision of a prosperous, inclusive, and sustainable future. `;
  
  conclusion += `The journey is ongoing, and each step taken in the right direction, supported by evidence-based policies and effective implementation, brings the nation closer to its aspirations of comprehensive development and good governance.`;

  const essay = `${introduction}\n\n${body1}\n\n${body2}\n\n${body3}\n\n${body4}\n\n${conclusion}`;
  
  return essay;
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
    console.log('LOCAL ESSAY GENERATION (NO API - USING CODEBASE KNOWLEDGE)');
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

    console.log(`📝 Generating ${missingTopics.length} essays using structured knowledge...\n`);

    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
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

      try {
        const essayContent = generateEssay(topic, letter);
        const wordCount = essayContent.split(/\s+/).filter(word => word.length > 0).length;

        const essayData = {
          topic: topic.trim(),
          content: essayContent,
          letter: letter,
          wordCount: wordCount,
          language: 'en',
          essayType: 'general',
          generatedBy: 'preset',
          generatedAt: new Date(),
          lastAccessedAt: new Date(),
          accessCount: 0
        };

        const essay = await Essay.create(essayData);
        console.log(`     ✅ Success! (${wordCount} words)`);
        successCount++;
      } catch (error) {
        if (error.code === 11000) {
          console.log(`     ⏭️  Skipped (duplicate)`);
          skippedCount++;
        } else {
          errors.push({ topic, error: error.message });
          console.log(`     ❌ Failed: ${error.message}`);
          errorCount++;
        }
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

