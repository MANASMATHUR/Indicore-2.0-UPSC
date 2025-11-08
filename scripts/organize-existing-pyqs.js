// Script to organize existing scattered PYQs in MongoDB
// This script updates existing PYQs with proper themes, papers, and organization

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../.env.local') });

import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGO_URI environment variable is not set!');
  process.exit(1);
}

const PyqSchema = new mongoose.Schema({
  exam: { type: String, index: true },
  level: { type: String },
  paper: { type: String },
  year: { type: Number, index: true },
  question: { type: String, required: true },
  topicTags: { type: [String], index: true },
  theme: { type: String, index: true },
  sourceLink: { type: String },
  verified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

const PYQ = mongoose.models.PYQ || mongoose.model('PYQ', PyqSchema);

// Theme inference function (same as in themes.js)
function inferThemeFromQuestion(question, paper, level) {
  const questionLower = question.toLowerCase();
  const paperUpper = (paper || '').toUpperCase();
  
  const themePatterns = {
    'GS-1': {
      'role of women': 'Role of Women in History',
      'women': 'Role of Women in History',
      'freedom struggle': 'Freedom Struggle',
      'indian national movement': 'Indian National Movement',
      'gandhi': 'Gandhian Phase',
      'social reform': 'Social Reform Movement',
      'british': 'British Rule in India',
      'ancient': 'Ancient India',
      'medieval': 'Medieval India',
      'modern': 'Modern India',
      'geography': 'Geography',
      'climate': 'Climate and Geography',
      'culture': 'Indian Culture and Heritage',
      'art': 'Art and Architecture',
      'literature': 'Literature',
      'heritage': 'Indian Heritage'
    },
    'GS-2': {
      'constitution': 'Constitution',
      'governance': 'Governance',
      'polity': 'Indian Polity',
      'federalism': 'Federalism',
      'judiciary': 'Judiciary',
      'parliament': 'Parliament',
      'executive': 'Executive',
      'rights': 'Fundamental Rights',
      'directive principles': 'Directive Principles',
      'international relations': 'International Relations',
      'foreign policy': 'Foreign Policy',
      'social justice': 'Social Justice',
      'welfare': 'Welfare Schemes',
      'panchayati raj': 'Local Governance',
      'election': 'Electoral System'
    },
    'GS-3': {
      'economy': 'Indian Economy',
      'economic': 'Indian Economy',
      'technology': 'Science and Technology',
      'science': 'Science and Technology',
      'security': 'Internal Security',
      'disaster': 'Disaster Management',
      'environment': 'Environment and Ecology',
      'biodiversity': 'Biodiversity',
      'agriculture': 'Agriculture',
      'industry': 'Industry',
      'infrastructure': 'Infrastructure',
      'banking': 'Banking and Finance',
      'monetary policy': 'Monetary Policy',
      'fiscal policy': 'Fiscal Policy'
    },
    'GS-4': {
      'ethics': 'Ethics',
      'integrity': 'Integrity',
      'aptitude': 'Aptitude',
      'case study': 'Case Studies',
      'values': 'Values',
      'attitude': 'Attitude',
      'emotional intelligence': 'Emotional Intelligence',
      'public service': 'Public Service',
      'moral': 'Moral Philosophy'
    },
    'PRELIMS': {
      'current affairs': 'Current Affairs',
      'history': 'History',
      'geography': 'Geography',
      'polity': 'Polity',
      'economy': 'Economy',
      'science': 'Science and Technology',
      'environment': 'Environment',
      'csat': 'CSAT',
      'comprehension': 'Reading Comprehension',
      'reasoning': 'Logical Reasoning',
      'aptitude': 'Aptitude'
    }
  };

  let patterns = {};
  if (paperUpper.includes('GS-1') || paperUpper.includes('GS1')) {
    patterns = themePatterns['GS-1'] || {};
  } else if (paperUpper.includes('GS-2') || paperUpper.includes('GS2')) {
    patterns = themePatterns['GS-2'] || {};
  } else if (paperUpper.includes('GS-3') || paperUpper.includes('GS3')) {
    patterns = themePatterns['GS-3'] || {};
  } else if (paperUpper.includes('GS-4') || paperUpper.includes('GS4')) {
    patterns = themePatterns['GS-4'] || {};
  } else if (level === 'Prelims') {
    patterns = themePatterns['PRELIMS'] || {};
  } else {
    patterns = {
      ...themePatterns['GS-1'],
      ...themePatterns['GS-2'],
      ...themePatterns['GS-3'],
      ...themePatterns['PRELIMS']
    };
  }
  
  for (const [pattern, theme] of Object.entries(patterns)) {
    if (questionLower.includes(pattern)) {
      return theme;
    }
  }
  
  return null;
}

// Identify paper from question content and existing data
function identifyPaper(question, existingPaper, level, topicTags) {
  // If paper already exists and looks valid, keep it
  if (existingPaper && existingPaper.trim()) {
    const paperUpper = existingPaper.toUpperCase();
    if (paperUpper.includes('GS-') || paperUpper.includes('ESSAY') || 
        paperUpper.includes('CSAT') || paperUpper.includes('PAPER')) {
      return existingPaper;
    }
  }
  
  const questionLower = question.toLowerCase();
  const tagsLower = (topicTags || []).join(' ').toLowerCase();
  const allText = questionLower + ' ' + tagsLower;
  
  // Identify from question content
  if (level === 'Prelims') {
    if (allText.includes('csat') || allText.includes('comprehension') || allText.includes('reasoning')) {
      return 'CSAT';
    }
    return 'GS Paper I';
  }
  
  // Mains papers
  if (allText.includes('essay') || allText.includes('philosophy') || allText.includes('society')) {
    return 'Essay';
  }
  if (allText.includes('ethics') || allText.includes('integrity') || allText.includes('aptitude') || allText.includes('case study')) {
    return 'GS-4';
  }
  if (allText.includes('economy') || allText.includes('economic') || allText.includes('technology') || allText.includes('security') || allText.includes('disaster')) {
    return 'GS-3';
  }
  if (allText.includes('constitution') || allText.includes('governance') || allText.includes('polity') || allText.includes('judiciary') || allText.includes('international relations')) {
    return 'GS-2';
  }
  if (allText.includes('history') || allText.includes('geography') || allText.includes('culture') || allText.includes('heritage') || allText.includes('art')) {
    return 'GS-1';
  }
  
  return existingPaper || null;
}

// Identify level from question and existing data
function identifyLevel(question, existingLevel, paper, topicTags) {
  if (existingLevel && (existingLevel === 'Prelims' || existingLevel === 'Mains')) {
    return existingLevel;
  }
  
  const questionLower = question.toLowerCase();
  const paperUpper = (paper || '').toUpperCase();
  
  if (paperUpper.includes('CSAT') || paperUpper.includes('PRELIM')) {
    return 'Prelims';
  }
  
  if (paperUpper.includes('GS-') || paperUpper.includes('ESSAY') || paperUpper.includes('OPTIONAL')) {
    return 'Mains';
  }
  
  // Try to infer from question content
  if (questionLower.includes('multiple choice') || questionLower.includes('mcq') || questionLower.includes('select the correct')) {
    return 'Prelims';
  }
  
  if (questionLower.includes('discuss') || questionLower.includes('explain') || questionLower.includes('analyze') || questionLower.includes('critically examine')) {
    return 'Mains';
  }
  
  return existingLevel || 'Mains'; // Default to Mains
}

async function main() {
  console.log('🚀 Starting PYQ Organization Script...\n');
  
  await mongoose.connect(MONGODB_URI, { bufferCommands: false });
  console.log('✅ Connected to MongoDB\n');
  
  // Get all UPSC PYQs
  const allPyqs = await PYQ.find({ exam: 'UPSC' });
  console.log(`📊 Found ${allPyqs.length} UPSC PYQs to organize\n`);
  
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  
  for (let i = 0; i < allPyqs.length; i++) {
    const pyq = allPyqs[i];
    
    if ((i + 1) % 100 === 0) {
      console.log(`  Processing ${i + 1}/${allPyqs.length}...`);
    }
    
    try {
      const question = pyq.question || '';
      if (!question || question.length < 15) {
        skipped++;
        continue;
      }
      
      // Identify level
      const level = identifyLevel(question, pyq.level, pyq.paper, pyq.topicTags);
      
      // Identify paper
      const paper = identifyPaper(question, pyq.paper, level, pyq.topicTags);
      
      // Infer theme
      const theme = inferThemeFromQuestion(question, paper, level) || pyq.theme;
      
      // Update topicTags
      const topicTags = Array.isArray(pyq.topicTags) ? [...pyq.topicTags] : [];
      if (theme && !topicTags.includes(theme)) {
        topicTags.push(theme);
      }
      
      // Check if update is needed
      const needsUpdate = 
        pyq.level !== level ||
        pyq.paper !== paper ||
        pyq.theme !== theme ||
        JSON.stringify(pyq.topicTags) !== JSON.stringify(topicTags);
      
      if (needsUpdate) {
        await PYQ.updateOne(
          { _id: pyq._id },
          {
            $set: {
              level: level,
              paper: paper,
              theme: theme,
              topicTags: topicTags
            }
          }
        );
        updated++;
      } else {
        skipped++;
      }
    } catch (error) {
      console.error(`  ❌ Error processing PYQ ${pyq._id}: ${error.message}`);
      errors++;
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 Organization Summary:');
  console.log(`  ✅ Updated: ${updated} PYQs`);
  console.log(`  🔄 Skipped (no changes): ${skipped} PYQs`);
  console.log(`  ❌ Errors: ${errors}`);
  console.log('='.repeat(50));
  
  await mongoose.disconnect();
  console.log('\n✅ Done!');
}

main().catch((e) => {
  console.error('❌ Fatal error:', e);
  process.exit(1);
});

