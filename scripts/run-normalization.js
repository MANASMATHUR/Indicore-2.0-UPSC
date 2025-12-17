import mongoose from 'mongoose';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';
import axios from 'axios';

// Load environment variables
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath });
} else {
    dotenv.config();
}

import PYQ from '../models/PYQ.js';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPEN_AI_KEY;
// Concurrency Limit
const CONCURRENCY = 10;

async function normalizeWithLLM() {
    try {
        if (!OPENAI_API_KEY) {
            console.error('❌ Error: OPENAI_API_KEY is missing.');
            return;
        }

        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI);
            console.log('✓ Connected to MongoDB');
        }

        const query = {
            exam: 'UPSC',
            $or: [
                { paper: 'Unknown Paper' },
                { paper: 'GS General' },
                { paper: null },
                { topicTags: { $size: 0 } }
            ]
        };

        const totalDocs = await PYQ.countDocuments(query);
        console.log(`Found ${totalDocs} candidates for normalization. Starting processing with concurrency ${CONCURRENCY}...`);

        let processed = 0;
        let updated = 0;
        let activePromises = [];

        const cursor = PYQ.find(query).cursor();

        for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
            const p = processDoc(doc).then(wasUpdated => {
                processed++;
                if (wasUpdated) updated++;
                if (processed % 10 === 0) process.stdout.write(`\rProgress: ${processed}/${totalDocs} (Updated: ${updated})`);
            });

            activePromises.push(p);

            if (activePromises.length >= CONCURRENCY) {
                await Promise.race(activePromises);
                // Cleanup finished promises
                // Since we can't easily remove completed from a race validation without a wrapper, 
                // valid strategy in simple scripts: Promise.all if batching, or just wait for one.
                // Better: just use a library like p-limit, but since I can't add deps easily:
                // Simple batch check:
                activePromises = activePromises.filter(p => {
                    const state = process.binding('util').getPromiseDetails(p)[0];
                    return state === 0; // 0 = pending
                });
                // Fallback if inspection fails or is node-version specific (risky):
                // Safest: Just wait for all if hitting limit (simpler batching)
                if (activePromises.length >= CONCURRENCY) {
                    await Promise.all(activePromises);
                    activePromises = [];
                }
            }
        }

        await Promise.all(activePromises);

        console.log(`\n\n--- Complete ---`);
        console.log(`Updated: ${updated}`);

    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.disconnect();
    }
}

async function processDoc(doc) {
    const prompt = `
        You are an expert at classifying UPSC Civil Services Exam questions.
        Analyze this question and return a valid JSON object with:
        1. "paper": one of ["GS Paper 1", "GS Paper 2", "GS Paper 3", "GS Paper 4", "Essay", "Optional"]
        2. "subject": specific subject (e.g. "Polity", "History", "Economics", "Ethics")
        3. "tags": array of 3-5 specific topic tags.
        
        Question: "${doc.question}"
        Current Level: ${doc.level || 'Unknown'}
        
        Return ONLY valid JSON.
      `;

    try {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-4o',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3,
                response_format: { type: "json_object" }
            },
            {
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const content = response.data.choices[0].message.content;
        const result = JSON.parse(content);

        const updates = {};
        if (result.paper) updates.paper = result.paper;
        if (result.tags && Array.isArray(result.tags)) updates.topicTags = result.tags;

        // Also map 'subject' to topicTags if helpful
        if (result.subject && updates.topicTags && !updates.topicTags.includes(result.subject)) {
            updates.topicTags.unshift(result.subject);
        }

        await PYQ.updateOne({ _id: doc._id }, { $set: updates });
        return true;

    } catch (err) {
        // console.error(` -> Failed: ${err.message}`);
        return false;
    }
}

normalizeWithLLM();
