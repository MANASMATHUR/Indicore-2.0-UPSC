/**
 * PDF Text Extraction Service
 * Loads PDF.js from CDN to avoid webpack canvas dependency issues
 */

// PDF.js version to use from CDN
const PDFJS_VERSION = '3.11.174';
const PDFJS_CDN_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
const WORKER_CDN_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

// Cache for loaded PDF.js library
let pdfjsLib = null;

/**
 * Load PDF.js library from CDN
 * @returns {Promise<Object>} PDF.js library
 */
async function loadPDFJS() {
    if (typeof window === 'undefined') {
        throw new Error('PDF extraction only works in browser environment');
    }

    // Return cached library if already loaded
    if (pdfjsLib) {
        return pdfjsLib;
    }

    // Check if already loaded via script tag
    if (window.pdfjsLib) {
        pdfjsLib = window.pdfjsLib;
        // Configure worker
        pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_CDN_URL;
        return pdfjsLib;
    }

    // Load PDF.js from CDN
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = PDFJS_CDN_URL;
        script.async = true;

        script.onload = () => {
            if (window.pdfjsLib) {
                pdfjsLib = window.pdfjsLib;
                // Configure worker
                pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_CDN_URL;
                console.log('PDF.js loaded from CDN, version:', pdfjsLib.version);
                resolve(pdfjsLib);
            } else {
                reject(new Error('PDF.js failed to load from CDN'));
            }
        };

        script.onerror = () => {
            reject(new Error('Failed to load PDF.js from CDN'));
        };

        document.head.appendChild(script);
    });
}

/**
 * Extract text from PDF file
 * @param {File} file - PDF file to extract text from
 * @returns {Promise<string>} Extracted text content
 */
export async function extractPDFText(file) {
    if (typeof window === 'undefined') {
        throw new Error('PDF extraction only works in browser environment');
    }

    try {
        // Load PDF.js library
        const pdfjs = await loadPDFJS();

        // Convert file to array buffer
        const arrayBuffer = await file.arrayBuffer();

        //Load the PDF document
        const loadingTask = pdfjs.getDocument({
            data: arrayBuffer,
            verbosity: 0,
            isEvalSupported: false,
            useSystemFonts: true
        });

        const pdf = await loadingTask.promise;
        let fullText = '';

        // Extract text from all pages
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();

            const pageText = textContent.items
                .filter(item => item.str && item.str.trim())
                .map(item => item.str.trim())
                .join(' ');

            fullText += pageText + '\n';
        }

        const extractedText = fullText.trim();

        // Validate extraction - be more lenient (threshold 5 instead of 10)
        // Scanned PDFs with minimal text can still be useful or trigger OCR fallback
        if (extractedText && extractedText.length > 5) {
            return extractedText;
        } else {
            throw new Error('Extracted text is too short or empty');
        }

    } catch (error) {
        // Use warn instead of error to avoid cluttering logs when standard extraction fails 
        // as it often correctly triggers OCR fallback in the caller
        if (error.message.includes('too short')) {
            console.warn('PDF extraction: Text too short, might be a scanned document.');
        } else {
            console.error('PDF extraction error:', error);
        }
        throw new Error(`PDF extraction failed: ${error.message}`);
    }
}

/**
 * Check if PDF extraction is supported in current environment
 * @returns {boolean} True if PDF extraction is supported
 */
export function isPDFExtractionSupported() {
    return typeof window !== 'undefined' && typeof FileReader !== 'undefined';
}

export default {
    extractPDFText,
    isPDFExtractionSupported
};
