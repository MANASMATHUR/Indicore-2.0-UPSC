/**
 * PDF Text Extraction Service
 * Handles PDF.js imports in a way that avoids webpack canvas issues
 */

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
        const arrayBuffer = await file.arrayBuffer();

        // Dynamic import to avoid webpack bundling issues
        const pdfjsLib = await import('pdfjs-dist/build/pdf.min.mjs');
        const pdfjs = pdfjsLib.default || pdfjsLib;

        // Configure worker from CDN to avoid bundling issues
        const workerSources = [
            `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`,
            `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`,
            `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`
        ];

        // Try each worker source until one works
        for (const workerSrc of workerSources) {
            try {
                pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

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

                // Validate extraction
                if (extractedText && extractedText.length > 10) {
                    return extractedText;
                }
            } catch (workerError) {
                console.warn(`Worker source ${workerSrc} failed:`, workerError.message);
                continue;
            }
        }

        // If all workers failed
        throw new Error('All PDF worker sources failed');

    } catch (error) {
        console.error('PDF extraction error:', error);
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
