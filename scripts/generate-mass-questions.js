import mongoose from 'mongoose';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';
import axios from 'axios';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath });
} else {
    dotenv.config();
}

import PYQ from '../models/PYQ.js';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPEN_AI_KEY;
const TARGET_TOTAL_PER_EXAM = 3000;
const BATCH_SIZE = 10; // Questions per API call
const CONCURRENCY = 15; // Parallel API calls

// Load Configs
const configPath = path.join(__dirname, '../config/exam-patterns.json');
const EXAM_CONFIGS = JSON.parse(fs.readFileSync(configPath, 'utf8'));

async function generateMassQuestions() {
    const args = process.argv.slice(2);
    const targetExams = args.length > 0 ? args : Object.keys(EXAM_CONFIGS);

    if (!OPENAI_API_KEY) {
        console.error('❌ Missing OPENAI_API_KEY');
        process.exit(1);
    }

    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✓ Connected to MongoDB');
    }

    console.log(`🚀 Starting Mass Generation for: ${targetExams.join(', ')}`);
    console.log(`🎯 Target: ~${TARGET_TOTAL_PER_EXAM} questions per exam`);

    for (const examCode of targetExams) {
        const config = EXAM_CONFIGS[examCode];
        if (!config) {
            console.warn(`⚠️ Config not found for ${examCode}, skipping.`);
            continue;
        }

        console.log(`\n${'='.repeat(50)}`);
        console.log(`Processing ${config.name || config.code} (${config.language})`);
        console.log(`${'='.repeat(50)}`);

        // Calculate goals per subject
        const subjectGoals = {};
        for (const [subject, weight] of Object.entries(config.subjects)) {
            subjectGoals[subject] = Math.ceil(TARGET_TOTAL_PER_EXAM * (weight / 100));
        }

        // Process each subject
        for (const [subject, goal] of Object.entries(subjectGoals)) {
            // Check existing count (optional optimization)
            // const existing = await PYQ.countDocuments({ exam: examCode, topicTags: subject });
            // if (existing >= goal) continue;

            console.log(`\n📚 Subject: ${subject} | Goal: ${goal} questions`);

            const batchesNeeded = Math.ceil(goal / BATCH_SIZE);
            const activePromises = new Set();
            let completedBatches = 0;

            for (let i = 0; i < batchesNeeded; i++) {
                // Select a random sub-topic from syllabus to ensure diversity
                const topics = config.syllabus[subject] || [];
                const subTopic = topics.length > 0 ? topics[i % topics.length] : subject;

                // Create the promise
                const p = generateBatch(config, subject, subTopic).then(res => {
                    completedBatches++;
                    process.stdout.write(`\r   ⚡ Progress: ${completedBatches}/${batchesNeeded} batches (${completedBatches * BATCH_SIZE} Qs)`);
                });

                // Wrap it to remove itself from the Set when done
                const promiseWithCleanup = p.then(() => activePromises.delete(promiseWithCleanup));

                activePromises.add(promiseWithCleanup);

                // If we hit concurrency limit, wait for at least one to finish
                if (activePromises.size >= CONCURRENCY) {
                    await Promise.race(activePromises);
                }
            }

            // Wait for remaining
            await Promise.all(activePromises);
            console.log(`\n   ✅ ${subject} Complete.`);
        }
    }

    console.log('\n🎉 All Exams Processed.');
    await mongoose.disconnect();
}

async function generateBatch(config, subject, subTopic) {
    const examName = config.name || config.code;
    const prompt = `
        Generate ${BATCH_SIZE} high-quality ${config.stages[0]} (MCQ) questions for the **${examName}** exam.
        **Language**: ${config.language} (The text MUST be in ${config.language} script).
        **Subject**: ${subject}
        **Topic**: ${subTopic}
        
        The questions must be authentic to the exam pattern (${config.code}).
        Include 4 options and the correct answer.
        
        Output valid JSON array:
        [
            {
                "question": "Question text in ${config.language}",
                "options": [
                    { "label": "A", "text": "Option A in ${config.language}" },
                    { "label": "B", "text": "Option B in ${config.language}" },
                    { "label": "C", "text": "Option C in ${config.language}" },
                    { "label": "D", "text": "Option D in ${config.language}" }
                ],
                "answer": "Option A text",
                "topicTags": ["${subject}", "${subTopic}"],
                "year": 2024,
                "paper": "General Studies",
                "level": "Prelims"
            }
        ]
    `;

    try {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-4o', // Faster & cheaper for bulk, good enough for factual Qs
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                response_format: { type: "json_object" }
            },
            {
                headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
                timeout: 60000
            }
        );

        const content = response.data.choices[0].message.content;
        const data = JSON.parse(content);
        let items = data.questions || data.items || data;

        if (!Array.isArray(items)) {
            items = []; // Fail silently or retry logic could go here
        }

        // Add metadata
        const docs = items.map(item => ({
            ...item,
            exam: config.code,
            verified: true,
            createdAt: new Date()
        }));

        if (docs.length > 0) {
            await PYQ.insertMany(docs);
        }
        return true;

    } catch (err) {
        // console.error(`Batch failed: ${err.message}`);
        return false;
    }
}

generateMassQuestions();
