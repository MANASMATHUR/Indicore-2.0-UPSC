import connectToDatabase from '@/lib/mongodb';
import PYQ from '@/models/PYQ';
import { detectLanguages, separateLanguages, getPrimaryLanguage } from '@/lib/languageDetector';

// Normalize exam name
function normalizeExam(exam) {
  if (!exam) return 'UPSC';
  const examUpper = exam.toUpperCase().trim();
  const validExams = ['UPSC', 'PCS', 'SSC', 'TNPSC', 'MPSC', 'BPSC', 'UPPSC', 'MPPSC', 'RAS', 'RPSC', 'GPSC', 'KPSC', 'WBPSC', 'PPSC', 'OPSC', 'APSC', 'APPSC', 'TSPSC', 'HPSC', 'JKPSC', 'KERALA PSC', 'GOA PSC'];
  return validExams.includes(examUpper) ? examUpper : 'UPSC';
}

// Normalize level
function normalizeLevel(level) {
  if (!level) return '';
  const levelLower = level.toLowerCase().trim();
  if (levelLower.includes('prelim')) return 'Prelims';
  if (levelLower.includes('main')) return 'Mains';
  if (levelLower.includes('interview')) return 'Interview';
  return '';
}

// Normalize question text
function normalizeQuestion(question) {
  if (!question) return '';
  return question
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, ' ')
    .substring(0, 2000); // Limit length
}

// Normalize answer text
function normalizeAnswer(answer) {
  if (!answer) return '';
  return answer
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, ' ')
    .substring(0, 10000); // Limit length (answers can be longer)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await connectToDatabase();
    const body = req.body;
    if (!Array.isArray(body) || body.length === 0) {
      return res.status(400).json({ ok: false, error: 'Provide an array of PYQ items' });
    }

    // Normalize and validate data, separate multi-language questions
    const normalized = [];
    
    for (const it of body) {
      const year = typeof it.year === 'string' ? parseInt(it.year, 10) : (it.year || null);
      const question = normalizeQuestion(it.question || '');
      const answer = normalizeAnswer(it.answer || '');
      
      // Skip invalid entries
      if (!question || question.length < 10 || !year || year < 1990 || year > new Date().getFullYear() + 1) {
        continue;
      }

      // Normalize topicTags
      let topicTags = [];
      if (Array.isArray(it.topicTags)) {
        topicTags = it.topicTags.map(tag => String(tag).trim()).filter(tag => tag.length > 0);
      } else if (it.topicTags) {
        topicTags = String(it.topicTags).split(',').map(s => s.trim()).filter(s => s.length > 0);
      }

      // Check if question contains multiple languages
      const questionSegments = separateLanguages(question);
      const answerSegments = answer ? separateLanguages(answer) : [{ language: 'en', text: '' }];

      // Create separate entries for each language
      if (questionSegments.length > 1) {
        for (const qSegment of questionSegments) {
          // Try to match answer segment with same language
          const matchingAnswer = answerSegments.find(
            a => a.language === qSegment.language || 
            (qSegment.language === 'multi' && a.language !== 'multi')
          ) || answerSegments[0];

          normalized.push({
            exam: normalizeExam(it.exam),
            level: normalizeLevel(it.level),
            paper: (it.paper || '').trim(),
            year: year,
            question: qSegment.text,
            answer: matchingAnswer.text,
            lang: qSegment.language,
            topicTags: topicTags,
            theme: (it.theme || '').trim(),
            sourceLink: (it.sourceLink || '').trim(),
            verified: Boolean(it.verified)
          });
        }
      } else {
        // Single language question
        const language = getPrimaryLanguage(question);
        normalized.push({
          exam: normalizeExam(it.exam),
          level: normalizeLevel(it.level),
          paper: (it.paper || '').trim(),
          year: year,
          question: question,
          answer: answer,
          lang: language,
          topicTags: topicTags,
          theme: (it.theme || '').trim(),
          sourceLink: (it.sourceLink || '').trim(),
          verified: Boolean(it.verified)
        });
      }
    }

    if (normalized.length === 0) {
      return res.status(400).json({ ok: false, error: 'No valid items to insert' });
    }

    // Use bulkWrite with upsert to handle duplicates
    // Use collection.bulkWrite directly to avoid MongoDB text index language override issue
    // Include lang in filter to properly handle multi-language questions
    const operations = normalized.map(item => ({
      updateOne: {
        filter: {
          exam: item.exam,
          year: item.year,
          question: item.question,
          lang: item.lang || 'en'
        },
        update: {
          $set: {
            ...item,
            updatedAt: new Date()
          },
          $setOnInsert: {
            createdAt: new Date()
          }
        },
        upsert: true
      }
    }));

    const result = await PYQ.collection.bulkWrite(operations, { ordered: false });
    
    return res.status(200).json({ 
      ok: true, 
      inserted: result.upsertedCount,
      updated: result.modifiedCount,
      matched: result.matchedCount,
      total: normalized.length
    });
  } catch (err) {
    console.error('PYQ seed error', err);
    
    // Handle duplicate key errors gracefully
    if (err.code === 11000) {
      return res.status(200).json({ 
        ok: true, 
        inserted: 0,
        updated: 0,
        matched: 0,
        total: 0,
        message: 'Some duplicates were skipped'
      });
    }
    
    return res.status(500).json({ 
      ok: false, 
      error: err.message || 'PYQ seeding failed' 
    });
  }
}



