import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// State PSCs mapped to supported languages
const STATE_PSCS = [
  {
    code: 'TNPSC',
    name: 'Tamil Nadu Public Service Commission',
    language: 'ta',
    officialSites: [
      'https://tnpsc.gov.in/english/AISO-questions.html',
      'https://www.tnpsc.gov.in/Previous_Question_Papers.html',
      'https://www.tnpsc.gov.in/Previous_Year_Question_Papers.html'
    ],
    description: 'Tamil Nadu PSC'
  },
  {
    code: 'MPSC',
    name: 'Maharashtra Public Service Commission',
    language: 'mr',
    officialSites: [
      'https://mpsc.gov.in/prev_que_papers/9',
      'https://mpsc.gov.in/QuestionPapers/PreviousYearQuestionPapers',
      'https://mpsc.gov.in/PreviousYearQuestionPapers'
    ],
    description: 'Maharashtra PSC'
  },
  {
    code: 'BPSC',
    name: 'Bihar Public Service Commission',
    language: 'hi',
    officialSites: [
      'https://bpsc.bih.nic.in/PreviousQuestionPaper.aspx',
      'https://bpsc.bih.nic.in/PreviousQuestionPapers.aspx',
      'https://bpsc.bih.nic.in/QPaper.aspx'
    ],
    description: 'Bihar PSC'
  },
  {
    code: 'WBPSC',
    name: 'West Bengal Public Service Commission',
    language: 'bn',
    officialSites: [
      'https://psc.wb.gov.in/previous_year_question_paper.jsp',
      'https://wbpsc.gov.in/previous_year_question_papers',
      'https://wbpsc.gov.in/question-papers'
    ],
    description: 'West Bengal PSC'
  },
  {
    code: 'PPSC',
    name: 'Punjab Public Service Commission',
    language: 'pa',
    officialSites: [
      'https://ppsc.gov.in/PreviousYearPapers.aspx',
      'https://ppsc.gov.in/PreviousQuestionPapers',
      'https://ppsc.gov.in/QuestionPapers'
    ],
    description: 'Punjab PSC'
  },
  {
    code: 'GPSC',
    name: 'Gujarat Public Service Commission',
    language: 'gu',
    officialSites: [
      'https://gpsc.gujarat.gov.in/PreviousYearQuestionPapers',
      'https://gpsc.gujarat.gov.in/PreviousQuestionPapers',
      'https://gpsc-ojas.gujarat.gov.in/PreviousYearPapers'
    ],
    description: 'Gujarat PSC'
  },
  {
    code: 'KPSC',
    name: 'Karnataka Public Service Commission',
    language: 'kn',
    officialSites: [
      'https://kpsc.kar.nic.in/PreviousYearQuestionPapers',
      'https://kpsc.kar.nic.in/PreviousQuestionPapers',
      'https://kpsc.kar.nic.in/QuestionPapers'
    ],
    description: 'Karnataka PSC'
  },
  {
    code: 'Kerala PSC',
    name: 'Kerala Public Service Commission',
    language: 'ml',
    officialSites: [
      'https://www.keralapsc.gov.in/previous-question-papers',
      'https://www.keralapsc.gov.in/question-papers',
      'https://www.keralapsc.gov.in/PreviousYearQuestionPapers'
    ],
    description: 'Kerala PSC'
  },
  {
    code: 'TSPSC',
    name: 'Telangana State Public Service Commission',
    language: 'te',
    officialSites: [
      'https://www.tspsc.gov.in/PreviousYearQuestionPapers',
      'https://www.tspsc.gov.in/PreviousQuestionPapers',
      'https://www.tspsc.gov.in/QuestionPapers'
    ],
    description: 'Telangana PSC'
  },
  {
    code: 'APPSC',
    name: 'Andhra Pradesh Public Service Commission',
    language: 'te',
    officialSites: [
      'https://psc.ap.gov.in/PreviousYearQuestionPapers',
      'https://psc.ap.gov.in/PreviousQuestionPapers',
      'https://psc.ap.gov.in/QuestionPapers'
    ],
    description: 'Andhra Pradesh PSC'
  },
  {
    code: 'RPSC',
    name: 'Rajasthan Public Service Commission',
    language: 'hi',
    officialSites: [
      'https://rpsc.rajasthan.gov.in/previousquestionpapers.aspx',
      'https://rpsc.rajasthan.gov.in/PreviousYearQuestionPapers',
      'https://rpsc.rajasthan.gov.in/PreviousQuestionPapers'
    ],
    description: 'Rajasthan PSC'
  },
  {
    code: 'UPPSC',
    name: 'Uttar Pradesh Public Service Commission',
    language: 'hi',
    officialSites: [
      'https://uppsc.gov.in/PreviousYearQuestionPapers',
      'https://uppsc.gov.in/PreviousQuestionPapers',
      'https://uppsc.gov.in/QuestionPapers'
    ],
    description: 'Uttar Pradesh PSC'
  },
  {
    code: 'MPPSC',
    name: 'Madhya Pradesh Public Service Commission',
    language: 'hi',
    officialSites: [
      'https://mppsc.nic.in/PreviousYearQuestionPapers',
      'https://mppsc.nic.in/PreviousQuestionPapers',
      'https://mppsc.nic.in/QuestionPapers'
    ],
    description: 'Madhya Pradesh PSC'
  },
  {
    code: 'HPSC',
    name: 'Haryana Public Service Commission',
    language: 'hi',
    officialSites: [
      'https://hpsc.gov.in/PreviousYearQuestionPapers',
      'https://hpsc.gov.in/PreviousQuestionPapers',
      'https://hpsc.gov.in/QuestionPapers'
    ],
    description: 'Haryana PSC'
  }
];

async function runCommand(executable, args, options) {
  const { spawn } = await import('child_process');
  return new Promise((resolve, reject) => {
    const process = spawn(executable, args, options);
    
    let stdout = '';
    let stderr = '';
    
    process.stdout.on('data', (data) => {
      stdout += data.toString();
      process.stdout.write(data); // Also show in real-time
    });
    
    process.stderr.on('data', (data) => {
      stderr += data.toString();
      process.stderr.write(data); // Also show in real-time
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, code });
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr.substring(0, 300)}`));
      }
    });
    
    process.on('error', (error) => {
      reject(new Error(`Failed to start process: ${error.message}`));
    });
  });
}

async function ingestPSC(examConfig) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📋 Starting ingestion for: ${examConfig.name} (${examConfig.code})`);
  console.log(`${'='.repeat(70)}`);

  let totalInserted = 0;
  let successfulUrls = 0;
  let failedUrls = 0;

  for (const url of examConfig.officialSites) {
    try {
      console.log(`\n🔍 Trying: ${url}`);
      
      // Use array-based arguments to avoid shell quoting issues
      const scriptPath = path.join(__dirname, 'pyq-crawl.js');
      const args = [
        scriptPath,
        '--exam', examConfig.code,
        '--root', url,
        '--maxDepth', '2',
        '--maxPages', '50'
      ];
      
      const { stdout, stderr } = await runCommand('node', args, {
        cwd: path.join(__dirname, '..'),
        env: { ...process.env },
        shell: false // Don't use shell to avoid quote issues
      });

      if (stdout) {
        // Extract the count from output like "Crawl complete: pages=50, inserted=123"
        const match = stdout.match(/inserted[=:]\s*(\d+)/i);
        if (match) {
          const count = parseInt(match[1], 10);
          totalInserted += count;
          if (count > 0) {
            successfulUrls++;
            console.log(`\n   ✅ Success! Inserted ${count} PYQs from this URL`);
          } else {
            console.log(`\n   ⚠️  No questions found (might be wrong URL structure)`);
          }
        } else {
          console.log(`\n   ✅ Process completed (check logs above for details)`);
        }
      }
      
      if (stderr && !stderr.includes('Warning') && !stderr.includes('⚠️') && stderr.trim()) {
        console.warn(`\n   ⚠️  Warnings: ${stderr.substring(0, 300)}`);
      }

      // Small delay between URLs
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      failedUrls++;
      const errorMsg = error.message || String(error);
      console.error(`\n   ❌ Failed: ${errorMsg.substring(0, 400)}`);
      if (errorMsg.length > 400) {
        console.error(`   ... (truncated)`);
      }
      // Continue with next URL
    }
  }

  console.log(`\n📊 Summary for ${examConfig.code}:`);
  console.log(`   ✅ Successful URLs: ${successfulUrls}/${examConfig.officialSites.length}`);
  console.log(`   ❌ Failed URLs: ${failedUrls}/${examConfig.officialSites.length}`);
  console.log(`   📝 Total PYQs inserted: ${totalInserted}`);

  return { code: examConfig.code, inserted: totalInserted, successfulUrls, failedUrls };
}

async function main() {
  const args = process.argv.slice(2);
  
  // Show help if requested
  if (args.includes('--help') || args.includes('-h')) {
    console.log('\n📚 PYQ Batch Ingestion Script for Regional PSCs\n');
    console.log('Usage:');
    console.log('  node scripts/pyq-ingest-all-pscs.js                    # Process all PSCs');
    console.log('  node scripts/pyq-ingest-all-pscs.js --all             # Process all PSCs');
    console.log('  node scripts/pyq-ingest-all-pscs.js TNPSC MPSC BPSC    # Process specific PSCs\n');
    console.log('Available PSC Codes:\n');
    STATE_PSCS.forEach(psc => {
      console.log(`  ${psc.code.padEnd(15)} - ${psc.name} (${psc.language.toUpperCase()})`);
    });
    console.log('\nNote:');
    console.log('  - Each PSC will try multiple official website URLs');
    console.log('  - Questions are auto-verified if from official government domains');
    console.log('  - OCR is used for scanned PDFs (Mistral, then Gemini)');
    console.log('  - This process may take several hours for all PSCs\n');
    process.exit(0);
  }
  
  // Allow filtering by specific PSC codes
  let pscsToProcess = STATE_PSCS;
  if (args.length > 0 && args[0] !== '--all') {
    const requestedCodes = args.map(arg => arg.toUpperCase());
    pscsToProcess = STATE_PSCS.filter(psc => 
      requestedCodes.some(code => psc.code.toUpperCase().includes(code))
    );
    
    if (pscsToProcess.length === 0) {
      console.error('❌ No matching PSCs found. Available codes:');
      STATE_PSCS.forEach(psc => console.error(`   - ${psc.code}: ${psc.name}`));
      console.error('\nUse --help to see full list and usage.');
      process.exit(1);
    }
  }

  console.log('🚀 Starting batch ingestion for regional PSC exams\n');
  console.log(`📋 Processing ${pscsToProcess.length} PSC(s):\n`);
  pscsToProcess.forEach(psc => {
    console.log(`   - ${psc.code}: ${psc.name} (${psc.language.toUpperCase()})`);
  });

  const results = [];

  for (const psc of pscsToProcess) {
    try {
      const result = await ingestPSC(psc);
      results.push(result);
      
      // Delay between different PSCs
      console.log('\n⏳ Waiting 5 seconds before next PSC...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (error) {
      console.error(`❌ Fatal error processing ${psc.code}: ${error.message}`);
      results.push({ code: psc.code, inserted: 0, error: error.message });
    }
  }

  // Final summary
  console.log(`\n${'='.repeat(70)}`);
  console.log('📊 FINAL SUMMARY - Batch Ingestion Complete');
  console.log(`${'='.repeat(70)}\n`);

  results.forEach(result => {
    if (result.error) {
      console.log(`❌ ${result.code}: FAILED - ${result.error}`);
    } else {
      console.log(`${result.inserted > 0 ? '✅' : '⚠️'} ${result.code}: ${result.inserted} PYQs inserted (${result.successfulUrls} URLs successful)`);
    }
  });

  const totalInserted = results.reduce((sum, r) => sum + (r.inserted || 0), 0);
  const successfulPSCs = results.filter(r => r.inserted > 0).length;

  console.log(`\n🎯 Overall Results:`);
  console.log(`   Total PYQs inserted: ${totalInserted.toLocaleString()}`);
  console.log(`   Successful PSCs: ${successfulPSCs}/${results.length}`);
  console.log(`   Failed PSCs: ${results.length - successfulPSCs}/${results.length}`);

  console.log('\n✅ Batch ingestion complete!');
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

