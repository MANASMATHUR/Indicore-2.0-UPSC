
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
import fs from 'fs';
let pdfParse;

try {
  // Optional dependency loaded at runtime
  pdfParse = (await import('pdf-parse')).default;
} catch (e) {
  console.warn('pdf-parse not installed. Install with: npm i pdf-parse');
}

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGO_URI (or MONGODB_URI) environment variable is not set!');
  console.error('\nTo fix this, set the environment variable:');
  console.error('  Windows (PowerShell): $env:MONGO_URI="your-mongodb-connection-string"');
  console.error('  Windows (CMD): set MONGO_URI=your-mongodb-connection-string');
  console.error('  Linux/Mac: export MONGO_URI="your-mongodb-connection-string"');
  console.error('\nOr create a .env file with: MONGO_URI=your-mongodb-connection-string');
  console.error('\nExample usage:');
  console.error('  $env:MONGO_URI="mongodb+srv://..." node scripts/pyq-ingest.js --exam UPSC --url https://upsc.gov.in/...');
  process.exit(1);
}

const PyqSchema = new mongoose.Schema({
  exam: String,
  level: String,
  paper: String,
  year: Number,
  question: String,
  topicTags: [String],
  sourceLink: String,
  verified: Boolean,
}, { timestamps: true });
PyqSchema.index({ exam: 1, year: 1 });
PyqSchema.index({ question: 'text', topicTags: 'text' });
const PYQ = mongoose.models.PYQ || mongoose.model('PYQ', PyqSchema);

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { urls: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--url') out.urls.push(args[++i]);
    else if (a === '--exam') out.exam = args[++i];
    else if (a === '--level') out.level = args[++i];
    else if (a === '--paper') out.paper = args[++i];
    else if (a === '--theme') out.theme = args[++i];
    else if (a === '--yearFallback') out.yearFallback = parseInt(args[++i], 10);
  }
  if (!out.urls.length) {
    console.error('❌ Error: Provide at least one --url');
    console.error('\nUsage:');
    console.error('  node scripts/pyq-ingest.js --exam UPSC --url "https://upsc.gov.in/examinations/previous-question-papers"');
    console.error('\nOptions:');
    console.error('  --exam        Exam name (UPSC, TNPSC, BPSC, etc.)');
    console.error('  --url         URL(s) to ingest (can specify multiple times)');
    console.error('  --level       Exam level (Prelims, Mains, etc.) [optional]');
    console.error('  --paper       Paper name (GS-2, GS-3, etc.) [optional]');
    console.error('  --theme       Topic/theme tag (e.g., MSP, Constitution) [optional]');
    console.error('  --yearFallback Default year if not found in PDF [optional]');
    console.error('\nExample:');
    console.error('  node scripts/pyq-ingest.js --exam UPSC --level Mains --paper GS-2 --theme MSP --url "https://upsc.gov.in/..."');
    process.exit(1);
  }
  out.exam = out.exam || 'UPSC';
  out.level = out.level || '';
  out.paper = out.paper || '';
  return out;
}

function extractYearFromText(text, fallback) {
  const years = Array.from(text.matchAll(/\b(19\d{2}|20\d{2})\b/g)).map(m => parseInt(m[1], 10));
  if (years.length) {
    // Prefer the first plausible year >= 1950
    const y = years.find(y => y >= 1950 && y <= new Date().getFullYear());
    if (y) return y;
  }
  return fallback || null;
}

function extractQuestionsFromText(text) {
  if (!text || text.length < 10) return [];
  
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const questions = [];
  let buf = '';
  
  for (const line of lines) {
    const merged = buf ? `${buf} ${line}` : line;
    
    // Check if line ends with question mark
    if (/\?\s*$/.test(merged)) {
      const q = merged.replace(/\s+/g, ' ').trim();
      if (q.length >= 15) { // Minimum question length
        questions.push(q);
      }
      buf = '';
    } 
    // Check for numbered questions (1), 2), Q1, Q.1, etc.)
    else if (/^[\d]+[\.\)]/.test(line) || /^Q\.?\s*[\d]+/i.test(line) || /^\([a-z]\)/i.test(line)) {
      if (buf && /\?/.test(buf)) {
        const q = buf.replace(/\s+/g, ' ').trim();
        if (q.length >= 15) questions.push(q);
      }
      buf = line;
    } 
    // Continue building buffer
    else if (buf) {
      buf = merged;
      // If buffer is getting long, check if it contains a question mark
      if (buf.length > 500 && /\?/.test(buf)) {
        const parts = buf.split(/\?/);
        for (let i = 0; i < parts.length - 1; i++) {
          const q = (parts[i] + '?').replace(/\s+/g, ' ').trim();
          if (q.length >= 15) questions.push(q);
        }
        buf = parts[parts.length - 1];
      }
    } 
    else {
      buf = line;
    }
  }
  
  // Final check on buffer
  if (buf && /\?/.test(buf)) {
    const q = buf.replace(/\s+/g, ' ').trim();
    if (q.length >= 15) questions.push(q);
  }
  
  // Filter out very short or invalid questions
  const validQuestions = questions.filter(q => {
    return q.length >= 15 && 
           q.length <= 500 && 
           /\?/.test(q) &&
           !/^(page|page \d+|continued|see|refer)/i.test(q.substring(0, 20));
  });
  
  // De-duplicate
  return Array.from(new Set(validQuestions));
}

async function fetchBuffer(url) {
  const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
  return Buffer.from(res.data);
}

// Helper: Convert PDF page to image using pdfjs-dist (for vision APIs that need images)
async function pdfPageToImageBase64(pdfBuffer, pageNum = 1) {
  if (!pdfjsLib) {
    try {
      pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    } catch {
      return null;
    }
  }
  
  try {
    const loadingTask = pdfjsLib.getDocument({ data: pdfBuffer });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(Math.min(pageNum, pdf.numPages));
    const viewport = page.getViewport({ scale: 2.0 });
    
    // Use a simple canvas alternative or convert to image
    // For now, return null and use direct PDF approach
    return null;
  } catch (e) {
    return null;
  }
}

// OCR PDF using AI Vision APIs
async function ocrPdfWithAI(pdfBuffer, url) {
  const pdfBase64 = pdfBuffer.toString('base64');
  
  // Strategy 1: Try Mistral OCR (requires file upload first, then process)
  if (process.env.MISTRAL_API_KEY) {
    try {
      console.log(`    Trying Mistral OCR (uploading file first)...`);
      
      // Step 1: Upload PDF to Mistral file storage using multipart form data
      // Mistral expects a multipart/form-data request with the file
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
        
        try {
          // Wait a moment for file to be ready
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
          let ocrResponse = null;
          let mistralSuccess = false;
          
          if (signedUrl) {
            try {
              console.log(`    Processing OCR with /v1/ocr endpoint...`);
              // Mistral OCR requires 'document_url' field (not 'url')
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
                  timeout: 180000 // OCR can take 3 minutes for large PDFs
                }
              );
              
              mistralSuccess = true;
              console.log(`    ✓ Mistral OCR request succeeded`);
              
            } catch (ocrError1) {
              // Log detailed error to understand what Mistral expects
              if (ocrError1.response) {
                console.warn(`    /v1/ocr error details: ${JSON.stringify(ocrError1.response.data).substring(0, 400)}`);
              }
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
                    timeout: 180000
                  }
                );
                
                mistralSuccess = true;
                console.log(`    ✓ Mistral OCR request succeeded (via /process endpoint)`);
              } catch (ocrError2) {
                if (ocrError2.response) {
                  console.warn(`    /v1/ocr/process error details: ${JSON.stringify(ocrError2.response.data).substring(0, 400)}`);
                }
                console.warn(`    ⚠️ Mistral OCR failed on both endpoints, will try Gemini...`);
              }
            }
            
            // Process Mistral response if successful
            if (mistralSuccess && ocrResponse && ocrResponse.data) {
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
                } catch (cleanupError) {
                  // Ignore cleanup errors
                }
                return text;
              } else if (text && text.length > 0) {
                console.warn(`    ⚠️ Mistral OCR returned insufficient text (${text.length} chars)`);
                console.warn(`    Response keys: ${JSON.stringify(Object.keys(ocrResponse.data || {})).substring(0, 200)}`);
              } else {
                console.warn(`    ⚠️ Mistral OCR returned empty response`);
                console.warn(`    Response structure: ${JSON.stringify(Object.keys(ocrResponse.data || {})).substring(0, 200)}`);
                console.warn(`    Sample response: ${JSON.stringify(ocrResponse.data).substring(0, 500)}`);
              }
            }
          } else {
            console.warn(`    ⚠️ Mistral OCR requires signed URL but could not get one`);
          }
        } catch (ocrError) {
          console.warn(`    Mistral OCR processing failed: ${ocrError.message}`);
          if (ocrError.response) {
            console.warn(`    Status: ${ocrError.response.status}`);
            console.warn(`    Response: ${JSON.stringify(ocrError.response.data).substring(0, 300)}`);
          }
          // Clean up file on error
          try {
            await axios.delete(`https://api.mistral.ai/v1/files/${fileId}`, {
              headers: { 'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}` }
            });
          } catch {}
        }
      }
    } catch (e) {
      console.warn(`    Mistral OCR upload/process failed: ${e.message}`);
      if (e.response) {
        console.warn(`    Status: ${e.response.status}`);
        console.warn(`    Response: ${JSON.stringify(e.response.data).substring(0, 300)}`);
      }
    }
  }
  
  // Strategy 2: Try Gemini 1.5 Flash/Pro (supports PDF files directly - BEST for PDFs!)
  if (process.env.GEMINI_API_KEY) {
    try {
      console.log(`    Trying Gemini with vision support (supports PDF directly)...`);
      // Try different Gemini model variants that might support vision/PDFs
      let response;
      // Try gemini-pro-vision first (if it exists), then fallback to others
      try {
        response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=${process.env.GEMINI_API_KEY}`,
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
        // If gemini-pro-vision fails, try without vision suffix
        console.warn(`    Model 'gemini-pro-vision' failed, trying 'gemini-pro'...`);
        try {
          response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
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
          // If gemini-pro also fails, try v1 API
          console.warn(`    Model 'gemini-pro' (v1beta) failed, trying v1 API...`);
          try {
            response = await axios.post(
              `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
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
          } catch (e3) {
            throw e1; // Re-throw original error if all fail
          }
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
  
  // Strategy 4: Try Cohere Command R+ (Note: Cohere doesn't support PDF directly, needs images)
  // Since PDF-to-image conversion is complex, we'll skip Cohere for now

  console.warn(`    ⚠️ All OCR APIs failed or unavailable for PDF processing`);
  console.warn(`    Note: Gemini supports PDF directly. Ensure model names use -latest suffix.`);
  return null;
}

async function parsePdfUrl(url) {
  let text = '';
  
  // Step 1: Try pdf-parse first (fastest for text-based PDFs)
  if (pdfParse) {
    try {
      const buf = await fetchBuffer(url);
      if (buf && buf.length > 0) {
        const data = await pdfParse(buf);
        text = data.text || '';
        
        if (text.length > 100) {
          // Successfully extracted text, return it
          return { text };
        }
      }
    } catch (error) {
      // Continue to OCR fallback
    }
  }
  
  // Step 2: If pdf-parse failed (0 chars), try OCR with AI Vision APIs
  const hasOcrKeys = !!(process.env.MISTRAL_API_KEY || process.env.GEMINI_API_KEY || process.env.COHERE_API_KEY);
  
  if (text.length < 100 && hasOcrKeys) {
    console.log(`    Attempting OCR with AI vision APIs...`);
    console.log(`    Available APIs: ${process.env.MISTRAL_API_KEY ? 'Mistral ' : ''}${process.env.GEMINI_API_KEY ? 'Gemini ' : ''}${process.env.COHERE_API_KEY ? 'Cohere' : ''}`);
    
    try {
      const buf = await fetchBuffer(url);
      if (!buf || buf.length === 0) {
        console.warn(`    ⚠️ PDF buffer is empty`);
        return { text: '' };
      }
      
      // Check PDF size (Gemini can handle up to 50MB, but we'll be conservative)
      const maxSize = 50 * 1024 * 1024; // 50MB limit for Gemini
      if (buf.length > maxSize) {
        console.warn(`    ⚠️ PDF too large (${(buf.length / 1024 / 1024).toFixed(2)}MB), skipping OCR`);
        return { text: '' };
      }
      
      console.log(`    Sending PDF (${(buf.length / 1024).toFixed(0)}KB) to AI for OCR...`);
      const ocrResult = await ocrPdfWithAI(buf, url);
      
      if (ocrResult && ocrResult.length > 100) {
        text = ocrResult;
        console.log(`    ✓ OCR extracted ${text.length} characters`);
        return { text };
      } else if (ocrResult) {
        console.warn(`    ⚠️ OCR returned insufficient text (${ocrResult.length} chars)`);
      } else {
        console.warn(`    ⚠️ All OCR APIs failed or returned no text`);
      }
    } catch (ocrError) {
      console.warn(`    ⚠️ OCR processing failed: ${ocrError.message}`);
      if (ocrError.response) {
        console.warn(`    Response status: ${ocrError.response.status}`);
        console.warn(`    Response data: ${JSON.stringify(ocrError.response.data).substring(0, 300)}`);
      }
    }
  } else if (text.length < 100 && !hasOcrKeys) {
    console.warn(`    ⚠️ No OCR API keys found. Set MISTRAL_API_KEY, GEMINI_API_KEY, or COHERE_API_KEY in .env.local`);
  }
  
  if (text.length === 0) {
    console.warn(`  ⚠️ Could not extract text from PDF (tried pdf-parse and OCR)`);
  }
  
  return { text };
}

async function fetchHtml(url) {
  const res = await axios.get(url, { timeout: 30000 });
  return res.data;
}

async function main() {
  const args = parseArgs();
  await mongoose.connect(MONGODB_URI, { bufferCommands: false });

  const insertedSet = new Set();
  let total = 0;

  for (const url of args.urls) {
    try {
      let text = '';
      if (/\.pdf($|\?)/i.test(url)) {
        const { text: t } = await parsePdfUrl(url);
        text = t;
      } else {
        // If HTML, try to find PDF links and ingest them
        const html = await fetchHtml(url);
        const $ = cheerio.load(html);
        const pdfs = new Set();
        
        // Find all PDF links (multiple patterns)
        $('a[href*=".pdf"]').each((_, el) => {
          const href = $(el).attr('href');
          if (href) {
            try {
              pdfs.add(new URL(href, url).toString());
            } catch (e) {
              // Invalid URL, skip
            }
          }
        });
        
        // Also check for links in common PDF patterns
        $('a').each((_, el) => {
          const href = $(el).attr('href');
          if (href && /\.pdf/i.test(href)) {
            try {
              pdfs.add(new URL(href, url).toString());
            } catch (e) {
              // Invalid URL, skip
            }
          }
        });
        
        console.log(`Found ${pdfs.size} PDF link(s) on page ${url}`);
        
        for (const p of pdfs) {
          try {
            const pdfName = p.substring(p.lastIndexOf('/') + 1);
            console.log(`Processing PDF: ${pdfName}`);
            const { text: t } = await parsePdfUrl(p);
            if (!t || t.length < 100) {
              if (t && t.length > 0) {
                console.log(`  ⚠️ PDF has insufficient text (${t.length} chars), might be partially scanned. Trying anyway...`);
              } else {
                console.log(`  ⚠️ PDF has 0 characters extracted - this is likely a scanned/image-based PDF.`);
                console.log(`     These PDFs require OCR (Optical Character Recognition) to extract text.`);
                console.log(`     For now, skipping. Consider using OCR tools like Tesseract.js or manual extraction.`);
                continue;
              }
            }
            const year = extractYearFromText(t, args.yearFallback);
            const qs = extractQuestionsFromText(t);
            console.log(`  Found ${qs.length} question(s) from year ${year || 'unknown'}`);
            for (const q of qs) {
            const key = `${args.exam}|${year}|${q}`;
            if (insertedSet.has(key)) continue;
            // Auto-verify if source is from official government domain
            const isOfficialSource = /\.gov\.(in|uk|au|us|ca)|upsc\.gov\.in|tnpsc\.gov\.in|bpsc\.bih\.nic\.in|uppsc\.gov\.in|mpsc\.gov\.in|wbpsc\.gov\.in|gpsc\.gujarat\.gov\.in|ppsc\.gov\.in|rpsc\.rajasthan\.gov\.in|mppsc\.nic\.in|hpsc\.gov\.in|kpsc\.kar\.nic\.in|keralapsc\.gov\.in|tspsc\.gov\.in|psc\.ap\.gov\.in/i.test(p);
            await PYQ.create({
              exam: args.exam,
              level: args.level,
              paper: args.paper,
              year: year || null,
              question: q,
              topicTags: args.theme ? [args.theme] : [],
              sourceLink: p,
              verified: isOfficialSource
            });
            insertedSet.add(key);
            total++;
            }
          } catch (pdfError) {
            console.warn(`  ⚠️ Failed to process PDF ${p}: ${pdfError.message}`);
          }
        }
        continue; // move to next url
      }

      const year = extractYearFromText(text, args.yearFallback);
      const qs = extractQuestionsFromText(text);
      for (const q of qs) {
        const key = `${args.exam}|${year}|${q}`;
        if (insertedSet.has(key)) continue;
        
        const isOfficialSource = /\.gov\.(in|uk|au|us|ca)|upsc\.gov\.in|tnpsc\.gov\.in|bpsc\.bih\.nic\.in|uppsc\.gov\.in|mpsc\.gov\.in|wbpsc\.gov\.in|gpsc\.gujarat\.gov\.in|ppsc\.gov\.in|rpsc\.rajasthan\.gov\.in|mppsc\.nic\.in|hpsc\.gov\.in|kpsc\.kar\.nic\.in|keralapsc\.gov\.in|tspsc\.gov\.in|psc\.ap\.gov\.in/i.test(url);
        await PYQ.create({
          exam: args.exam,
          level: args.level,
          paper: args.paper,
          year: year || null,
          question: q,
          topicTags: args.theme ? [args.theme] : [],
          sourceLink: url,
          verified: isOfficialSource
        });
        insertedSet.add(key);
        total++;
      }
    } catch (err) {
      console.warn('Failed to ingest from', url, err.message);
    }
  }

  console.log('Ingestion complete. Inserted:', total);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


