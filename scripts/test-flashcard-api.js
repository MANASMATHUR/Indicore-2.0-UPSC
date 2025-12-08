
async function testFlashcards() {
    try {
        console.log('Testing Flashcard API...');
        const response = await fetch('http://localhost:3000/api/flashcards/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: "The Constitution of India is the supreme law of India. The document lays down the framework that demarcates fundamental political code, structure, procedures, powers, and duties of government institutions and sets out fundamental rights, directive principles, and the duties of citizens. It is the longest written constitution of any country on earth. B. R. Ambedkar, chairman of the drafting committee, is widely considered to be its chief architect.",
                provider: "openai",
                model: "gpt-4o"
            }),
        });

        const data = await response.json();
        console.log('Status:', response.status);
        console.log('Response:', JSON.stringify(data, null, 2));

    } catch (error) {
        console.error('Test failed:', error);
    }
}

testFlashcards();
