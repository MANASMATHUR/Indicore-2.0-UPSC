import { contextualLayer } from '../lib/contextual-layer.js';

// Test prompts and expected behaviors
const testCases = [
  // Greeting tests - should return quick response
  {
    prompt: 'Hi',
    shouldBeQuick: true,
    shouldMatchGreeting: true,
    description: 'Standalone greeting'
  },
  {
    prompt: 'Hello',
    shouldBeQuick: true,
    shouldMatchGreeting: true,
    description: 'Standalone hello'
  },
  {
    prompt: 'Hi,',
    shouldBeQuick: true,
    shouldMatchGreeting: true,
    description: 'Greeting with comma'
  },
  {
    prompt: 'Hello!',
    shouldBeQuick: true,
    shouldMatchGreeting: true,
    description: 'Greeting with exclamation'
  },
  
  // Greeting with content - should NOT be quick response, should go to AI
  {
    prompt: 'Hi, give notes for UPSC',
    shouldBeQuick: false,
    shouldMatchGreeting: false,
    description: 'Greeting + query (should process full query)'
  },
  {
    prompt: 'Hello how are you',
    shouldBeQuick: false,
    shouldMatchGreeting: false,
    description: 'Greeting + question (should process)'
  },
  {
    prompt: 'Hi there how can you help me?',
    shouldBeQuick: false,
    shouldMatchGreeting: false,
    description: 'Greeting + help request (should process)'
  },
  
  // PYQ queries - should require AI
  {
    prompt: 'Give upsc pyqs',
    shouldBeQuick: false,
    shouldRequireAI: true,
    description: 'PYQ request'
  },
  {
    prompt: 'PYQ on History',
    shouldBeQuick: false,
    shouldRequireAI: true,
    description: 'PYQ with topic'
  },
  
  // Study notes - should require AI
  {
    prompt: 'Give notes for UPSC',
    shouldBeQuick: false,
    shouldRequireAI: true,
    description: 'Notes request'
  },
  {
    prompt: 'Notes on Indian Constitution',
    shouldBeQuick: false,
    shouldRequireAI: true,
    description: 'Topic-specific notes'
  },
  
  // Quick response candidates
  {
    prompt: 'What is UPSC?',
    shouldBeQuick: true,
    description: 'Basic exam info (quick response pattern)'
  },
  {
    prompt: 'Syllabus for UPSC',
    shouldBeQuick: true,
    description: 'Syllabus query (quick response pattern)'
  },
  {
    prompt: 'UPSC Prelims',
    shouldBeQuick: true,
    description: 'Prelims info (quick response pattern)'
  },
];

console.log('\n🧪 Testing Prompt Logic');
console.log('='.repeat(80));

let passed = 0;
let failed = 0;
const issues = [];

testCases.forEach((testCase, index) => {
  const { prompt, description } = testCase;
  
  console.log(`\n[${index + 1}/${testCases.length}] ${description}`);
  console.log(`Prompt: "${prompt}"`);
  
  try {
    // Test contextual layer analysis
    const analysis = contextualLayer.analyzeMessage(prompt);
    const quickResponse = contextualLayer.getQuickResponse(prompt);
    
    console.log(`  Analysis:`);
    console.log(`    Type: ${analysis.type}`);
    console.log(`    Requires AI: ${analysis.requiresAI}`);
    console.log(`    Confidence: ${analysis.confidence}`);
    console.log(`    Quick Response: ${quickResponse ? 'Yes' : 'No'}`);
    
    // Check greeting detection
    const trimmedMsg = prompt.trim();
    const isGreetingOnly = /^(hi|hello|hey|good morning|good afternoon|good evening)[\s,;:!.]*$/i.test(trimmedMsg);
    
    console.log(`  Greeting Detection:`);
    console.log(`    Is standalone greeting: ${isGreetingOnly}`);
    
    // Validate expectations
    let testPassed = true;
    const errors = [];
    
    if ('shouldBeQuick' in testCase) {
      const actualIsQuick = quickResponse !== null;
      if (actualIsQuick !== testCase.shouldBeQuick) {
        testPassed = false;
        errors.push(`Quick response: expected ${testCase.shouldBeQuick}, got ${actualIsQuick}`);
      }
    }
    
    if ('shouldMatchGreeting' in testCase) {
      if (isGreetingOnly !== testCase.shouldMatchGreeting) {
        testPassed = false;
        errors.push(`Greeting match: expected ${testCase.shouldMatchGreeting}, got ${isGreetingOnly}`);
      }
    }
    
    if ('shouldRequireAI' in testCase) {
      if (analysis.requiresAI !== testCase.shouldRequireAI) {
        testPassed = false;
        errors.push(`Requires AI: expected ${testCase.shouldRequireAI}, got ${analysis.requiresAI}`);
      }
    }
    
    if (testPassed) {
      console.log(`  ✅ PASSED`);
      passed++;
    } else {
      console.log(`  ❌ FAILED`);
      errors.forEach(err => console.log(`    - ${err}`));
      failed++;
      issues.push({
        prompt,
        description,
        errors
      });
    }
    
  } catch (error) {
    console.log(`  ❌ ERROR: ${error.message}`);
    failed++;
    issues.push({
      prompt,
      description,
      error: error.message
    });
  }
});

// Summary
console.log(`\n${'='.repeat(80)}`);
console.log('📊 TEST SUMMARY');
console.log(`${'='.repeat(80)}`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📈 Success Rate: ${((passed / testCases.length) * 100).toFixed(1)}%`);

if (issues.length > 0) {
  console.log(`\n❌ Issues Found:`);
  issues.forEach((issue, i) => {
    console.log(`\n${i + 1}. "${issue.prompt}" (${issue.description})`);
    if (issue.errors) {
      issue.errors.forEach(err => console.log(`   - ${err}`));
    }
    if (issue.error) {
      console.log(`   - Error: ${issue.error}`);
    }
  });
}

console.log(`${'='.repeat(80)}\n`);

process.exit(failed > 0 ? 1 : 0);

