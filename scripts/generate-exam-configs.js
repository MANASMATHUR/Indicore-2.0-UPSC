import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import axios from 'axios';

// Load env
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath });
} else {
    dotenv.config();
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPEN_AI_KEY;

const EXAMS = [
    { code: 'TNPSC', name: 'Tamil Nadu Public Service Commission', lang: 'Tamil' },
    { code: 'MPSC', name: 'Maharashtra Public Service Commission', lang: 'Marathi' },
    { code: 'RAS', name: 'Rajasthan Administrative Service (RPSC)', lang: 'Hindi' },
    { code: 'BPSC', name: 'Bihar Public Service Commission', lang: 'Hindi' },
    { code: 'UPPSC', name: 'Uttar Pradesh Public Service Commission', lang: 'Hindi' },
    { code: 'MPPSC', name: 'Madhya Pradesh Public Service Commission', lang: 'Hindi' },
    { code: 'GPSC', name: 'Gujarat Public Service Commission', lang: 'Gujarati' },
    { code: 'KPSC', name: 'Karnataka Public Service Commission', lang: 'Kannada' },
    { code: 'WBPSC', name: 'West Bengal Public Service Commission', lang: 'Bengali' },
    { code: 'PPSC', name: 'Punjab Public Service Commission', lang: 'Punjabi' },
    { code: 'SSC', name: 'Staff Selection Commission (CGL)', lang: 'English' } // User said "similarly for other states", SSC is central. keeping English default but mentioning Hindi option in prompt.
];

async function generateConfigs() {
    if (!OPENAI_API_KEY) {
        console.error('❌ Missing OPENAI_API_KEY');
        process.exit(1);
    }

    const configs = {};
    const outputDir = path.resolve(process.cwd(), 'config');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    console.log(`🤖 Generating Exam Blueprints for ${EXAMS.length} exams...`);

    for (const exam of EXAMS) {
        console.log(`\n🔍 Researching Pattern for: ${exam.name} (${exam.code})...`);

        const prompt = `
      Create a detailed study configuration for the **${exam.name} (${exam.code})** exam.
      The target language for questions is **${exam.lang}**.

      Output a JSON object with:
      1. "code": "${exam.code}"
      2. "language": "${exam.lang}"
      3. "stages": ["Prelims", "Mains"] (or Tier 1/2 for SSC)
      4. "subjects": A key-value map of subjects and their approximate weightage in Prelims (total 100%).
         Example: { "History": 20, "Polity": 15, "State Specific GK": 25 }
         **CRITICAL**: Include "State Specific GK" if applicable (e.g. Tamil Nadu History for TNPSC).
      5. "syllabus": An object where keys are Subjects and values are arrays of 10-15 detailed sub-topics.
      6. "prelimsPattern": { "questionCount": 150, "options": 4, "negativeMarking": true }

      Ensure the syllabus is comprehensive and accurate for the latest pattern.
    `;

        try {
            const response = await axios.post(
                'https://api.openai.com/v1/chat/completions',
                {
                    model: 'gpt-4o',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.2, // Low temp for factual accuracy
                    response_format: { type: "json_object" }
                },
                { headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` } }
            );

            const data = JSON.parse(response.data.choices[0].message.content);
            configs[exam.code] = data;
            console.log(`   ✅ Config generated for ${exam.code} (Subjects: ${Object.keys(data.subjects).length})`);

        } catch (err) {
            console.error(`   ❌ Failed for ${exam.code}: ${err.message}`);
        }
    }

    const outputPath = path.join(outputDir, 'exam-patterns.json');
    fs.writeFileSync(outputPath, JSON.stringify(configs, null, 2));
    console.log(`\n💾 Saved blueprints to ${outputPath}`);
}

generateConfigs();
