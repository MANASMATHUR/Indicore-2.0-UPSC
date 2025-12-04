// Quick test for exam code detection
const testQueries = [
    'Search UPSC PYQs for Geography',
    'give geography pyqs',
    'give geo pyqs',
    'PYQ on economics',
    'give pyqs',
    'history pyqs',
    'GPSC geography questions',
    'UPSC polity questions'
];

function detectExamCode(userMsg) {
    const patterns = [
        // UPSC should be checked FIRST (highest priority)
        { test: /\bupsc\b/i, code: 'UPSC' },

        // State PSCs with word boundaries to prevent false matches
        { test: /\bgpsc\b|gujarat psc/i, code: 'GPSC' },
        { test: /\bssc\b/i, code: 'SSC' },
        { test: /\bpcs\b/i, code: 'PCS' }
    ];

    for (const pattern of patterns) {
        if (pattern.test.test(userMsg)) {
            return pattern.code;
        }
    }

    // Default to UPSC if no exam is explicitly mentioned
    return 'UPSC';
}

console.log('Testing Exam Code Detection:\n');
testQueries.forEach(query => {
    const detected = detectExamCode(query);
    console.log(`"${query}" -> ${detected}`);
});
