const fs = require('fs');
const path = require('path');

async function testPdfMethods() {
    try {
        console.log('Testing PDF parsing methods...');

        const { PDFParse } = require('pdf-parse');

        // Create a simple test buffer
        const testBuffer = Buffer.from('test data');
        const uint8Array = new Uint8Array(testBuffer);

        console.log('Creating PDFParse instance with Uint8Array...');
        const parser = new PDFParse(uint8Array);

        console.log('\nTesting getText() method...');
        try {
            const textResult = await parser.getText();
            console.log('getText() returned type:', typeof textResult);
            console.log('getText() result:', textResult);
            console.log('Is string?', typeof textResult === 'string');
        } catch (e) {
            console.log('getText() error:', e.message);
        }

        console.log('\nTesting load() method...');
        try {
            const loadResult = await parser.load();
            console.log('load() returned type:', typeof loadResult);
            console.log('load() result keys:', Object.keys(loadResult || {}));
            if (loadResult && loadResult.text) {
                console.log('load().text type:', typeof loadResult.text);
            }
        } catch (e) {
            console.log('load() error:', e.message);
        }

    } catch (error) {
        console.error('Error:', error.message);
    }
}

testPdfMethods();
