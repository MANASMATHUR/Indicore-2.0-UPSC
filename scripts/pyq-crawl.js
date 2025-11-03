

/* eslint-disable no-console */
// Load environment variables from .env and .env.local files
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load .env first, then .env.local (local overrides .env)
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../.env.local') });

import mongoose from 'mongoose';
import axios from 'axios';
import * as cheerio from 'cheerio';
let pdfParse;
try { pdfParse = (await import('pdf-parse')).default; } catch (e) { console.warn('Install pdf-parse for PDF extraction'); }

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGO_URI (or MONGODB_URI) environment variable is not set!');
  console.error('\nTo fix this, set the environment variable:');
  console.error('  Windows (PowerShell): $env:MONGO_URI="your-mongodb-connection-string"');
  console.error('  Windows (CMD): set MONGO_URI=your-mongodb-connection-string');
  console.error('  Linux/Mac: export MONGO_URI="your-mongodb-connection-string"');
  console.error('\nOr create a .env file with: MONGO_URI=your-mongodb-connection-string');
  console.error('\nExample usage:');
  console.error('  $env:MONGO_URI="mongodb+srv://..." node scripts/pyq-crawl.js --exam UPSC --root https://upsc.gov.in/...');
  process.exit(1);
}

const PyqSchema = new mongoose.Schema({
  exam: String, level: String, paper: String, year: Number, question: String,
  topicTags: [String], sourceLink: String, verified: Boolean,
}, { timestamps: true });
PyqSchema.index({ exam: 1, year: 1 });
PyqSchema.index({ question: 'text', topicTags: 'text' });
const PYQ = mongoose.models.PYQ || mongoose.model('PYQ', PyqSchema);

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { maxDepth: 2, maxPages: 60 };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--exam') out.exam = args[++i];
    else if (a === '--level') out.level = args[++i];
    else if (a === '--paper') out.paper = args[++i];
    else if (a === '--theme') out.theme = args[++i];
    else if (a === '--yearFallback') out.yearFallback = parseInt(args[++i], 10);
    else if (a === '--root') out.root = args[++i];
    else if (a === '--maxDepth') out.maxDepth = parseInt(args[++i], 10);
    else if (a === '--maxPages') out.maxPages = parseInt(args[++i], 10);
  }
  if (!out.root) {
    console.error('❌ Error: Provide --root URL');
    console.error('\nUsage:');
    console.error('  node scripts/pyq-crawl.js --exam UPSC --root "https://upsc.gov.in/examinations/previous-question-papers"');
    console.error('\nOptions:');
    console.error('  --exam        Exam name (UPSC, TNPSC, BPSC, etc.) [default: UPSC]');
    console.error('  --root        Root URL to start crawling from [REQUIRED]');
    console.error('  --level       Exam level (Prelims, Mains, etc.) [optional]');
    console.error('  --paper       Paper name filter [optional]');
    console.error('  --theme       Topic/theme tag [optional]');
    console.error('  --yearFallback Default year if not found [optional]');
    console.error('  --maxDepth    Maximum crawl depth [default: 2]');
    console.error('  --maxPages    Maximum pages to crawl [default: 60]');
    console.error('\nExample:');
    console.error('  node scripts/pyq-crawl.js --exam UPSC --root "https://upsc.gov.in/examinations/previous-question-papers" --maxDepth 3 --maxPages 100');
    process.exit(1);
  }
  out.exam = out.exam || 'UPSC';
  return out;
}

function sameDomain(u, base) {
  try { const a = new URL(u, base); return new URL(base).host === a.host; } catch { return false; }
}

async function fetchHtml(url) {
  const res = await axios.get(url, { timeout: 30000 });
  return res.data;
}

// OCR PDF using AI Vision APIs
async function ocrPdfWithAI(pdfBuffer) {
  const pdfBase64 = pdfBuffer.toString('base64');
  
  // Strategy 1: Try Mistral OCR (requires file upload first, then process)
  if (process.env.MISTRAL_API_KEY) {
    try {
      console.log(`    Trying Mistral OCR (uploading file first)...`);
      
      // Step 1: Upload PDF to Mistral file storage
      const FormData = (await import('form-data')).default;
      const form = new FormData();
      form.append('file', pdfBuffer, {
        filename: 'document.pdf',
        contentType: 'application/pdf'
      });
      form.append('purpose', 'ocr');
      
      const uploadResponse = await axios.post(
        'https://api.mistral.ai/v1/files',
        form,
        {
          headers: {
            'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
            ...form.getHeaders()
          },
          timeout: 60000,
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );
      
      if (uploadResponse.data?.id) {
        const fileId = uploadResponse.data.id;
        console.log(`    ✓ File uploaded to Mistral (ID: ${fileId})`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Step 2: Get signed URL (required for Mistral OCR)
        let signedUrl = null;
        try {
          console.log(`    Getting signed URL for file...`);
          const signedUrlResponse = await axios.get(
            `https://api.mistral.ai/v1/files/${fileId}/url`,
            {
              headers: {
                'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`
              },
              timeout: 30000
            }
          );
          signedUrl = signedUrlResponse.data?.url || signedUrlResponse.data?.signed_url;
          if (signedUrl) {
            console.log(`    ✓ Got signed URL`);
          }
        } catch (urlError) {
          console.warn(`    Could not get signed URL: ${urlError.message}`);
        }
        
        // Step 3: Process OCR - Try /v1/ocr first, then /v1/ocr/process
        let ocrResponse;
        if (signedUrl) {
          try {
            console.log(`    Processing OCR with /v1/ocr endpoint...`);
            ocrResponse = await axios.post(
              'https://api.mistral.ai/v1/ocr',
              {
                model: 'mistral-ocr-latest',
                document: {
                  type: 'document_url',
                  document_url: signedUrl
                }
              },
              {
                headers: {
                  'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
                  'Content-Type': 'application/json'
                },
                timeout: 120000
              }
            );
          } catch (ocrError1) {
            // Try alternative endpoint /v1/ocr/process
            console.warn(`    /v1/ocr failed, trying /v1/ocr/process...`);
            try {
              ocrResponse = await axios.post(
                'https://api.mistral.ai/v1/ocr/process',
                {
                  model: 'mistral-ocr-latest',
                  document: {
                    type: 'document_url',
                    document_url: signedUrl
                  }
                },
                {
                  headers: {
                    'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
                    'Content-Type': 'application/json'
                  },
                  timeout: 120000
                }
              );
            } catch (ocrError2) {
              throw new Error(`Both OCR endpoints failed: ${ocrError1.message} and ${ocrError2.message}`);
            }
          }
        } else {
          // Fallback: try with file_id directly
          try {
            console.log(`    Trying OCR with file ID directly (may not work)...`);
            ocrResponse = await axios.post(
              'https://api.mistral.ai/v1/ocr',
              {
                model: 'mistral-ocr-latest',
                document: {
                  type: 'document_file_id',
                  document_file_id: fileId
                },
                output_format: 'text'
              },
              {
                headers: {
                  'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
                  'Content-Type': 'application/json'
                },
                timeout: 120000
              }
            );
          } catch (fileIdError) {
            throw new Error(`Mistral OCR requires signed URL but could not get one`);
          }
        }
        
        // Process Mistral OCR response if we got one
        if (ocrResponse && ocrResponse.data) {
          // Mistral OCR returns text in pages[].markdown format
          let text = '';
          
          if (ocrResponse.data.pages && Array.isArray(ocrResponse.data.pages)) {
            // Extract markdown from all pages
            text = ocrResponse.data.pages
              .map(page => page.markdown || page.text || '')
              .filter(Boolean)
              .join('\n\n');
          }
          
          // Fallback to other fields if pages structure not found
          if (!text || text.length < 100) {
            text = ocrResponse.data?.text || 
                   ocrResponse.data?.content || 
                   ocrResponse.data?.document_annotation?.text ||
                   ocrResponse.data?.result?.text ||
                   ocrResponse.data?.output?.text ||
                   ocrResponse.data?.document_text ||
                   (typeof ocrResponse.data === 'string' ? ocrResponse.data : '');
          }
          
          if (text && text.length > 100) {
            console.log(`    ✓ Mistral OCR extracted ${text.length} characters from ${ocrResponse.data.pages?.length || 1} page(s)`);
            // Clean up: delete uploaded file
            try {
              await axios.delete(`https://api.mistral.ai/v1/files/${fileId}`, {
                headers: { 'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}` }
              });
            } catch {}
            return text;
          } else if (text && text.length > 0) {
            console.warn(`    ⚠️ Mistral OCR returned insufficient text (${text.length} chars)`);
            console.warn(`    Response keys: ${JSON.stringify(Object.keys(ocrResponse.data || {})).substring(0, 200)}`);
          } else {
            console.warn(`    ⚠️ Mistral OCR returned empty response`);
            console.warn(`    Sample: ${JSON.stringify(ocrResponse.data).substring(0, 500)}`);
          }
        } else {
          console.warn(`    ⚠️ Mistral OCR did not return valid response`);
        }
      }
    } catch (e) {
      console.warn(`    Mistral OCR upload/process failed: ${e.message}`);
      if (e.response) {
        console.warn(`    Status: ${e.response.status}`);
      }
    }
  }
  
  // Strategy 2: Try Gemini Pro (supports PDF files directly - BEST for PDFs!)
  if (process.env.GEMINI_API_KEY) {
    try {
      console.log(`    Trying Gemini with vision support (supports PDF directly)...`);
      // Gemini models that support vision: gemini-1.5-pro, gemini-1.5-flash
      let response;
      try {
        response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          contents: [{
            parts: [
              {
                text: "Extract all text from this PDF exam question paper. Return ONLY the extracted text, preserving line breaks, question numbers, and formatting. Do not add any explanations, notes, or analysis. Extract questions in their original format."
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
            maxOutputTokens: 8000,
            topP: 0.8,
            topK: 40
          }
        },
        { timeout: 60000 }
      );
      } catch (e1) {
        // If gemini-1.5-pro fails, try gemini-1.5-flash
        console.warn(`    Model 'gemini-1.5-pro' failed, trying 'gemini-1.5-flash'...`);
        try {
          response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
              contents: [{
                parts: [
                  {
                    text: "Extract all text from this PDF exam question paper. Return ONLY the extracted text, preserving line breaks, question numbers, and formatting. Do not add any explanations, notes, or analysis. Extract questions in their original format."
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
                maxOutputTokens: 8000,
                topP: 0.8,
                topK: 40
              }
            },
            { timeout: 60000 }
          );
        } catch (e2) {
          throw e1; // Re-throw original error if v1 also fails
        }
      }
      
      if (response && response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        const text = response.data.candidates[0].content.parts[0].text;
        if (text.length > 100) {
          console.log(`    ✓ Gemini extracted ${text.length} characters`);
          return text;
        }
      }
    } catch (e) {
      console.warn(`    Gemini vision models failed: ${e.message}`);
      if (e.response) {
        console.warn(`    Status: ${e.response.status}, Data: ${JSON.stringify(e.response.data).substring(0, 200)}`);
        console.warn(`    Full error: ${JSON.stringify(e.response.data)}`);
      }
    }
  }
  
  // Strategy 2: Try Cohere Command R+ (Note: Cohere doesn't support PDF directly, needs images)
  // Since PDF-to-image conversion is complex, we'll skip Cohere for now
  
  // Strategy 3: Try Mistral (Note: Mistral Pixtral requires images, not PDFs)
  // Mistral doesn't have native PDF OCR, so we'll skip it
  
  console.warn(`    ⚠️ All OCR APIs failed or unavailable for PDF processing`);
  console.warn(`    Note: Gemini supports PDF directly. Mistral/Cohere require PDF-to-image conversion.`);
  return null;
}

async function fetchPdfText(url) {
  let text = '';
  
  // Step 1: Try pdf-parse first (fastest for text-based PDFs)
  if (pdfParse) {
    try {
      const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
      if (res.data && res.data.length > 0) {
        const data = await pdfParse(Buffer.from(res.data));
        text = data.text || '';
        
        if (text.length > 100) {
          return text; // Successfully extracted text
        }
      }
    } catch (error) {
      // Continue to OCR fallback
    }
  }
  
  // Step 2: If pdf-parse failed, try OCR with AI APIs (Gemini supports PDF directly)
  const hasOcrKeys = !!(process.env.MISTRAL_API_KEY || process.env.GEMINI_API_KEY || process.env.COHERE_API_KEY);
  
  if (text.length < 100) {
    console.log(`    PDF text extraction failed (got ${text.length} chars)`);
    console.log(`    Checking OCR API keys...`);
    console.log(`    MISTRAL_API_KEY: ${process.env.MISTRAL_API_KEY ? `Set (${process.env.MISTRAL_API_KEY.substring(0, 10)}...)` : 'NOT SET'}`);
    console.log(`    GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? `Set (${process.env.GEMINI_API_KEY.substring(0, 10)}...)` : 'NOT SET'}`);
    console.log(`    COHERE_API_KEY: ${process.env.COHERE_API_KEY ? `Set (${process.env.COHERE_API_KEY.substring(0, 10)}...)` : 'NOT SET'}`);
  }
  
  if (text.length < 100 && hasOcrKeys) {
    console.log(`    Attempting OCR with AI vision APIs...`);
    console.log(`    Available APIs: ${process.env.MISTRAL_API_KEY ? 'Mistral ' : ''}${process.env.GEMINI_API_KEY ? 'Gemini ' : ''}${process.env.COHERE_API_KEY ? 'Cohere' : ''}`);
    try {
      const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
      if (res.data && res.data.length > 0) {
        const maxSize = 50 * 1024 * 1024; // 50MB limit for Gemini
        if (res.data.length > maxSize) {
          console.warn(`    ⚠️ PDF too large (${(res.data.length / 1024 / 1024).toFixed(2)}MB), skipping OCR`);
          return text; // Skip OCR for large files
        }
        
        console.log(`    Sending PDF (${(res.data.length / 1024).toFixed(0)}KB) to AI for OCR...`);
        const ocrResult = await ocrPdfWithAI(Buffer.from(res.data));
        if (ocrResult && ocrResult.length > 100) {
          console.log(`    ✓ OCR extracted ${ocrResult.length} characters`);
          return ocrResult;
        } else {
          console.warn(`    ⚠️ OCR returned insufficient text (${ocrResult?.length || 0} chars)`);
        }
      }
    } catch (error) {
      console.warn(`    ⚠️ OCR processing failed: ${error.message}`);
      if (error.response) {
        console.warn(`    Response status: ${error.response.status}`);
        console.warn(`    Response data: ${JSON.stringify(error.response.data).substring(0, 300)}`);
      }
    }
  } else if (text.length < 100 && !hasOcrKeys) {
    console.warn(`    ⚠️ No OCR API keys found. Set MISTRAL_API_KEY, GEMINI_API_KEY, or COHERE_API_KEY in .env.local`);
    console.warn(`    Note: Only Gemini supports PDF directly. Mistral/Cohere require PDF-to-image conversion.`);
  }
  
  return text;
}

function extractYear(text, fallback) {
  const years = Array.from(text.matchAll(/\b(19\d{2}|20\d{2})\b/g)).map(m => parseInt(m[1], 10));
  const y = years.find(y => y >= 1950 && y <= new Date().getFullYear());
  return y || fallback || null;
}

function extractQuestions(text) {
  if (!text || text.length < 10) return [];
  
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const out = [];
  let buf = '';
  
  for (const l of lines) {
    const merged = buf ? `${buf} ${l}` : l;
    
    if (/\?\s*$/.test(merged)) {
      const q = merged.replace(/\s+/g, ' ').trim();
      if (q.length >= 15) out.push(q);
      buf = '';
    } 
    else if (/^[\d]+[\.\)]/.test(l) || /^Q\.?\s*[\d]+/i.test(l) || /^\([a-z]\)/i.test(l)) {
      if (buf && /\?/.test(buf)) {
        const q = buf.replace(/\s+/g, ' ').trim();
        if (q.length >= 15) out.push(q);
      }
      buf = l;
    } 
    else {
      buf = merged;
      if (buf.length > 500 && /\?/.test(buf)) {
        const parts = buf.split(/\?/);
        for (let i = 0; i < parts.length - 1; i++) {
          const q = (parts[i] + '?').replace(/\s+/g, ' ').trim();
          if (q.length >= 15) out.push(q);
        }
        buf = parts[parts.length - 1];
      }
    }
  }
  
  if (buf && /\?/.test(buf)) {
    const q = buf.replace(/\s+/g, ' ').trim();
    if (q.length >= 15) out.push(q);
  }
  
  const valid = out.filter(q => {
    return q.length >= 15 && 
           q.length <= 500 && 
           /\?/.test(q) &&
           !/^(page|page \d+|continued|see|refer)/i.test(q.substring(0, 20));
  });
  
  return Array.from(new Set(valid));
}

async function crawlAndIngest(cfg) {
  const root = new URL(cfg.root);
  const q = [];
  const visited = new Set();
  q.push({ url: root.toString(), depth: 0 });
  let pages = 0, inserted = 0;

  while (q.length && pages < cfg.maxPages) {
    const { url, depth } = q.shift();
    if (visited.has(url)) continue; visited.add(url);
    try {
      const html = await fetchHtml(url);
      pages++;
      console.log(`  📄 Crawling page ${pages}: ${url}`);
      const $ = cheerio.load(html);
      const links = $('a[href]').map((_, el) => $(el).attr('href')).get();
      const pdfLinks = links.filter(href => /\.pdf($|\?)/i.test(href));
      if (pdfLinks.length > 0) {
        console.log(`  🔍 Found ${pdfLinks.length} PDF link(s) on this page`);
      } else {
        console.log(`  ℹ️  Found ${links.length} total link(s), ${pdfLinks.length} PDF link(s) on this page`);
      }
      for (const href of links) {
        try {
          const u = new URL(href, url).toString();
          if (!sameDomain(u, root.toString())) continue;
          if (/\.pdf($|\?)/i.test(u)) {
            try {
              console.log(`  📥 Downloading PDF: ${u.substring(u.lastIndexOf('/') + 1)}`);
              const text = await fetchPdfText(u);
              if (!text || text.length < 100) {
                console.log(`  ⚠️ PDF ${u} has insufficient text (${text?.length || 0} chars), skipping`);
                continue;
              }
              console.log(`  📝 Extracted ${text.length} characters from PDF`);
              const year = extractYear(text, cfg.yearFallback);
              const qs = extractQuestions(text);
              if (qs.length > 0) {
                console.log(`  ✓ Found ${qs.length} question(s) from PDF ${u.substring(u.lastIndexOf('/') + 1)} (year: ${year || 'unknown'})`);
              } else {
                console.log(`  ⚠️ No questions extracted from PDF (might be scanned image or wrong format)`);
              }
              for (const qu of qs) {
                // Auto-verify if source is from official government domain
                const isOfficialSource = /\.gov\.(in|uk|au|us|ca)|upsc\.gov\.in|tnpsc\.gov\.in|bpsc\.bih\.nic\.in|uppsc\.gov\.in|mpsc\.gov\.in|wbpsc\.gov\.in|gpsc\.gujarat\.gov\.in|ppsc\.gov\.in|rpsc\.rajasthan\.gov\.in|mppsc\.nic\.in|hpsc\.gov\.in|kpsc\.kar\.nic\.in|keralapsc\.gov\.in|tspsc\.gov\.in|psc\.ap\.gov\.in/i.test(u);
                await PYQ.create({ exam: cfg.exam, level: cfg.level||'', paper: cfg.paper||'', year: year||null, question: qu, topicTags: cfg.theme?[cfg.theme]:[], sourceLink: u, verified: isOfficialSource });
                inserted++;
              }
            } catch (pdfErr) {
              console.warn(`  ⚠️ Failed to process PDF ${u}: ${pdfErr.message}`);
            }
          } else if (depth + 1 <= cfg.maxDepth) {
            q.push({ url: u, depth: depth + 1 });
          }
        } catch {}
      }
    } catch (e) {
      // ignore
    }
  }
  return { pages, inserted };
}

async function main() {
  const cfg = parseArgs();
  await mongoose.connect(MONGODB_URI, { bufferCommands: false });
  const { pages, inserted } = await crawlAndIngest(cfg);
  console.log(`Crawl complete: pages=${pages}, inserted=${inserted}`);
  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });


