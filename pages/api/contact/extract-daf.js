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
        // Extract text from PDF using pdfjs-dist directly (legacy build for Node)
        // This avoids the 'Object.defineProperty' error from pdf-parse/modern builds
        const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.js');

        // Disable worker for Node.js info
        pdfjsLib.GlobalWorkerOptions.workerSrc = '';

        const dataBuffer = fs.readFileSync(filePath);

        // Convert Buffer to Uint8Array for pdfjs
        const uint8Array = new Uint8Array(dataBuffer);

        const loadingTask = pdfjsLib.getDocument({
          data: uint8Array,
          useSystemFonts: true, // Try to use system fonts
          disableFontFace: true, // Disable font face if needed to avoid canvas issues
        });

        const doc = await loadingTask.promise;
        const numPages = doc.numPages;
        let fullTextParts = [];

        for (let i = 1; i <= numPages; i++) {
          const page = await doc.getPage(i);
          const textContent = await page.getTextContent();

          // Join items with space, but respect some layout
          const pageText = textContent.items
            .map(item => item.str)
            .join(' ');

          fullTextParts.push(pageText);
        }

        extractedText = fullTextParts.join('\n\n');

        // Clean up text - preserve paragraph breaks but normalize spacing
        extractedText = extractedText
          .replace(/\r\n/g, '\n')  // Normalize line endings
          .replace(/[ \t]+/g, ' ')  // Normalize horizontal whitespace
          .replace(/\n{3,}/g, '\n\n')  // Normalize multiple line breaks
          .trim();

        // More robust check for meaningful content
        if (!extractedText || extractedText.length < 10) {
          // PDF might be scanned or image-based
          console.warn('PDF text extraction yielded minimal content. File might be scanned or image-based.');
          return res.status(400).json({
            error: 'Could not extract text from PDF',
            details: 'The PDF appears to be scanned or image-based or uses unsupported fonts. Please ensure your DAF is a text-based PDF.',
            suggestion: 'If this is a scanned document, please use OCR software to convert it to a searchable PDF first.'
          });
        }

        console.log(`Successfully extracted ${extractedText.length} characters from PDF using pdfjs-dist`);
      } else if (fileType.includes('text/')) {
        // Extract text from text file
        extractedText = fs.readFileSync(filePath, 'utf-8');
      } else if (fileType.includes('image/')) {
        // For images, return a placeholder - OCR can be added later
        extractedText = '[Image file detected. Please provide DAF content manually or convert to PDF/Text format.]';
      } else if (fileType.includes('wordprocessingml') || fileType.includes('msword')) {
        // Extract text from Word document using mammoth (supports .docx)
        try {
          const mammoth = await import('mammoth');
          const buffer = fs.readFileSync(filePath);
          const result = await mammoth.extractRawText({ buffer });
          extractedText = result.value;

          if (result.messages && result.messages.length > 0) {
            console.log('Mammoth messages:', result.messages);
          }
        } catch (docError) {
          console.error('Word extraction failed:', docError);
          return res.status(400).json({
            error: 'Word document extraction failed',
            details: 'Could not parse the .docx file. Please ensure it is a valid Word document or convert to PDF.'
          });
        }
      } else {
        return res.status(400).json({
          error: 'Unsupported file type',
          details: 'Please upload a PDF, Word (.docx), or text file.'
        });
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
