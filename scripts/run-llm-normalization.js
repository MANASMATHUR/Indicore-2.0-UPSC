/**
 * Full LLM Normalization Batch Script
 * Run: node scripts/run-llm-normalization.js
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
    answer: String,
    _normalized: Boolean // Flag to track progress
});
const PYQ = mongoose.models.PYQ || mongoose.model('PYQ', PyqSchema);

async function normalizeBatch(nodes) {
    if (nodes.length === 0) return [];

    console.log(`Processing batch of ${nodes.length} questions...`);

    const prompt = `
You are a fast data normalization engine for UPSC/Civil Services questions.
Process the following array of records. RETURN A JSON OBJECT with an "operations" array.

**Rules:**
1. **Clean**: Fix formatting, remove question numbers (e.g. "14."), remove LaTeX artifacts.
2. **Split**: If a record contains multiple distinct questions (e.g. "1. ... 2. ..."), split them.
3. **Options**: If text matches "(a) ... (b) ...", extract options and set level='Prelims'. Remove options from question text.
4. **Languages**: If text contains full English AND full Hindi translation, split into two records (lang='en', lang='hi').
5. **Verify**: If question is pure garbage/meaningless, mark for DELETE.

**Input JSON:**
${JSON.stringify(nodes.map(n => ({
        id: n._id,
        question: n.question,
        options: n.options, // Pass existing options if any
        year: n.year
    })), null, 2)}

**Output Schema:**
{
  "operations": [
    {
      "type": "UPDATE" | "INSERT" | "DELETE",
      "data": { "_id": "original_id_only_for_UPDATE", "question", "options": [{"label":"a", "text":"..."}], "lang", "level", "year" }
    }
  ]
}
`;

    try {
        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: "You are a precise bulk data processor. Return ONLY valid JSON." },
                { role: "user", content: prompt }
            ],
            model: "gpt-4o",
            response_format: { type: "json_object" },
            temperature: 0.2
        });

        const content = completion.choices[0].message.content;
        if (!content) return [];
        const result = JSON.parse(content);
        return result.operations || [];
    } catch (e) {
        console.error("Batch processing error:", e.message);
        return [];
    }
}

async function run() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Total count
        const total = await PYQ.countDocuments({ _normalized: { $ne: true } });
        console.log(`Target: ${total} questions to normalize.`);

        // Process in small batches
        const BATCH_SIZE = 10;
        let processed = 0;

        while (true) {
            // Get batch of un-normalized questions
            const batch = await PYQ.find({ _normalized: { $ne: true } }).limit(BATCH_SIZE);

            if (batch.length === 0) {
                console.log('No more questions to process.');
                break;
            }

            // Normalize with LLM
            const operations = await normalizeBatch(batch);

            // Apply operations
            for (const op of operations) {
                try {
                    if (op.type === 'UPDATE' && op.data._id) {
                        await PYQ.updateOne({ _id: op.data._id }, {
                            $set: {
                                question: op.data.question,
                                options: op.data.options || [],
                                lang: op.data.lang || 'en',
                                level: op.data.level || 'Prelims',
                                _normalized: true
                            }
                        });
                    } else if (op.type === 'INSERT') {
                        // Create new document (e.g. split language or question)
                        const newData = { ...op.data };
                        delete newData._id; // Ensure new ID

                        // Default fields if missing
                        if (!newData.year) newData.year = batch[0]?.year || 2023;
                        if (!newData.exam) newData.exam = batch[0]?.exam || 'UPSC';

                        await PYQ.create({
                            ...newData,
                            _normalized: true
                        });
                    } else if (op.type === 'DELETE' && op.data._id) {
                        await PYQ.deleteOne({ _id: op.data._id });
                    }
                } catch (opError) {
                    console.error(`Operation error (${op.type}):`, opError.message);
                }
            }

            // Mark processed originals as normalized (safeguard)
            const batchIds = batch.map(b => b._id);
            await PYQ.updateMany({ _id: { $in: batchIds } }, { $set: { _normalized: true } });

            processed += batch.length;
            console.log(`Progress: ${processed}/${total} (${((processed / total) * 100).toFixed(1)}%)`);
        }

    } catch (e) {
        console.error('Fatal Error:', e);
    } finally {
        await mongoose.disconnect();
        console.log('Done.');
    }
}

run();
