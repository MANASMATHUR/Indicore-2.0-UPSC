import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import connectToDatabase from '@/lib/mongodb';
import CurrentAffairsDigest from '@/models/CurrentAffairsDigest';

// Helper function to escape HTML
function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

// Generate HTML content for the digest
function generateHTML(digest) {
  const startDate = digest.startDate instanceof Date
    ? digest.startDate
    : (digest.startDate ? new Date(digest.startDate) : new Date());
  const endDate = digest.endDate instanceof Date
    ? digest.endDate
    : (digest.endDate ? new Date(digest.endDate) : new Date());

  // Determine language for proper font and lang attribute
  const language = digest.language || 'en';
  const langMap = {
    'en': 'en',
    'hi': 'hi',
    'mr': 'mr',
    'ta': 'ta',
    'te': 'te',
    'bn': 'bn',
    'pa': 'pa',
    'gu': 'gu',
    'kn': 'kn',
    'ml': 'ml',
    'es': 'es'
  };
  const htmlLang = langMap[language] || 'en';

  // Font selection based on language
  const fontImports = `
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700&family=Noto+Sans+Devanagari:wght@400;700&family=Noto+Sans+Tamil:wght@400;700&family=Noto+Sans+Telugu:wght@400;700&family=Noto+Sans+Bengali:wght@400;700&family=Noto+Sans+Kannada:wght@400;700&family=Noto+Sans+Malayalam:wght@400;700&family=Noto+Sans+Gujarati:wght@400;700&display=swap');
  `;

  const fontFamily = language === 'hi' || language === 'mr' || language === 'pa'
    ? "'Noto Sans Devanagari', 'Noto Sans', sans-serif"
    : language === 'ta'
      ? "'Noto Sans Tamil', 'Noto Sans', sans-serif"
      : language === 'te'
        ? "'Noto Sans Telugu', 'Noto Sans', sans-serif"
        : language === 'bn'
          ? "'Noto Sans Bengali', 'Noto Sans', sans-serif"
          : language === 'kn'
            ? "'Noto Sans Kannada', 'Noto Sans', sans-serif"
            : language === 'ml'
              ? "'Noto Sans Malayalam', 'Noto Sans', sans-serif"
              : language === 'gu'
                ? "'Noto Sans Gujarati', 'Noto Sans', sans-serif"
                : "'Noto Sans', 'Arial Unicode MS', sans-serif";

  let html = `
<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(digest.title || 'Current Affairs Digest')}</title>
  <style>
    ${fontImports}
    @page {
      margin: 2cm;
      size: A4;
    }
    body {
      font-family: ${fontFamily};
      line-height: 1.6;
      color: #333;
      max-width: 100%;
    }
    h1 {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 10px;
      color: #1a1a1a;
    }
    h2 {
      font-size: 18px;
      font-weight: bold;
      margin-top: 20px;
      margin-bottom: 10px;
      color: #2a2a2a;
      border-bottom: 2px solid #e0e0e0;
      padding-bottom: 5px;
    }
    h3 {
      font-size: 16px;
      font-weight: bold;
      margin-top: 15px;
      margin-bottom: 8px;
      color: #3a3a3a;
    }
    .period {
      font-size: 14px;
      color: #666;
      margin-bottom: 20px;
    }
    .summary {
      font-size: 14px;
      line-height: 1.8;
      margin-bottom: 20px;
      text-align: justify;
    }
    .highlights {
      margin-bottom: 20px;
    }
    .highlights ul {
      list-style: none;
      padding-left: 0;
    }
    .highlights li {
      margin-bottom: 8px;
      padding-left: 20px;
      position: relative;
    }
    .highlights li:before {
      content: "•";
      position: absolute;
      left: 0;
      font-weight: bold;
      color: #4a90e2;
    }
    .category {
      margin-bottom: 25px;
      page-break-inside: avoid;
    }
    .news-item {
      margin-bottom: 15px;
      padding: 10px;
      background-color: #f9f9f9;
      border-left: 3px solid #4a90e2;
      page-break-inside: avoid;
    }
    .news-item-title {
      font-size: 15px;
      font-weight: bold;
      margin-bottom: 5px;
      color: #1a1a1a;
    }
    .news-item-summary {
      font-size: 13px;
      line-height: 1.6;
      color: #555;
    }
    .exam-relevance {
      margin-top: 30px;
      padding: 15px;
      background-color: #f0f7ff;
      border-radius: 5px;
    }
    .exam-relevance h3 {
      margin-top: 0;
    }
    .exam-relevance ul {
      list-style: none;
      padding-left: 0;
    }
    .exam-relevance li {
      margin-bottom: 5px;
      padding-left: 20px;
      position: relative;
    }
    .exam-relevance li:before {
      content: "•";
      position: absolute;
      left: 0;
      color: #4a90e2;
    }
    @media print {
      body {
        margin: 0;
      }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(digest.title || 'Current Affairs Digest')}</h1>
  <div class="period">Period: ${startDate.toDateString()} - ${endDate.toDateString()}</div>
`;

  // Summary
  if (digest.summary) {
    html += `
  <h2>Summary</h2>
  <div class="summary">${escapeHtml(digest.summary).replace(/\n/g, '<br>')}</div>
`;
  }

  // Key Highlights
  if (digest.keyHighlights && digest.keyHighlights.length > 0) {
    html += `
  <h2>Key Highlights</h2>
  <div class="highlights">
    <ul>
`;
    digest.keyHighlights.forEach(highlight => {
      html += `      <li>${escapeHtml(highlight)}</li>\n`;
    });
    html += `    </ul>
  </div>
`;
  }

  // Categories
  if (digest.categories && digest.categories.length > 0) {
    digest.categories.forEach(category => {
      html += `
  <div class="category">
    <h2>${escapeHtml(category.name || 'Category')}</h2>
`;
      if (category.items && category.items.length > 0) {
        category.items.forEach(item => {
          html += `
    <div class="news-item">
      <div class="news-item-title">${escapeHtml(item.title || '')}</div>
`;
          if (item.summary) {
            html += `      <div class="news-item-summary">${escapeHtml(item.summary).replace(/\n/g, '<br>')}</div>\n`;
          }
          html += `    </div>
`;
        });
      }
      html += `  </div>
`;
    });
  }

  // Exam Relevance
  if (digest.examRelevance) {
    html += `
  <div class="exam-relevance">
    <h2>Exam Relevance</h2>
`;
    Object.entries(digest.examRelevance).forEach(([exam, topics]) => {
      if (topics && topics.length > 0) {
        html += `
    <h3>${escapeHtml(exam.toUpperCase())}</h3>
    <ul>
`;
        topics.forEach(topic => {
          html += `      <li>${escapeHtml(topic)}</li>\n`;
        });
        html += `    </ul>
`;
      }
    });
    html += `  </div>
`;
  }

  html += `
</body>
</html>
`;

  return html;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let browser = null;
  try {
    const { digestId, digest: digestData, language } = req.body;

    await connectToDatabase();

    let digest;

    // Prioritize the digest data from request body (which contains translated content)
    // over database lookup to ensure we use the correct language version
    if (digestData) {
      digest = digestData;
      console.log(`Using digest data from request body with language: ${language || digest.language || 'en'}`);
    }
    // Fallback to database lookup only if no digest data provided
    else if (digestId) {
      try {
        const filter = { _id: digestId };
        // If language is specified, also filter by language
        if (language) {
          filter.language = language;
        }
        digest = await CurrentAffairsDigest.findOne(filter);
        if (digest && digest.toObject) {
          digest = digest.toObject();
        }
        console.log(`Fetched digest from database with language: ${digest?.language || 'en'}`);
      } catch (dbError) {
        console.error('Error finding digest by ID:', dbError);
      }
    }

    if (!digest) {
      return res.status(404).json({ error: 'Digest not found. Please generate a digest first.' });
    }

    // Ensure digest is a plain object (not Mongoose document)
    if (digest.toObject) {
      digest = digest.toObject();
    }

    // Launch browser based on environment
    if (process.env.AWS_LAMBDA_FUNCTION_VERSION || process.env.VERCEL || process.env.NODE_ENV === 'production') {
      // Production (Vercel/AWS): Use puppeteer-core with @sparticuz/chromium
      const chromium = await import('@sparticuz/chromium');
      const puppeteerCore = await import('puppeteer-core');

      // Configure chromium
      // const executablePath = await chromium.default.executablePath();

      browser = await puppeteerCore.default.launch({
        args: chromium.default.args,
        defaultViewport: chromium.default.defaultViewport,
        executablePath: await chromium.default.executablePath(),
        headless: chromium.default.headless,
      });
    } else {
      // Local development: Use standard puppeteer
      const puppeteer = await import('puppeteer');
      browser = await puppeteer.default.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });
    }

    const page = await browser.newPage();

    // Generate HTML content
    const htmlContent = generateHTML(digest);

    // Set content and wait for fonts to load
    await page.setContent(htmlContent, {
      waitUntil: 'networkidle0'
    });

    // Wait a bit for fonts to fully render (waitForTimeout is deprecated, use Promise-based delay)
    await new Promise(resolve => setTimeout(resolve, 500));

    // Generate PDF with proper Unicode support
    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: {
        top: '2cm',
        right: '2cm',
        bottom: '2cm',
        left: '2cm'
      },
      printBackground: true,
      preferCSSPageSize: true
    });

    await browser.close();
    browser = null;

    // Ensure pdfBuffer is a proper Buffer for validation/response
    const buffer = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);

    // Validate PDF buffer
    if (!buffer || buffer.length === 0) {
      throw new Error('Generated PDF buffer is empty');
    }

    // Check if it's a valid PDF (starts with %PDF)
    const bufferStart = buffer.slice(0, 4).toString();
    if (!bufferStart.startsWith('%PDF')) {
      console.warn('PDF buffer does not start with %PDF. First bytes:', buffer.slice(0, 4));
      console.warn('Buffer length:', buffer.length);
    } else {
      console.log('PDF generated successfully. Size:', buffer.length, 'bytes');
    }

    // Set response headers BEFORE sending
    const startDate = digest.startDate instanceof Date
      ? digest.startDate
      : (digest.startDate ? new Date(digest.startDate) : new Date());
    const dateStr = startDate.toISOString().split('T')[0];

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="current-affairs-${digest.period}-${dateStr}.pdf"`);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'no-cache');

    // Send the buffer - use res.send() for Next.js API routes
    return res.send(buffer);
  } catch (error) {
    console.error('Error exporting PDF:', error);

    // Make sure to close browser on error
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Error closing browser:', closeError);
      }
    }

    return res.status(500).json({ error: 'Failed to export PDF', details: error.message });
  }
}
