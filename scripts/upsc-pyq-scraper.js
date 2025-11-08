// Comprehensive UPSC PYQ Scraper with proper organization
// This script scrapes UPSC PYQs and organizes them with proper themes, papers, and levels

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../.env.local') });

import mongoose from 'mongoose';
import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';
let pdfParse;
try {
  pdfParse = (await import('pdf-parse')).default;
} catch (e) {
  console.warn('pdf-parse not installed. Install with: npm i pdf-parse');
}

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGO_URI environment variable is not set!');
  process.exit(1);
}

// Use the same schema as the model
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

PyqSchema.index({ exam: 1, year: 1 });
PyqSchema.index({ question: 'text', topicTags: 'text', theme: 'text' });
PyqSchema.index({ paper: 1, theme: 1, year: -1 });

const PYQ = mongoose.models.PYQ || mongoose.model('PYQ', PyqSchema);

// UPSC official website URLs (use upsc.gov.in without www to avoid SSL issues)
const UPSC_BASE_URL = 'https://upsc.gov.in';
const UPSC_PYQ_PAGES = [
  'https://upsc.gov.in/examinations/previous-question-papers/civil-services-examination',
  'https://upsc.gov.in/examinations/previous-question-papers',
];

// Paper identification patterns
const PAPER_PATTERNS = {
  // Prelims
  'Prelims': {
    'GS Paper I': /gs\s*paper\s*[i1]|general\s*studies\s*paper\s*[i1]|prelims\s*gs\s*[i1]/i,
    'CSAT': /csat|gs\s*paper\s*[ii2]|general\s*studies\s*paper\s*[ii2]/i,
  },
  // Mains
  'Mains': {
    'GS-1': /gs\s*[-\s]?1|general\s*studies\s*[-\s]?1|paper\s*[-\s]?ii|paper\s*2/i,
    'GS-2': /gs\s*[-\s]?2|general\s*studies\s*[-\s]?2|paper\s*[-\s]?iii|paper\s*3/i,
    'GS-3': /gs\s*[-\s]?3|general\s*studies\s*[-\s]?3|paper\s*[-\s]?iv|paper\s*4/i,
    'GS-4': /gs\s*[-\s]?4|general\s*studies\s*[-\s]?4|paper\s*[-\s]?v|paper\s*5|ethics/i,
    'Essay': /essay|paper\s*[-\s]?i|paper\s*1/i,
    'Public Administration': /public\s*administration|pa\s*paper/i,
    'Sociology': /sociology/i,
    'Geography': /geography\s*paper|geo\s*paper/i,
    'History': /history\s*paper|hist\s*paper/i,
    'Political Science': /political\s*science|pol\s*science|pol\s*sc/i,
    'Anthropology': /anthropology/i,
    'Philosophy': /philosophy/i,
    'Literature': /literature|lit\s*paper/i,
  }
};

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
    // Combine all patterns for unknown papers
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

// Extract year from text or filename
function extractYear(text, filename = '') {
  // Try filename first
  const filenameYear = filename.match(/\b(20\d{2}|19\d{2})\b/);
  if (filenameYear) {
    const year = parseInt(filenameYear[1], 10);
    if (year >= 1950 && year <= new Date().getFullYear()) {
      return year;
    }
  }
  
  // Try text content
  const years = Array.from(text.matchAll(/\b(19\d{2}|20\d{2})\b/g)).map(m => parseInt(m[1], 10));
  const year = years.find(y => y >= 1950 && y <= new Date().getFullYear());
  return year || null;
}

// Identify paper from filename and content
function identifyPaper(filename, content, level) {
  const filenameLower = filename.toLowerCase();
  const contentLower = content.toLowerCase().substring(0, 1000); // Check first 1000 chars
  
  const patterns = PAPER_PATTERNS[level] || {};
  
  // Check filename first
  for (const [paper, pattern] of Object.entries(patterns)) {
    if (pattern.test(filenameLower)) {
      return paper;
    }
  }
  
  // Check content
  for (const [paper, pattern] of Object.entries(patterns)) {
    if (pattern.test(contentLower)) {
      return paper;
    }
  }
  
  // Default based on level
  if (level === 'Prelims') {
    if (filenameLower.includes('csat') || filenameLower.includes('paper-ii')) {
      return 'CSAT';
    }
    return 'GS Paper I';
  }
  
  return null;
}

// Extract questions from text
function extractQuestions(text) {
  if (!text || text.length < 10) return [];
  
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const questions = [];
  let buf = '';
  
  for (const line of lines) {
    const merged = buf ? `${buf} ${line}` : line;
    
    // Check if line ends with question mark
    if (/\?\s*$/.test(merged)) {
      const q = merged.replace(/\s+/g, ' ').trim();
      if (q.length >= 15 && q.length <= 500) {
        questions.push(q);
      }
      buf = '';
    } 
    // Check for numbered questions
    else if (/^[\d]+[\.\)]/.test(line) || /^Q\.?\s*[\d]+/i.test(line) || /^\([a-z]\)/i.test(line)) {
      if (buf && /\?/.test(buf)) {
        const q = buf.replace(/\s+/g, ' ').trim();
        if (q.length >= 15 && q.length <= 500) questions.push(q);
      }
      buf = line;
    } 
    else if (buf) {
      buf = merged;
      if (buf.length > 500 && /\?/.test(buf)) {
        const parts = buf.split(/\?/);
        for (let i = 0; i < parts.length - 1; i++) {
          const q = (parts[i] + '?').replace(/\s+/g, ' ').trim();
          if (q.length >= 15 && q.length <= 500) questions.push(q);
        }
        buf = parts[parts.length - 1];
      }
    } 
    else {
      buf = line;
    }
  }
  
  if (buf && /\?/.test(buf)) {
    const q = buf.replace(/\s+/g, ' ').trim();
    if (q.length >= 15 && q.length <= 500) questions.push(q);
  }
  
  // Filter and deduplicate
  const validQuestions = questions.filter(q => {
    return q.length >= 15 && 
           q.length <= 500 && 
           /\?/.test(q) &&
           !/^(page|page \d+|continued|see|refer)/i.test(q.substring(0, 20));
  });
  
  return Array.from(new Set(validQuestions));
}

// Fetch PDF text
async function fetchPdfText(url) {
  let text = '';
  
  // Configure axios for PDF downloads (handle SSL issues)
  const axiosConfig = {
    responseType: 'arraybuffer',
    timeout: 30000,
    httpsAgent: new https.Agent({
      rejectUnauthorized: false
    }),
    validateStatus: function (status) {
      return status >= 200 && status < 400; // Accept 2xx and 3xx
    }
  };
  
  // Try pdf-parse first
  if (pdfParse) {
    try {
      const res = await axios.get(url, axiosConfig);
      if (res.status === 404) {
        return ''; // Return empty for 404
      }
      if (res.data && res.data.length > 0) {
        const data = await pdfParse(Buffer.from(res.data));
        text = data.text || '';
        if (text.length > 100) {
          return text;
        }
      }
    } catch (error) {
      // Check if it's a 404
      if (error.response && error.response.status === 404) {
        return ''; // Return empty for 404
      }
      // Continue to OCR for other errors
    }
  }
  
  // Try OCR with Gemini if available
  if (text.length < 100 && process.env.GEMINI_API_KEY) {
    try {
      const res = await axios.get(url, axiosConfig);
      const pdfBase64 = Buffer.from(res.data).toString('base64');
      const maxSize = 20 * 1024 * 1024; // 20MB limit
      if (res.data.length > maxSize) {
        console.warn(`    ⚠️ PDF too large (${(res.data.length / 1024 / 1024).toFixed(2)}MB), skipping OCR`);
        return text;
      }
      
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          contents: [{
            parts: [
              {
                text: "Extract all text from this PDF exam question paper. Return ONLY the extracted text, preserving line breaks and question numbers."
              },
              {
                inline_data: {
                  mime_type: "application/pdf",
                  data: pdfBase64
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 8000
          }
        },
        { 
          timeout: 120000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        text = response.data.candidates[0].content.parts[0].text;
        if (text.length > 100) {
          console.log(`    ✓ OCR extracted ${text.length} characters`);
          return text;
        }
      }
    } catch (ocrError) {
      console.warn(`    ⚠️ OCR failed: ${ocrError.message}`);
    }
  }
  
  return text;
}

// Process a single PDF
async function processPdf(pdfUrl, level, defaultPaper = null) {
  try {
    const filename = pdfUrl.substring(pdfUrl.lastIndexOf('/') + 1);
    
    // Skip if not CSE paper
    const filenameLower = filename.toLowerCase();
    if (filenameLower.includes('cdse') || 
        filenameLower.includes('nda') || 
        filenameLower.includes('na-') ||
        filenameLower.includes('ifs') ||
        filenameLower.includes('ies') ||
        filenameLower.includes('iss') ||
        filenameLower.includes('cisf') ||
        filenameLower.includes('capf')) {
      return { processed: 0, skipped: 1, reason: 'Not CSE paper' };
    }
    
    const text = await fetchPdfText(pdfUrl);
    if (!text || text.length < 100) {
      // Check if it's a 404 or other error
      if (text === '') {
        return { processed: 0, skipped: 1, reason: 'PDF not found (404)' };
      }
      return { processed: 0, skipped: 1, reason: 'Could not extract text' };
    }
    
    const year = extractYear(text, filename);
    const paper = identifyPaper(filename, text, level) || defaultPaper;
    
    console.log(`    📊 Year: ${year || 'Unknown'}, Paper: ${paper || 'Unknown'}, Level: ${level}`);
    
    const questions = extractQuestions(text);
    console.log(`    ✅ Found ${questions.length} questions`);
    
    let processed = 0;
    let skipped = 0;
    
    for (const question of questions) {
      const key = `UPSC|${year}|${question.substring(0, 100)}`;
      
      // Check if already exists
      const existing = await PYQ.findOne({
        exam: 'UPSC',
        year: year,
        question: { $regex: question.substring(0, 50), $options: 'i' }
      });
      
      if (existing) {
        // Update existing record with better organization
        const theme = inferThemeFromQuestion(question, paper, level) || existing.theme;
        const topicTags = existing.topicTags || [];
        if (theme && !topicTags.includes(theme)) {
          topicTags.push(theme);
        }
        
        await PYQ.updateOne(
          { _id: existing._id },
          {
            $set: {
              level: level || existing.level,
              paper: paper || existing.paper,
              theme: theme || existing.theme,
              topicTags: topicTags,
              verified: true,
              sourceLink: pdfUrl
            }
          }
        );
        skipped++;
        continue;
      }
      
      // Create new record
      const theme = inferThemeFromQuestion(question, paper, level);
      const topicTags = theme ? [theme] : [];
      
      await PYQ.create({
        exam: 'UPSC',
        level: level,
        paper: paper,
        year: year,
        question: question,
        topicTags: topicTags,
        theme: theme,
        sourceLink: pdfUrl,
        verified: true
      });
      
      processed++;
    }
    
    return { processed, skipped };
  } catch (error) {
    console.error(`    ❌ Error processing PDF: ${error.message}`);
    return { processed: 0, skipped: 0, error: error.message };
  }
}

// Scrape UPSC website for PYQ links
async function scrapeUpscPyqLinks() {
  const pdfLinks = new Map(); // Map<level, Array<{url, paper}>>
  
  // Configure axios to handle SSL issues and redirects
  const axiosConfig = {
    timeout: 30000,
    maxRedirects: 5,
    validateStatus: function (status) {
      return status >= 200 && status < 400; // Accept 2xx and 3xx
    },
    httpsAgent: new https.Agent({
      rejectUnauthorized: false // Allow self-signed certificates (use with caution)
    })
  };
  
  for (const pageUrl of UPSC_PYQ_PAGES) {
    try {
      console.log(`\n🔍 Scraping: ${pageUrl}`);
      const response = await axios.get(pageUrl, axiosConfig);
      const $ = cheerio.load(response.data);
      
      // Find all PDF links
      $('a[href*=".pdf"]').each((_, el) => {
        const href = $(el).attr('href');
        const text = $(el).text().toLowerCase();
        const parentText = $(el).parent().text().toLowerCase();
        const filename = href.toLowerCase();
        
        if (href) {
          try {
            const fullUrl = new URL(href, pageUrl).toString();
            
            // Filter: Only process CSE (Civil Services Examination) papers
            // Skip: CDSE, NDA, NA, IFS, etc.
            const isCSE = 
              filename.includes('cse') || 
              filename.includes('civil-services') ||
              filename.includes('gs-') ||
              filename.includes('essay') ||
              text.includes('civil services') ||
              text.includes('cse') ||
              parentText.includes('civil services') ||
              parentText.includes('cse');
            
            // Skip if not CSE
            if (!isCSE) {
              return; // Skip this PDF
            }
            
            // Skip CDSE, NDA, NA, IFS, etc.
            if (filename.includes('cdse') || 
                filename.includes('nda') || 
                filename.includes('na-') ||
                filename.includes('ifs') ||
                filename.includes('ies') ||
                filename.includes('iss') ||
                filename.includes('cisf') ||
                filename.includes('capf')) {
              return; // Skip this PDF
            }
            
            // Determine level
            let level = 'Mains';
            if (text.includes('prelim') || text.includes('prelims') || 
                parentText.includes('prelim') || filename.includes('prelim')) {
              level = 'Prelims';
            }
            
            // Determine paper from filename and text
            let paper = null;
            const allText = (text + ' ' + parentText + ' ' + filename).toLowerCase();
            
            if (level === 'Prelims') {
              if (allText.includes('csat') || allText.includes('paper-ii') || 
                  allText.includes('paper 2') || filename.includes('csat')) {
                paper = 'CSAT';
              } else {
                paper = 'GS Paper I';
              }
            } else {
              // Mains papers - check filename first (more reliable)
              if (filename.includes('gs-1') || filename.includes('gs1') || 
                  filename.includes('paper-ii') || filename.includes('paper2') ||
                  allText.includes('gs-1') || allText.includes('gs 1')) {
                paper = 'GS-1';
              } else if (filename.includes('gs-2') || filename.includes('gs2') || 
                         filename.includes('paper-iii') || filename.includes('paper3') ||
                         allText.includes('gs-2') || allText.includes('gs 2')) {
                paper = 'GS-2';
              } else if (filename.includes('gs-3') || filename.includes('gs3') || 
                         filename.includes('paper-iv') || filename.includes('paper4') ||
                         allText.includes('gs-3') || allText.includes('gs 3')) {
                paper = 'GS-3';
              } else if (filename.includes('gs-4') || filename.includes('gs4') || 
                         filename.includes('paper-v') || filename.includes('paper5') ||
                         filename.includes('ethics') ||
                         allText.includes('gs-4') || allText.includes('gs 4') || 
                         allText.includes('ethics')) {
                paper = 'GS-4';
              } else if (filename.includes('essay') || filename.includes('paper-i') || 
                         filename.includes('paper1') ||
                         allText.includes('essay')) {
                paper = 'Essay';
              } else {
                // Try to identify optional subjects
                for (const [optPaper, pattern] of Object.entries(PAPER_PATTERNS['Mains'])) {
                  if (pattern.test(allText) || pattern.test(filename)) {
                    paper = optPaper;
                    break;
                  }
                }
              }
            }
            
            if (!pdfLinks.has(level)) {
              pdfLinks.set(level, []);
            }
            pdfLinks.get(level).push({ url: fullUrl, paper });
          } catch (e) {
            // Invalid URL, skip
          }
        }
      });
      
      const prelimsCount = pdfLinks.get('Prelims')?.length || 0;
      const mainsCount = pdfLinks.get('Mains')?.length || 0;
      console.log(`  ✅ Found ${prelimsCount} Prelims PDFs, ${mainsCount} Mains PDFs`);
    } catch (error) {
      console.error(`  ❌ Error scraping ${pageUrl}: ${error.message}`);
    }
  }
  
  return pdfLinks;
}

// Main function
async function main() {
  console.log('🚀 Starting UPSC PYQ Scraper...\n');
  
  await mongoose.connect(MONGODB_URI, { bufferCommands: false });
  console.log('✅ Connected to MongoDB\n');
  
  // Scrape PDF links
  const pdfLinks = await scrapeUpscPyqLinks();
  
  let totalProcessed = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  
  // Process each level
  for (const [level, links] of pdfLinks.entries()) {
    console.log(`\n📚 Processing ${level} papers (${links.length} PDFs)...`);
    
    // Filter to only CSE papers
    const cseLinks = links.filter(({ url }) => {
      const filename = url.toLowerCase();
      return !filename.includes('cdse') && 
             !filename.includes('nda') && 
             !filename.includes('na-') &&
             !filename.includes('ifs') &&
             !filename.includes('ies') &&
             !filename.includes('iss') &&
             !filename.includes('cisf') &&
             !filename.includes('capf');
    });
    
    console.log(`  ✅ Filtered to ${cseLinks.length} CSE papers (skipped ${links.length - cseLinks.length} non-CSE papers)\n`);
    
    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const skipReasons = {};
    
    for (let i = 0; i < cseLinks.length; i++) {
      const { url, paper } = cseLinks[i];
      const filename = url.substring(url.lastIndexOf('/') + 1);
      
      // Progress update every 10 files
      if ((i + 1) % 10 === 0 || i === 0) {
        console.log(`\n[${i + 1}/${cseLinks.length}] Processing: ${filename.substring(0, 50)}...`);
      }
      
      const result = await processPdf(url, level, paper);
      processedCount += result.processed || 0;
      skippedCount += result.skipped || 0;
      if (result.error) errorCount++;
      
      // Track skip reasons
      if (result.reason) {
        skipReasons[result.reason] = (skipReasons[result.reason] || 0) + 1;
      }
      
      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    totalProcessed += processedCount;
    totalSkipped += skippedCount;
    totalErrors += errorCount;
    
    console.log(`\n  📊 ${level} Summary: ${processedCount} processed, ${skippedCount} skipped, ${errorCount} errors`);
    if (Object.keys(skipReasons).length > 0) {
      console.log(`  Skip reasons:`, skipReasons);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 Final Scraping Summary:');
  console.log(`  ✅ Processed: ${totalProcessed} new questions`);
  console.log(`  🔄 Updated/Skipped: ${totalSkipped} questions`);
  console.log(`  ❌ Errors: ${totalErrors}`);
  console.log('='.repeat(60));
  
  await mongoose.disconnect();
  console.log('\n✅ Done!');
}

main().catch((e) => {
  console.error('❌ Fatal error:', e);
  process.exit(1);
});

