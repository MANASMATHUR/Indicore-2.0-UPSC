// Native fetch is available in Node.js 18+

async function testVocabularyGeneration() {
    console.log('Testing Vocabulary Generation API...');

    try {
        const response = await fetch('http://localhost:3000/api/ai/generate-vocabulary', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                category: 'general',
                sourceLanguage: 'en',
                targetLanguage: 'hi',
                difficulty: 'intermediate',
                count: 5
            })
        });

        console.log(`Status Code: ${response.status}`);

        if (response.ok) {
            const data = await response.json();
            console.log('Success! Received data:', JSON.stringify(data, null, 2));
        } else {
            console.log('Error status:', response.status);
            const text = await response.text();
            console.log('Error body:', text);
        }

    } catch (error) {
        console.error('Request failed:', error);
    }
}

testVocabularyGeneration();
