const fs = require('fs');
const path = require('path');

async function testPdfParse() {
    try {
        console.log('Testing PDF parsing...');

        // Create a simple test - just verify the API works
        const { PDFParse } = require('pdf-parse');

        // Create a dummy buffer (in real usage, this would be actual PDF data)
        const dummyBuffer = Buffer.from('test');

        console.log('Creating PDFParse instance...');
        const parser = new PDFParse(dummyBuffer);

        console.log('PDFParse instance created successfully!');
        console.log('Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(parser)));

        console.log('\n✅ PDF parsing setup is correct!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    }
}

testPdfParse();
