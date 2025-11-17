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

  let html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(digest.title || 'Current Affairs Digest')}</title>
  <style>
    @page {
      margin: 2cm;
      size: A4;
    }
    body {
      font-family: 'Noto Sans', 'Arial Unicode MS', 'DejaVu Sans', sans-serif;
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
    const { digestId, digest: digestData } = req.body;

    await connectToDatabase();

    let digest;
    
    // Try to find digest by ID first
    if (digestId) {
      try {
        digest = await CurrentAffairsDigest.findById(digestId);
        // Convert to plain object if it's a Mongoose document
        if (digest && digest.toObject) {
          digest = digest.toObject();
        }
      } catch (dbError) {
        console.error('Error finding digest by ID:', dbError);
        // Continue to try digestData fallback
      }
    }
    
    // If not found by ID, use the provided digest data (fallback)
    if (!digest && digestData) {
      digest = digestData;
    }

    if (!digest) {
      return res.status(404).json({ error: 'Digest not found. Please generate a digest first.' });
    }
    
    // Ensure digest is a plain object (not Mongoose document)
    if (digest.toObject) {
      digest = digest.toObject();
    }

    // Import puppeteer dynamically
    const puppeteer = await import('puppeteer');
    
    // Launch browser
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

    // Validate PDF buffer
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('Generated PDF buffer is empty');
    }

    // Check if it's a valid PDF (starts with %PDF)
    const bufferStart = pdfBuffer.slice(0, 4).toString();
    if (!bufferStart.startsWith('%PDF')) {
      console.error('Invalid PDF buffer. First bytes:', bufferStart);
      console.error('Buffer length:', pdfBuffer.length);
      throw new Error('Generated PDF is invalid');
    }

    console.log('PDF generated successfully. Size:', pdfBuffer.length, 'bytes');

    // Ensure pdfBuffer is a proper Buffer
    const buffer = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);

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
