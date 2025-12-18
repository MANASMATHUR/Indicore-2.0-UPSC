# Test Solve Request Detection

This script tests the improved solve request detection logic to ensure messages like
"Please solve this previous year question: What is..." are properly recognized.

const testCases = [
    {
        name: "Direct question with colon",
        message: "Please solve this previous year question:\n\nWhat does 'evidence', under the Indian Evidence Act, 1872, mean?",
        expectedDetection: "solve_request",
        description: "Should detect as solve request, not PYQ database search"
    },
    {
        name: "Simple solve with polite phrase",
        message: "Please solve this economics question",
        expectedDetection: "solve_request_with_context",
        description: "Should detect as solve request when PYQ context exists"
    },
    {
        name: "Answer this question with colon",
        message: "Answer this question: Explain the concept of fundamental rights",
        expectedDetection: "solve_request",
        description: "Should detect 'answer' command with embedded question"
    },
    {
        name: "Explain with kindly",
        message: "Kindly explain this previous year question: Discuss the impact of globalization",
        expectedDetection: "solve_request",
        description: "Should handle 'kindly' polite phrase"
    },
    {
        name: "Normal PYQ search",
        message: "Show me economics pyqs from 2015",
        expectedDetection: "pyq_search",
        description: "Should NOT detect as solve request - normal search"
    },
    {
        name: "Topic extraction test",
        message: "solve this economics question",
        expectedTopic: "economics",
        description: "Should extract 'economics' as topic, not 'solve this'"
    }
];

console.log("=== Testing Solve Request Detection ===\n");

// Test the regex patterns
const testPatterns = () => {
    testCases.forEach((testCase, index) => {
        console.log(`\nTest ${index + 1}: ${testCase.name}`);
        console.log(`Message: "${testCase.message.substring(0, 100)}${testCase.message.length > 100 ? '...' : ''}"`);

        const trimmedMsg = testCase.message.trim();

        // Pattern 1: Embedded questions after colons
        const hasEmbeddedQuestion = /(?:please|kindly|can\s+you|could\s+you)?\s*(?:solve|answer|explain)\s+(?:this|the)\s+(?:previous\s+year\s+)?question\s*:\s*.{20,}/i.test(trimmedMsg);

        // Pattern 2: Context-based solve (simulating previousPyqContext exists)
        const hasSolveWithContext = /^(?:please|kindly|can\s+you|could\s+you)?\s*(?:solve|answer|explain|provide\s+(?:answers?|solutions?)|give\s+(?:answers?|solutions?))/i.test(trimmedMsg);

        const isSolveRequest = hasEmbeddedQuestion;
        const isPyqSearch = /(?:pyq|pyqs|previous\s+year|show|give|get)\s+.*(?:from|about|on)/i.test(trimmedMsg) && !isSolveRequest;

        console.log(`  - Embedded question pattern: ${hasEmbeddedQuestion ? '✓' : '✗'}`);
        console.log(`  - Solve with context pattern: ${hasSolveWithContext ? '✓' : '✗'}`);
        console.log(`  - Detected as: ${isSolveRequest ? 'SOLVE REQUEST' : isPyqSearch ? 'PYQ SEARCH' : 'UNKNOWN'}`);

        if (testCase.expectedDetection === "solve_request" && isSolveRequest) {
            console.log(`  ✅ PASS - Correctly detected as solve request`);
        } else if (testCase.expectedDetection === "pyq_search" && !isSolveRequest) {
            console.log(`  ✅ PASS - Correctly NOT detected as solve request`);
        } else {
            console.log(`  ❌ FAIL - Expected: ${testCase.expectedDetection}, Got: ${isSolveRequest ? 'solve_request' : 'pyq_search'}`);
        }

        // Test topic extraction
        if (testCase.expectedTopic) {
            let cleanMsg = testCase.message.replace(/\b(can you|could you|would you|please|kindly|i need|i want|i'd like|solve|answer|explain)\b/gi, '');
            cleanMsg = cleanMsg.replace(/\b(show|give|get|find|search|fetch|list|bring|tell|need|want|bring|solve|answer|explain)\s+me\b/gi, '');
            cleanMsg = cleanMsg.replace(/\b(pyq|pyqs|previous year|past year|questions|question|papers|paper|this|the|a|an)\b/gi, '').trim();
            const extractedWords = cleanMsg.split(/\s+/).filter(w => w.length > 1);
            const extractedTopic = extractedWords[0] || '';

            console.log(`  - Topic extraction: "${extractedTopic}"`);
            if (extractedTopic.toLowerCase() === testCase.expectedTopic.toLowerCase()) {
                console.log(`  ✅ PASS - Correctly extracted topic: ${testCase.expectedTopic}`);
            } else {
                console.log(`  ❌ FAIL - Expected topic: ${testCase.expectedTopic}, Got: ${extractedTopic}`);
            }
        }
    });
};

testPatterns();

console.log("\n\n=== Summary ===");
console.log("✅ Solve request detection should now handle:");
console.log("   - Polite phrases (please, kindly, can you, could you)");
console.log("   - Embedded questions after colons");
console.log("   - Command verbs filtered from topic extraction");
console.log("\n✅ Normal PYQ searches should still work as expected");
