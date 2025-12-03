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
                // Extract text from PDF using pdf-parse v1.1.1
                const dataBuffer = fs.readFileSync(filePath);
                const pdfParse = require('pdf-parse');

                // pdf-parse v1.1.1 is a simple function that takes a buffer
                const pdfData = await pdfParse(dataBuffer);
                extractedText = pdfData.text;
            } else if (fileType.includes('text/')) {
                // Extract text from text file
                extractedText = fs.readFileSync(filePath, 'utf-8');
            } else {
                // For other types, return error or placeholder
                // We primarily support PDF for notes
                if (!extractedText) {
                    return res.status(400).json({ error: 'Unsupported file type. Please upload a PDF.' });
                }
            }

            // Clean up uploaded file
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }

            return res.status(200).json({
                success: true,
                extractedText: extractedText.trim(),
                fileName: file.originalFilename,
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
            console.error('Extraction error:', extractError);
            return res.status(500).json({ error: 'Failed to extract text from file' });
        }
    } catch (error) {
        console.error('Error uploading note:', error);
        return res.status(500).json({
            error: 'Failed to process upload',
            details: error.message
        });
    }
}
