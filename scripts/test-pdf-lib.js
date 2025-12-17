
async function testPdfImport() {
    try {
        console.log('Attempting to import pdfjs-dist/legacy/build/pdf.js...');
        const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.js');
        console.log('Import successful!');

        // Set worker to empty
        pdfjsLib.GlobalWorkerOptions.workerSrc = '';
        console.log('Worker options set.');

        console.log('PDF.js version:', pdfjsLib.version);
        console.log('Test PASSED: Library is loadable.');
    } catch (error) {
        console.error('Test FAILED:', error);
        process.exit(1);
    }
}

testPdfImport();
