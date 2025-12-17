import mongoose from 'mongoose';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';

const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
} else {
  dotenv.config();
}

import PYQ from '../models/PYQ.js';

// Tag Mappings for Normalization
const TAG_MAP = {
  'Constitution': 'Polity',
  'Polity & Governance': 'Polity',
  'Indian Economy': 'Economics',
  'Geography from 2020 to 2024': 'Geography',
  'history subject and solve them': 'History',
  'history for': 'History',
  'Role of Women in History': 'History',
  'Climate and Geography': 'Geography',
  'Internal Security': 'Security',
  'Science & Tech': 'Science',
  'Environment': 'Environment',
  'Art and Architecture': 'Art & Culture'
};

const PAPER_INFERENCE = {
  'History': 'GS-1',
  'Geography': 'GS-1',
  'Art & Culture': 'GS-1',
  'Society': 'GS-1',
  'Polity': 'GS-2',
  'Governance': 'GS-2',
  'International Relations': 'GS-2',
  'Social Justice': 'GS-2',
  'Economics': 'GS-3',
  'Environment': 'GS-3',
  'Science': 'GS-3',
  'Security': 'GS-3',
  'Disaster Management': 'GS-3',
  'Ethics': 'GS-4',
  'Integrity': 'GS-4',
  'Aptitude': 'GS-4'
};

async function cleanup() {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('✓ Connected');
    }

    console.log('--- specific cleanup: Deleting Empty/Invalid Questions ---');
    const deleteResult = await PYQ.deleteMany({
      exam: 'UPSC',
      $or: [
        { question: '' },
        { question: null },
        { question: { $regex: /^\*\*Answer:\*\*/i } }, // specific garbage
        { $expr: { $lt: [{ $strLenCP: "$question" }, 10] } } // too short
      ]
    });
    console.log(`Deleted ${deleteResult.deletedCount} invalid questions.`);


    console.log('\n--- Normalizing Tags & Inferring Papers ---');
    const cursor = PYQ.find({ exam: 'UPSC' }).cursor();

    let updatedCount = 0;
    let processed = 0;

    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
      processed++;
      let modified = false;

      // 1. Clean Question Text
      if (doc.question && doc.question.includes('<')) {
        const cleanText = doc.question.replace(/<[^>]*>?/gm, '').trim(); // Strip HTML
        if (cleanText !== doc.question) {
          doc.question = cleanText;
          modified = true;
        }
      }

      // 2. Normalize Tags
      if (doc.topicTags && doc.topicTags.length > 0) {
        const newTags = new Set();
        doc.topicTags.forEach(tag => {
          let t = tag.trim();
          // Remove suffix garbage
          t = t.replace(/ subject and solve them$/i, '');
          t = t.replace(/ from \d{4} to \d{4}$/i, '');

          // Map to standard
          if (TAG_MAP[t]) t = TAG_MAP[t];

          if (t.length > 2) newTags.add(t);
        });

        const cleanTags = Array.from(newTags);
        // explicit check for deep equality
        if (JSON.stringify(cleanTags) !== JSON.stringify(doc.topicTags)) {
          doc.topicTags = cleanTags;
          modified = true;
        }
      }

      // 3. Infer Paper if Null
      if (!doc.paper || doc.paper === 'null') {
        if (doc.level === 'Prelims') {
          // Default Prelims to GS Paper 1 for now (unless we detect CSAT tag)
          doc.paper = 'GS Paper 1';
          modified = true;
        } else if (doc.level === 'Mains') {
          // Infer from tags
          let inferred = null;
          for (const tag of doc.topicTags || []) {
            if (PAPER_INFERENCE[tag]) {
              inferred = PAPER_INFERENCE[tag];
              break;
            }
          }
          if (!inferred) {
            // Fallback: check text for keywords
            const qText = doc.question.toLowerCase();
            if (qText.includes('ethics') || qText.includes('integrity')) inferred = 'GS-4';
            else if (qText.includes('economy') || qText.includes('agri')) inferred = 'GS-3';
            else if (qText.includes('constitution') || qText.includes('court')) inferred = 'GS-2';
            else if (qText.includes('freedom') || qText.includes('empire')) inferred = 'GS-1';
          }

          if (inferred) {
            doc.paper = inferred;
            modified = true;
          } else {
            // Last resort default for Mains
            doc.paper = 'GS General';
            modified = true;
          }
        }
      }

      if (modified) {
        // Using updateOne to bypass validation again just in case
        await PYQ.updateOne(
          { _id: doc._id },
          {
            $set: {
              question: doc.question,
              topicTags: doc.topicTags,
              paper: doc.paper
            }
          }
        );
        updatedCount++;
      }

      if (processed % 1000 === 0) process.stdout.write('.');
    }

    console.log(`\nProcessed: ${processed}`);
    console.log(`Updated: ${updatedCount}`);

  } catch (error) {
    console.error(error);
  } finally {
    await mongoose.disconnect();
  }
}

cleanup();
