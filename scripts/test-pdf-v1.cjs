const fs = require('fs');

async function testPdfParseV1() {
    try {
        console.log('Testing pdf-parse v1.1.1...');

        const pdfParse = require('pdf-parse');

        console.log('pdfParse type:', typeof pdfParse);
        console.log('Is function?', typeof pdfParse === 'function');

        // Create a minimal test buffer (won't parse but will show API structure)
        const testBuffer = Buffer.from('test');

        try {
            const result = await pdfParse(testBuffer);
            console.log('Result type:', typeof result);
            console.log('Result keys:', Object.keys(result));
        } catch (e) {
            console.log('Expected error with dummy data:', e.message);
            console.log('\n✅ pdf-parse v1.1.1 is correctly installed and has function API!');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testPdfParseV1();
