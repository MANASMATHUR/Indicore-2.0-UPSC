/**
 * Test LLM Normalization
 * Run: node scripts/test-llm-normalization.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const PyqSchema = new mongoose.Schema({
    exam: String,
    level: String,
    year: Number,
    question: String,
    options: [Object],
    topicTags: [String],
    theme: String,
    lang: String,
    answer: String
});
const PYQ = mongoose.models.PYQ || mongoose.model('PYQ', PyqSchema);

async function normalizeText(doc) {
    const prompt = `
You are a data normalization expert for UPSC/Civil Services exam questions.
Your task is to Clean, Format, Split, and Verify the given database record.

**Input Record:**
${JSON.stringify({
        id: doc._id,
        question: doc.question,
        options: doc.options,
        year: doc.year,
        exam: doc.exam
    }, null, 2)}

**Rules:**
1. **Fix Formatting**: Correct typo, spacing, and capitalization. Remove question numbers (e.g. "14.") from the start.
2. **Split Merged Questions**: If the text contains multiple distinct questions (e.g. "1. Q1? 2. Q2?"), split them into separate objects.
3. **Handle MCQ Options**: 
   - If the question contains options (a) ... (b) ... in the text, EXTRACT them into the 'options' array.
   - Remove the options from the 'question' text.
   - Set 'level' to 'Prelims' if options exist.
4. **Mixed Languages**:
   - If the text contains BOTH English and Hindi (or other lang) full translations is same block:
     - Create ONE object for English (lang: 'en').
     - Create SECOND object for Hindi (lang: 'hi').
   - If it's just a few words in brackets (e.g. "Values (Mulya)"), keep it as is in English.
5. **Validation**: Ensure question makes sense. If it's pure garbage, mark action as 'DELETE'.

**Output Format**:
Return a PURE JSON object with a "operations" array.
Each operation must have:
- type: "UPDATE" (for original ID) | "INSERT" (for splits/translations) | "DELETE" (if garbage)
- data: { _id (if UPDATE), question, options, lang, level, exam, year }

Example JSON Output:
{
  "operations": [
    {
      "type": "UPDATE",
      "data": { "_id": "...", "question": "Cleaned text?", "lang": "en", ... }
    },
    {
      "type": "INSERT",
      "data": { "question": "Hindi text?", "lang": "hi", ... }
    }
  ]
}
`;

    const completion = await openai.chat.completions.create({
        messages: [{ role: "system", content: "You are a precise data cleaning assistant." }, { role: "user", content: prompt }],
        model: "gpt-4o",
        response_format: { type: "json_object" }
    });

    return JSON.parse(completion.choices[0].message.content);
}

async function test() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Fetching sample dirty questions...');

        // Find samples:
        // 1. Mixed language potential
        // 2. Options in text potential
        const samples = await PYQ.aggregate([
            {
                $match: {
                    $or: [
                        { question: { $regex: /[अ-ह]/ } }, // Hindi char
                        { question: { $regex: /\(a\)/ } }, // Option pattern
                        { question: { $regex: /1\./ } }   // Number pattern
                    ]
                }
            },
            { $sample: { size: 3 } }
        ]);

        console.log(`Found ${samples.length} samples. Processing...\n`);

        for (const doc of samples) {
            console.log('--- ORIGINAL ---');
            console.log(doc.question.substring(0, 150) + '...');

            const result = await normalizeText(doc);

            console.log('\n--- LLM RESULT ---');
            console.log(JSON.stringify(result, null, 2));
            console.log('\n----------------\n');
        }

    } catch (e) {
        console.error(e);
    } finally {
        mongoose.disconnect();
    }
}

test();
