import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com';

// Mock session - in real tests, you'd use actual auth
const testPrompts = [
  // Greeting tests
  { category: 'Greetings', prompt: 'Hi', expectedBehavior: 'Should return greeting response only' },
  { category: 'Greetings', prompt: 'Hello', expectedBehavior: 'Should return greeting response only' },
  { category: 'Greetings', prompt: 'Hi,', expectedBehavior: 'Should return greeting response only (punctuation allowed)' },
  { category: 'Greetings', prompt: 'Hi, give notes for UPSC', expectedBehavior: 'Should process full query, not just greeting' },
  { category: 'Greetings', prompt: 'Hello how are you', expectedBehavior: 'Should process as query, not greeting' },
  
  // PYQ queries
  { category: 'PYQ Queries', prompt: 'Give upsc pyqs', expectedBehavior: 'Should return PYQs from database' },
  { category: 'PYQ Queries', prompt: 'PYQ on History', expectedBehavior: 'Should return History PYQs' },
  { category: 'PYQ Queries', prompt: 'Previous year questions about Polity', expectedBehavior: 'Should return Polity PYQs' },
  { category: 'PYQ Queries', prompt: 'PYQ from 2020 to 2024', expectedBehavior: 'Should return PYQs in year range' },
  
  // Study notes
  { category: 'Study Notes', prompt: 'Give notes for UPSC', expectedBehavior: 'Should generate comprehensive notes' },
  { category: 'Study Notes', prompt: 'Notes on Indian Constitution', expectedBehavior: 'Should generate topic-specific notes' },
  { category: 'Study Notes', prompt: 'Study material for Geography', expectedBehavior: 'Should provide study materials' },
  
  // Translation requests
  { category: 'Translation', prompt: 'Translate to Hindi', expectedBehavior: 'Should prompt for text or handle context' },
  
  // Exam-specific queries
  { category: 'Exam Queries', prompt: 'What is the syllabus for UPSC Prelims?', expectedBehavior: 'Should provide syllabus information' },
  { category: 'Exam Queries', prompt: 'How to prepare for PCS exam?', expectedBehavior: 'Should provide preparation guidance' },
  
  // Complex queries
  { category: 'Complex', prompt: 'Explain the difference between federalism and unitary system for UPSC', expectedBehavior: 'Should provide detailed explanation' },
  { category: 'Complex', prompt: 'What are the important topics in Modern History for prelims?', expectedBehavior: 'Should list important topics' },
  
  // Edge cases
  { category: 'Edge Cases', prompt: '', expectedBehavior: 'Should reject empty message' },
  { category: 'Edge Cases', prompt: 'a', expectedBehavior: 'Should process (too short but valid)' },
  { category: 'Edge Cases', prompt: 'Hi there how can you help me with my UPSC preparation?', expectedBehavior: 'Should process full query despite starting with greeting' },
];

async function testPrompt(promptObj, index, total) {
  const { category, prompt, expectedBehavior } = promptObj;
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`[${index + 1}/${total}] Testing: ${category}`);
  console.log(`Prompt: "${prompt}"`);
  console.log(`Expected: ${expectedBehavior}`);
  console.log(`${'='.repeat(80)}`);
  
  if (prompt === '') {
    console.log('  Skipping empty prompt (validation test)');
    return { category, prompt, status: 'skipped', reason: 'empty prompt' };
  }
  
  try {
    // Test the chat API endpoint
    const startTime = Date.now();
    const response = await axios.post(`${BASE_URL}/api/ai/chat`, {
      message: prompt,
      model: 'sonar-pro',
      language: 'en'
    }, {
      timeout: 90000, // 90 seconds for comprehensive responses
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const duration = Date.now() - startTime;
    const responseData = response.data;
    
    if (response.status === 200) {
      const hasResponse = responseData.response && responseData.response.trim().length > 0;
      const responseLength = responseData.response?.length || 0;
      const source = responseData.source || 'ai';
      
      console.log(`✅ Status: Success (${duration}ms)`);
      console.log(`   Source: ${source}`);
      console.log(`   Response length: ${responseLength} characters`);
      
      if (hasResponse) {
        const preview = responseData.response.substring(0, 150).replace(/\n/g, ' ');
        console.log(`   Preview: ${preview}...`);
      } else {
        console.log(`     Empty response received`);
      }
      
      // Check for greeting-specific behavior
      if (category === 'Greetings') {
        if (prompt.toLowerCase().trim() === 'hi' || prompt.toLowerCase().trim() === 'hello' || /^(hi|hello)[\s,;:!.]*$/i.test(prompt.trim())) {
          if (responseData.response && responseData.response.includes('help you prepare')) {
            console.log(`   ✓ Correctly identified as standalone greeting`);
          } else {
            console.log(`     Might not be using greeting response`);
          }
        } else {
          if (!responseData.response.includes('help you prepare') || responseData.response.length > 200) {
            console.log(`   ✓ Correctly processed full query (not just greeting)`);
          } else {
            console.log(`     Might be treating as greeting when it should process full query`);
          }
        }
      }
      
      return {
        category,
        prompt,
        status: 'success',
        duration,
        source,
        responseLength,
        hasResponse
      };
    } else {
      console.log(`❌ Status: Unexpected status ${response.status}`);
      return { category, prompt, status: 'error', reason: `Status ${response.status}` };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    
    if (error.code === 'ECONNABORTED') {
      console.log(`⏱️  Status: Timeout (${duration}ms)`);
      return { category, prompt, status: 'timeout', duration };
    } else if (error.response) {
      console.log(`❌ Status: Error ${error.response.status}`);
      console.log(`   Error: ${error.response.data?.error || error.message}`);
      return { category, prompt, status: 'error', reason: error.response.data?.error || error.message };
    } else {
      console.log(`❌ Status: Network Error`);
      console.log(`   Error: ${error.message}`);
      return { category, prompt, status: 'error', reason: error.message };
    }
  }
}

async function runTests() {
  console.log('\n🧪 Starting Prompt Testing Suite');
  console.log(`📍 Testing against: ${BASE_URL}`);
  console.log(`📝 Total prompts to test: ${testPrompts.length}\n`);
  
  const results = [];
  
  for (let i = 0; i < testPrompts.length; i++) {
    const result = await testPrompt(testPrompts[i], i, testPrompts.length);
    results.push(result);
    
    // Small delay between tests to avoid rate limiting
    if (i < testPrompts.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 TEST SUMMARY');
  console.log(`${'='.repeat(80)}\n`);
  
  const byCategory = {};
  const byStatus = { success: 0, error: 0, timeout: 0, skipped: 0 };
  
  results.forEach(result => {
    if (!byCategory[result.category]) {
      byCategory[result.category] = { success: 0, error: 0, timeout: 0, skipped: 0 };
    }
    byCategory[result.category][result.status] = (byCategory[result.category][result.status] || 0) + 1;
    byStatus[result.status] = (byStatus[result.status] || 0) + 1;
  });
  
  console.log('By Status:');
  Object.entries(byStatus).forEach(([status, count]) => {
    const icon = status === 'success' ? '✅' : status === 'timeout' ? '⏱️' : status === 'skipped' ? '⏭️' : '❌';
    console.log(`  ${icon} ${status}: ${count}`);
  });
  
  console.log('\nBy Category:');
  Object.entries(byCategory).forEach(([category, stats]) => {
    console.log(`\n  ${category}:`);
    Object.entries(stats).forEach(([status, count]) => {
      const icon = status === 'success' ? '✅' : status === 'timeout' ? '⏱️' : status === 'skipped' ? '⏭️' : '❌';
      console.log(`    ${icon} ${status}: ${count}`);
    });
  });
  
  // Failed tests
  const failed = results.filter(r => r.status === 'error' || r.status === 'timeout');
  if (failed.length > 0) {
    console.log(`\n❌ Failed Tests (${failed.length}):`);
    failed.forEach(r => {
      console.log(`  - "${r.prompt}" (${r.category}): ${r.reason || 'timeout'}`);
    });
  }
  
  const successRate = ((byStatus.success / (testPrompts.length - byStatus.skipped)) * 100).toFixed(1);
  console.log(`\n📈 Success Rate: ${successRate}%`);
  console.log(`${'='.repeat(80)}\n`);
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
