
const fs = require('fs');
const path = require('path');

async function debugPdfParse() {
    try {
        console.log('Loading pdf-parse...');
        const pdfParseModule = require('pdf-parse');

        console.log('Module keys:', Object.keys(pdfParseModule));

        const buffer = Buffer.from('dummy pdf content');

        // Test 'load' method
        if (pdfParseModule.load && typeof pdfParseModule.load === 'function') {
            console.log('Testing load method...');
            try {
                const result = await pdfParseModule.load(buffer);
                console.log('load result keys:', Object.keys(result));
            } catch (e) {
                console.log('load failed:', e.message);
            }
        }

        // Test 'getText' method
        if (pdfParseModule.getText && typeof pdfParseModule.getText === 'function') {
            console.log('Testing getText method...');
            try {
                const result = await pdfParseModule.getText(buffer);
                console.log('getText result:', result);
            } catch (e) {
                console.log('getText failed:', e.message);
            }
        }

        // Test PDFParse class static parse?
        if (pdfParseModule.PDFParse) {
            console.log('Testing PDFParse...');
            try {
                const parser = new pdfParseModule.PDFParse(buffer);
                console.log('PDFParse instance created');
                // Check methods on instance
                console.log('Instance methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(parser)));
            } catch (e) {
                console.log('PDFParse instantiation failed:', e.message);
            }
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

debugPdfParse();
