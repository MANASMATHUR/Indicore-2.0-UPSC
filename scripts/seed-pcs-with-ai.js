import mongoose from 'mongoose';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';
import axios from 'axios';

const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath });
} else {
    dotenv.config();
}

import PYQ from '../models/PYQ.js';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPEN_AI_KEY;
const TARGET_EXAMS = ['TNPSC', 'RPSC', 'MPSC', 'BPSC']; // RPSC = RAS

async function seedPCS() {
    try {
        if (!OPENAI_API_KEY) {
            console.error('❌ Error: OPENAI_API_KEY is missing.');
            return;
        }

        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI);
            console.log('✓ Connected to MongoDB');
        }

        for (const exam of TARGET_EXAMS) {
            console.log(`\n🤖 Generating questions for ${exam}...`);

            // Check if data already exists
            const count = await PYQ.countDocuments({ exam: exam });
            if (count > 10) {
                console.log(`   ⚠️  ${exam} already has ${count} questions. Skipping.`);
                continue;
            }

            const prompt = `
            Generate 10 authentic diverse Previous Year Questions (PYQs) for the ${exam} (State Civil Services) exam.
            5 should be Prelims (MCQs with options) and 5 should be Mains (Subjective).
            
            Return a JSON array of objects with this structure:
            {
               "year": 2023,
               "level": "Prelims" or "Mains",
               "question": "Question text...",
               "options": [{"label": "A", "text": "..."}, ...] (only for Prelims),
               "answer": "Correct Answer or Model Answer info",
               "topicTags": ["Tag1", "Tag2"],
               "paper": "General Studies"
            }
        `;

            try {
                const response = await axios.post(
                    'https://api.openai.com/v1/chat/completions',
                    {
                        model: 'gpt-4o',
                        messages: [{ role: 'user', content: prompt }],
                        temperature: 0.7,
                        response_format: { type: "json_object" }
                    },
                    {
                        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` }
                    }
                );

                const content = response.data.choices[0].message.content;
                const data = JSON.parse(content);
                const questions = data.questions || data.items || data; // Handle likely wrapper keys

                if (Array.isArray(questions)) {
                    const docs = questions.map(q => ({
                        ...q,
                        exam: exam, // Force standard exam code
                        verified: true,
                        createdAt: new Date()
                    }));

                    await PYQ.insertMany(docs);
                    console.log(`   ✅ Inserted ${docs.length} questions for ${exam}`);
                } else {
                    console.error('   ❌ Failed to parse array from AI response');
                }

            } catch (err) {
                console.error(`   ❌ Failed: ${err.message}`);
            }
        }

        console.log('\n--- Seeding Complete ---');

    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.disconnect();
    }
}

seedPCS();
