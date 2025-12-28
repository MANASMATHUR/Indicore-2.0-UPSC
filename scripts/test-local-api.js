const fetch = require('node-fetch');

async function testVocabularyAPI() {
    const url = 'http://localhost:3000/api/ai/generate-vocabulary';

    console.log(`Testing API at: ${url}`);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Mocking session cookie might be needed if auth is strict, 
                // but for 405 check, just hitting the endpoint is enough.
            },
            body: JSON.stringify({
                category: 'general',
                sourceLanguage: 'en',
                targetLanguage: 'hi',
                difficulty: 'intermediate',
                count: 5
            })
        });

        console.log(`Response Status: ${response.status} ${response.statusText}`);

        if (response.ok) {
            const data = await response.json();
            console.log('Response Data:', JSON.stringify(data, null, 2));
        } else {
            const text = await response.text();
            console.log('Error Body:', text);
        }

    } catch (error) {
        console.error('Test failed:', error);
    }
}

testVocabularyAPI();
