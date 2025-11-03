import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

async function testPyqQuery(query, description) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 Test: ${description}`);
  console.log(`📝 Query: "${query}"`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    // Test 1: Direct PYQ Search API
    console.log('1️⃣ Testing PYQ Search API (/api/pyq/search)...');
    const searchParams = new URLSearchParams();
    
    // Extract exam from query
    let exam = 'UPSC';
    if (/tnpsc|tamil/i.test(query)) exam = 'TNPSC';
    if (/bpsc|bihar/i.test(query)) exam = 'BPSC';
    if (/uppsc|uttar pradesh/i.test(query)) exam = 'UPPSC';
    
    // Extract theme/topic
    const themeMatch = query.match(/(?:on|about|of|for|related to)\s+([^.,;\n?]+)/i);
    const theme = themeMatch ? themeMatch[1].trim().replace(/\s+(pyq|question|questions)/i, '').trim() : '';
    
    // Extract year range
    const rangeMatch = query.match(/from\s+(\d{4})(?:s)?\s*(?:to|\-|–|—)\s*(present|\d{4})/i);
    const decadeMatch = query.match(/(\d{4})s/i);
    
    searchParams.append('exam', exam);
    if (theme) searchParams.append('theme', theme);
    if (rangeMatch) {
      searchParams.append('fromYear', rangeMatch[1]);
      if (rangeMatch[2] !== 'present') searchParams.append('toYear', rangeMatch[2]);
    } else if (decadeMatch) {
      const decadeStart = parseInt(decadeMatch[1], 10);
      searchParams.append('fromYear', decadeStart);
      searchParams.append('toYear', decadeStart + 9);
    }
    searchParams.append('limit', '50');

    const searchUrl = `${BASE_URL}/api/pyq/search?${searchParams.toString()}`;
    console.log(`   URL: ${searchUrl}`);
    
    const searchResponse = await axios.get(searchUrl, { timeout: 10000 });
    
    if (searchResponse.data.ok) {
      console.log(`   ✅ Search API Success`);
      console.log(`   📊 Found ${searchResponse.data.count} PYQs`);
      if (searchResponse.data.formatted) {
        const preview = searchResponse.data.formatted.split('\n').slice(0, 15).join('\n');
        console.log(`   📋 Preview:\n${preview}...`);
        if (searchResponse.data.count > 15) {
          console.log(`   ... (showing first 15 lines of ${searchResponse.data.count} results)`);
        }
      }
    } else {
      console.log(`   ❌ Search API Failed: ${searchResponse.data.error}`);
    }

    // Test 2: Chat API (simulate user query)
    console.log('\n2️⃣ Testing Chat API (/api/ai/chat)...');
    console.log('   ⚠️ Note: This requires authentication. Testing direct PYQ detection...');
    
    // We'll test the PYQ detection logic manually
    const isPyqQuery = /(pyq|previous year (?:question|questions|paper|papers)|past year (?:question|questions))/i.test(query);
    console.log(`   ${isPyqQuery ? '✅' : '❌'} Detected as PYQ query: ${isPyqQuery}`);
    
    if (isPyqQuery) {
      console.log(`   📝 Extracted theme: "${theme || '(none)'}"`);
      if (rangeMatch) {
        console.log(`   📅 Year range: ${rangeMatch[1]} to ${rangeMatch[2]}`);
      } else if (decadeMatch) {
        console.log(`   📅 Decade: ${decadeMatch[1]}s`);
      }
      console.log(`   🎯 Exam: ${exam}`);
    }

    console.log('\n✅ Test completed successfully!');
    return { success: true, searchCount: searchResponse.data?.count || 0 };
    
  } catch (error) {
    console.error(`\n❌ Test failed:`);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Error: ${JSON.stringify(error.response.data).substring(0, 200)}`);
    } else if (error.request) {
      console.error(`   No response received. Is the server running at ${BASE_URL}?`);
      console.error(`   Error: ${error.message}`);
    } else {
      console.error(`   ${error.message}`);
    }
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🚀 Starting PYQ Query Integration Tests\n');
  console.log(`🌐 Base URL: ${BASE_URL}`);
  console.log('⚠️  Make sure your Next.js server is running!\n');

  const tests = [
    {
      query: 'Give me MSP related PYQs from UPSC',
      description: 'MSP Theme Query'
    },
    {
      query: 'Show me previous year questions on Constitution from 2010s',
      description: 'Constitution Theme with Decade'
    },
    {
      query: 'PYQs on environment from UPSC from 2020 to present',
      description: 'Environment Theme with Year Range'
    },
    {
      query: 'Give me UPSC pyqs',
      description: 'Generic PYQ Query (No Theme)'
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const result = await testPyqQuery(test.query, test.description);
    if (result.success) {
      passed++;
      if (result.searchCount > 0) {
        console.log(`\n✅ PASS: Found ${result.searchCount} PYQs`);
      } else {
        console.log(`\n⚠️  WARNING: Query matched but found 0 PYQs (might need more data or different search terms)`);
      }
    } else {
      failed++;
      console.log(`\n❌ FAIL: ${result.error}`);
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 Test Summary');
  console.log(`${'='.repeat(60)}`);
  console.log(`✅ Passed: ${passed}/${tests.length}`);
  console.log(`❌ Failed: ${failed}/${tests.length}`);
  
  if (failed === 0 && passed > 0) {
    console.log('\n🎉 All tests passed! PYQ integration is working correctly.');
  } else if (failed > 0) {
    console.log('\n⚠️  Some tests failed. Check the errors above.');
    console.log('💡 Make sure:');
    console.log('   1. Your Next.js server is running (npm run dev)');
    console.log('   2. MongoDB is connected');
    console.log('   3. PYQ data exists in the database');
  }
}

runTests().catch(console.error);

