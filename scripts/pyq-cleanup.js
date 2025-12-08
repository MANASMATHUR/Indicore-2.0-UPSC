import dotenv from 'dotenv';
import mongoose from 'mongoose';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import PYQ from '../models/PYQ.js';

const envPaths = ['.env.local', '.env'];
envPaths.forEach((filename) => {
  const resolved = path.resolve(process.cwd(), filename);
  if (fs.existsSync(resolved)) {
    dotenv.config({ path: resolved, override: true });
  }
});

const {
  MONGODB_URI,
  MONGO_URI,
  MONGODB_URL,
  OPENAI_API_KEY,
  PYQ_BACKUP_COLLECTION = 'pyq_backups'
} = process.env;

const mongoConnectionString =
  MONGODB_URI || MONGO_URI || MONGODB_URL || 'mongodb://localhost:27017/indicore';

if (!OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is required to run the cleanup script.');
  process.exit(1);
}

const args = process.argv.slice(2);
const hasArg = (flag) => args.includes(flag);
const getArgValue = (flag, fallback) => {
  const index = args.indexOf(flag);
  if (index === -1 || typeof args[index + 1] === 'undefined') {
    return fallback;
  }
  return args[index + 1];
};

const BATCH_SIZE = Number(getArgValue('--batch', 25));
const LIMIT = Number(getArgValue('--limit', 0));
const DRY_RUN = hasArg('--dry-run');
const START_AFTER = getArgValue('--startAfter', null);
const MAX_RETRIES = 3;
const SLEEP_MS = Number(getArgValue('--sleep', 1500));
const OPENAI_TIMEOUT_MS = Number(
  getArgValue('--timeoutMs', process.env.OPENAI_TIMEOUT_MS || 60000)
);

const backupSchema = new mongoose.Schema({}, { strict: false });
const PYQBackup =
  mongoose.models.PYQ_BACKUP ||
  mongoose.model('PYQ_BACKUP', backupSchema, PYQ_BACKUP_COLLECTION);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const SYSTEM_PROMPT = `You are an aggressive UPSC PYQ cleanup assistant.

For each question object:
- Reconstruct clean question text.
- Determine if question is PRELIMS (MCQ style requiring options) or MAINS (subjective).
- If PRELIMS, ensure exactly four options (A/B/C/D). Fabricate consistent options if missing.
- If MAINS, ensure the prompt is complete and exam-appropriate.
- Normalize paper names (e.g., "GS-1", "GS Paper 2", "Prelims").
- Normalize topic tags (comma separated, max 3 concise tags).
- Preserve math notation and Indic script where present.
- If question is irreparably messy or duplicates unrelated content, mark delete=true.

Always respond with strict JSON:
[
  {
    "id": "<original _id>",
    "question": "<clean question text>",
    "level": "Prelims" | "Mains",
    "paper": "<paper name>",
    "topicTags": ["tag1","tag2"],
    "options": [
      {"label":"A","text":"..."},
      {"label":"B","text":"..."},
      {"label":"C","text":"..."},
      {"label":"D","text":"..."}
    ],
    "analysis": "<optional analysis>",
    "delete": false,
    "reason": "<optional note why delete>"
  }
]

Rules:
- options array must exist only for Prelims questions. For Mains set options to [].
- Do NOT include explanations or commentary outside JSON.
- Keep question text ≤ 400 words.
- Maintain language (English/Hindi etc.) of original question.
- If question is flagged delete=true, reason must explain why.`;

function buildUserPrompt(batch) {
  const serializedQuestions = batch
    .map(
      (doc, idx) =>
        `#${idx + 1}\nID: ${doc._id}\nExam: ${doc.exam}\nLevel: ${doc.level || 'Unknown'}\nPaper: ${doc.paper || 'Unknown'}\nYear: ${doc.year
        }\nTopicTags: ${(doc.topicTags || []).join(', ') || 'None'}\nQuestion:\n${doc.question}\n`
    )
    .join('\n---\n');

  return `Clean the following UPSC PYQs. For each entry, output a JSON object that matches the schema described. Here are the raw questions:\n\n${serializedQuestions}`;
}

async function callOpenAI(batch) {
  const payload = {
    model: process.env.OPENAI_PYQ_CLEANUP_MODEL || 'gpt-4o',
    temperature: 0.1,
    max_tokens: 3000,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(batch) }
    ]
  };

  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    payload,
    {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: Math.max(OPENAI_TIMEOUT_MS, 60000)
    }
  );

  const content = response.data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI response missing content');
  }

  const plain = content.trim().replace(/```json|```/gi, '').trim();
  const jsonBlockMatch = plain.match(/\[[\s\S]*\]/);
  const rawJson = jsonBlockMatch ? jsonBlockMatch[0] : plain;

  let parsed;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err) {
    const repaired = rawJson
      .replace(/([{,]\s*)([A-Za-z0-9_]+)\s*:/g, (match, prefix, key) => {
        if (/^".*"$/.test(key)) return match;
        return `${prefix}"${key}":`;
      })
      .replace(/,\s*([}\]])/g, '$1');
    parsed = JSON.parse(repaired);
  }

  if (!Array.isArray(parsed)) {
    throw new Error('OpenAI response is not an array');
  }

  return parsed;
}

function validateLLMEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    throw new Error('Invalid entry format');
  }
  if (!entry.id) {
    throw new Error('Entry missing id');
  }
  if (entry.delete) {
    return entry;
  }

  if (!entry.question || entry.question.length < 10) {
    throw new Error('Question text too short');
  }

  if (!['Prelims', 'Mains'].includes(entry.level)) {
    throw new Error('Level must be Prelims or Mains');
  }

  if (!entry.paper || entry.paper.length < 2) {
    throw new Error('Paper name missing');
  }

  if (!Array.isArray(entry.topicTags)) {
    entry.topicTags = [];
  }

  if (entry.level === 'Prelims') {
    if (!Array.isArray(entry.options) || entry.options.length !== 4) {
      throw new Error('Prelims question must have exactly 4 options');
    }
    entry.options.forEach((opt) => {
      if (!opt.label || !opt.text) {
        throw new Error('Each option must include label and text');
      }
    });
  } else {
    entry.options = [];
  }

  return entry;
}

async function processBatch(batch) {
  let attempts = 0;
  let parsed;

  while (attempts < MAX_RETRIES) {
    try {
      parsed = await callOpenAI(batch);
      break;
    } catch (error) {
      attempts += 1;
      console.warn(`OpenAI call failed (attempt ${attempts}/${MAX_RETRIES})`, error.message);
      if (attempts >= MAX_RETRIES) {
        throw error;
      }
      await sleep(2000 * attempts);
    }
  }

  const updates = [];
  const deletions = [];

  const parsedById = new Map();
  for (const entry of parsed) {
    parsedById.set(entry.id, entry);
  }

  for (const doc of batch) {
    if (!parsedById.has(String(doc._id))) {
      console.warn(`No LLM response for _id=${doc._id}, skipping`);
      continue;
    }
    try {
      const cleaned = validateLLMEntry(parsedById.get(String(doc._id)));
      if (cleaned.delete) {
        deletions.push({ original: doc, reason: cleaned.reason || 'Marked for deletion' });
      } else {
        updates.push({ original: doc, cleaned });
      }
    } catch (err) {
      console.warn(`Validation failed for _id=${doc._id}: ${err.message}`);
      deletions.push({ original: doc, reason: `Validation failed: ${err.message}` });
    }
  }

  if (DRY_RUN) {
    console.log(`[DRY-RUN] Would update ${updates.length} docs and delete ${deletions.length}`);
    return { updated: updates.length, deleted: deletions.length };
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    for (const { original, cleaned } of updates) {
      await PYQ.updateOne(
        { _id: original._id },
        {
          $set: {
            question: cleaned.question,
            level: cleaned.level,
            paper: cleaned.paper,
            topicTags: cleaned.topicTags,
            options: cleaned.options,
            analysis: cleaned.analysis || original.analysis || '',
            cleanedAt: new Date()
          }
        },
        { session }
      );
    }

    for (const { original, reason } of deletions) {
      await PYQBackup.create(
        [
          {
            ...original.toObject(),
            backupAt: new Date(),
            backupReason: reason
          }
        ],
        { session }
      );
      await PYQ.deleteOne({ _id: original._id }, { session });
    }

    await session.commitTransaction();
    session.endSession();

    return { updated: updates.length, deleted: deletions.length };
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

async function main() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoConnectionString, {
    maxPoolSize: 5
  });
  console.log('Connected.');

  const summary = {
    processed: 0,
    updated: 0,
    deleted: 0,
    skipped: 0
  };

  let lastId = START_AFTER ? new mongoose.Types.ObjectId(START_AFTER) : null;
  let shouldContinue = true;

  while (shouldContinue) {
    const query = lastId ? { _id: { $gt: lastId } } : {};
    query.cleanedAt = { $exists: false };

    const batch = await PYQ.find(query).sort({ _id: 1 }).limit(BATCH_SIZE).exec();

    if (!batch.length) {
      break;
    }

    const stats = await processBatch(batch);
    summary.processed += batch.length;
    summary.updated += stats.updated;
    summary.deleted += stats.deleted;

    lastId = batch[batch.length - 1]._id;

    if (LIMIT && summary.processed >= LIMIT) {
      shouldContinue = false;
    }

    await sleep(SLEEP_MS);
    console.log(
      `Processed ${summary.processed} (updated ${summary.updated}, deleted ${summary.deleted})`
    );
  }

  console.log('Cleanup complete:', summary);
  await mongoose.disconnect();
}

main()
  .catch(async (error) => {
    console.error('Cleanup script failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  })
  .then(() => process.exit(0));

