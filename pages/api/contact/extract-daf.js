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
        // Extract text from PDF using pdf-parse (more reliable for Node.js)
        const dataBuffer = fs.readFileSync(filePath);
        const pdf = (await import('pdf-parse/lib/pdf-parse.js')).default;

        const data = await pdf(dataBuffer);
        extractedText = data.text;

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
            details: 'The PDF appears to be scanned or image-based. Please ensure your DAF is a text-based PDF, or try converting it to a readable format.',
            suggestion: 'If this is a scanned document, please use OCR software to convert it to a searchable PDF first.'
          });
        }

        console.log(`Successfully extracted ${extractedText.length} characters from PDF`);
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
