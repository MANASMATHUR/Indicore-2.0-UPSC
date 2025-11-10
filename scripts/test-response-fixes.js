/**
 * Test script to verify response cleaning fixes
 * Tests the improved response cleaning and validation
 */

import { cleanAIResponse, validateAndCleanResponse, isGarbledResponse } from '../lib/responseCleaner.js';

// Test cases that should be fixed
const testCases = [
  {
    name: 'Incomplete sentence ending with "and"',
    input: 'Akbar was a great Mughal emperor who ruled India and',
    shouldBeComplete: true
  },
  {
    name: 'Incomplete sentence ending with "I can"',
    input: 'I can help you with your exam preparation. I can',
    shouldBeComplete: true
  },
  {
    name: 'Incomplete sentence ending with "Let me"',
    input: 'The answer to your question is complex. Let me',
    shouldBeComplete: true
  },
  {
    name: 'Incomplete sentence ending with "the"',
    input: 'The best books for UPSC are comprehensive and cover all topics. The',
    shouldBeComplete: true
  },
  {
    name: 'Response with citations',
    input: 'Akbar was a great emperor [1]. He ruled from 1556 to 1605 [2, 3]. His legacy includes administrative reforms.',
    shouldBeComplete: true,
    shouldRemoveCitations: true
  },
  {
    name: 'Complete response',
    input: 'Akbar was a great Mughal emperor who ruled India from 1556 to 1605. He implemented significant administrative reforms and promoted religious tolerance.',
    shouldBeComplete: true
  },
  {
    name: 'Response ending with incomplete phrase',
    input: 'The UPSC syllabus covers various subjects including history, geography, polity, economics, and',
    shouldBeComplete: true
  },
  {
    name: 'Garbled response pattern',
    input: 'I\'m here to support you with your exam preparation. How can I assist you today?',
    shouldBeComplete: false, // Should be removed as garbled
    isGarbled: true
  },
  {
    name: 'Response with source references',
    input: 'The answer is correct. (Source: UPSC Official Website) This information is accurate.',
    shouldBeComplete: true,
    shouldRemoveSource: true
  },
  {
    name: 'Multiple incomplete endings',
    input: 'The best approach is to study consistently. Make sure to revise regularly. Also remember to',
    shouldBeComplete: true
  }
];

console.log('🧪 Testing Response Cleaning Fixes\n');
console.log('=' .repeat(80));

let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
  console.log(`\nTest ${index + 1}: ${testCase.name}`);
  console.log(`Input: "${testCase.input}"`);
  
  const cleaned = cleanAIResponse(testCase.input);
  const isValid = validateAndCleanResponse(cleaned, 20);
  const isGarbled = isGarbledResponse(testCase.input);
  
  console.log(`Cleaned: "${cleaned}"`);
  console.log(`Valid: ${isValid ? '✅' : '❌'}`);
  console.log(`Garbled: ${isGarbled ? '⚠️' : '✅'}`);
  
  // Check if citations were removed
  if (testCase.shouldRemoveCitations) {
    const hasCitations = /\[\d+/.test(cleaned);
    if (!hasCitations) {
      console.log(`Citations removed: ✅`);
    } else {
      console.log(`Citations removed: ❌`);
    }
  }
  
  // Check if source was removed
  if (testCase.shouldRemoveSource) {
    const hasSource = /Source/i.test(cleaned);
    if (!hasSource) {
      console.log(`Source removed: ✅`);
    } else {
      console.log(`Source removed: ❌`);
    }
  }
  
  // Check if response is complete
  if (testCase.shouldBeComplete) {
    const endsProperly = /[.!?]$/.test(cleaned);
    const hasIncompleteEnding = /\s+(?:and|or|but|the|a|to|from|with|for|I can|Let me)\s*$/i.test(cleaned);
    
    if (isValid && !hasIncompleteEnding && (endsProperly || cleaned.length > 50)) {
      console.log(`Complete response: ✅`);
      passed++;
    } else {
      console.log(`Complete response: ❌`);
      failed++;
    }
  } else if (testCase.isGarbled) {
    if (isGarbled || !isValid) {
      console.log(`Garbled detected: ✅`);
      passed++;
    } else {
      console.log(`Garbled detected: ❌`);
      failed++;
    }
  } else {
    if (isValid) {
      passed++;
    } else {
      failed++;
    }
  }
});

console.log('\n' + '='.repeat(80));
console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
console.log(`Success Rate: ${((passed / testCases.length) * 100).toFixed(1)}%\n`);

if (failed === 0) {
  console.log('✅ All tests passed! Response cleaning fixes are working correctly.\n');
  process.exit(0);
} else {
  console.log('⚠️  Some tests failed. Review the output above.\n');
  process.exit(1);
}

