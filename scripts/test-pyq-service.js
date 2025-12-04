import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import connectToDatabase from '../lib/mongodb.js';
import PYQ from '../models/PYQ.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function testPyqService() {
    try {
        console.log('🔍 Testing PYQ Service Search...\n');

        // Test queries from the user's chat
        const testQueries = [
            'Search UPSC PYQs for Geography',
            'give geography pyqs',
            'give eco pyqs',
            'PYQ on economics',
            'give pyqs',
            'history pyqs',
            'polity questions',
            'environment pyqs'
        ];

        for (const query of testQueries) {
            console.log(`\n📝 Query: "${query}"`);
            console.log('─'.repeat(60));

            try {
                const result = await pyqService.search(query, null, 'en');

                if (result && result.content) {
                    console.log(`✅ SUCCESS - Found ${result.count || 0} questions`);
                    console.log(`Exam: ${result.context?.examCode || 'N/A'}`);
                    console.log(`Theme: ${result.context?.theme || 'N/A'}`);
                    console.log(`Content preview: ${result.content.substring(0, 200)}...`);
                } else {
                    console.log(`❌ FAILED - No results returned`);
                    console.log(`Result:`, result);
                }
            } catch (error) {
                console.log(`❌ ERROR: ${error.message}`);
                console.error(error.stack);
            }
        }

        console.log('\n\n✓ Test completed!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Fatal error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

testPyqService();
