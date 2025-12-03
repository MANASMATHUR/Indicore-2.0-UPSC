import formidable from 'formidable';
import fs from 'fs';

// Disable default body parser
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const form = formidable({
      maxFileSize: 10 * 1024 * 1024, // 10MB
      keepExtensions: true,
    });

    const [fields, files] = await form.parse(req);
    const file = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!file || !file.filepath) {
      return res.status(400).json({ error: 'No file uploaded or invalid file' });
    }

    const filePath = file.filepath;
    const fileType = file.mimetype || '';

    // Security check: ensure file path is safe
    if (!fs.existsSync(filePath)) {
      return res.status(400).json({ error: 'File not found' });
    }

    let extractedText = '';

    try {
      if (fileType === 'application/pdf') {
        // Extract text from PDF using pdfjs-dist (more reliable than pdf-parse)
        const dataBuffer = fs.readFileSync(filePath);

        // Use pdfjs-dist legacy build for Node.js compatibility
        const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

        // Convert buffer to Uint8Array for pdfjs
        const uint8Array = new Uint8Array(dataBuffer);

        // Load the PDF document
        const loadingTask = pdfjsLib.getDocument(uint8Array);
        const pdfDocument = await loadingTask.promise;

        // Extract text from all pages
        let fullText = '';
        for (let i = 1; i <= pdfDocument.numPages; i++) {
          const page = await pdfDocument.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
          fullText += pageText + '\n';
        }

        extractedText = fullText;
      } else if (fileType.includes('text/')) {
        // Extract text from text file
        extractedText = fs.readFileSync(filePath, 'utf-8');
      } else if (fileType.includes('image/')) {
        // For images, return a placeholder - OCR can be added later
        extractedText = '[Image file detected. Please provide DAF content manually or convert to PDF/Text format.]';
      } else if (fileType.includes('wordprocessingml') || fileType.includes('msword')) {
        // For Word documents, return a placeholder
        extractedText = '[Word document detected. Please convert to PDF or provide DAF content manually.]';
      } else {
        extractedText = '[Unsupported file type. Please upload PDF or text file.]';
      }

      // Clean up uploaded file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      return res.status(200).json({
        success: true,
        extractedText: extractedText.trim(),
        fileType
      });
    } catch (extractError) {
      // Clean up uploaded file even on error
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (unlinkError) {
          console.error('Error deleting file:', unlinkError);
        }
      }
      throw extractError;
    }
  } catch (error) {
    console.error('Error extracting DAF:', error);
    return res.status(500).json({
      error: 'Failed to extract text from file',
      details: error.message
    });
  }
}
