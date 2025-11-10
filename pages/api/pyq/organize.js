import connectToDatabase from '@/lib/mongodb';
import PYQ from '@/models/PYQ';
import { detectLanguages, separateLanguages, getPrimaryLanguage, isMultiLanguage } from '@/lib/languageDetector';

function normalizeExam(exam) {
  if (!exam) return 'UPSC';
  const examUpper = String(exam).toUpperCase().trim();
  const validExams = ['UPSC', 'PCS', 'SSC', 'TNPSC', 'MPSC', 'BPSC', 'UPPSC', 'MPPSC', 'RAS', 'RPSC', 'GPSC', 'KPSC', 'WBPSC', 'PPSC', 'OPSC', 'APSC', 'APPSC', 'TSPSC', 'HPSC', 'JKPSC', 'KERALA PSC', 'GOA PSC'];
  
  // Try to match common variations
  if (examUpper.includes('TAMIL') || examUpper.includes('TN')) return 'TNPSC';
  if (examUpper.includes('MAHARASHTRA') || examUpper.includes('MAH')) return 'MPSC';
  if (examUpper.includes('BIHAR') || examUpper.includes('BP')) return 'BPSC';
  if (examUpper.includes('UTTAR PRADESH') || examUpper.includes('UP PSC')) return 'UPPSC';
  if (examUpper.includes('MADHYA PRADESH') || examUpper.includes('MP PSC')) return 'MPPSC';
  if (examUpper.includes('RAJASTHAN') && examUpper.includes('RAS')) return 'RAS';
  if (examUpper.includes('RAJASTHAN') && examUpper.includes('RPSC')) return 'RPSC';
  if (examUpper.includes('GUJARAT') || examUpper.includes('GP')) return 'GPSC';
  if (examUpper.includes('KARNATAKA') || examUpper.includes('KP')) return 'KPSC';
  if (examUpper.includes('WEST BENGAL') || examUpper.includes('WB')) return 'WBPSC';
  if (examUpper.includes('PUNJAB') || examUpper.includes('PP')) return 'PPSC';
  if (examUpper.includes('ODISHA') || examUpper.includes('OP')) return 'OPSC';
  if (examUpper.includes('ASSAM') || examUpper.includes('AP')) return 'APSC';
  if (examUpper.includes('ANDHRA') || examUpper.includes('APP')) return 'APPSC';
  if (examUpper.includes('TELANGANA') || examUpper.includes('TS')) return 'TSPSC';
  if (examUpper.includes('KERALA')) return 'KERALA PSC';
  if (examUpper.includes('HARYANA') || examUpper.includes('HP')) return 'HPSC';
  if (examUpper.includes('JAMMU') || examUpper.includes('J&K') || examUpper.includes('JK')) return 'JKPSC';
  if (examUpper.includes('GOA')) return 'GOA PSC';
  
  return validExams.includes(examUpper) ? examUpper : 'UPSC';
}

function normalizeLevel(level) {
  if (!level) return '';
  const levelLower = String(level).toLowerCase().trim();
  if (levelLower.includes('prelim')) return 'Prelims';
  if (levelLower.includes('main')) return 'Mains';
  if (levelLower.includes('interview')) return 'Interview';
  return '';
}

function normalizeQuestion(question) {
  if (!question) return '';
  return String(question)
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, ' ')
    .substring(0, 2000);
}

function normalizeAnswer(answer) {
  if (!answer) return '';
  return String(answer)
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, ' ')
    .substring(0, 10000);
}

function normalizeTopicTags(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) {
    return tags.map(tag => String(tag).trim()).filter(tag => tag.length > 0);
  }
  if (typeof tags === 'string') {
    return tags.split(',').map(s => s.trim()).filter(s => s.length > 0);
  }
  return [];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await connectToDatabase();

    const total = await PYQ.countDocuments();
    if (total === 0) {
      return res.status(200).json({ 
        ok: true, 
        message: 'No PYQs found',
        processed: 0,
        updated: 0,
        deleted: 0
      });
    }

    let updated = 0;
    let deleted = 0;
    let processed = 0;

    // Process in batches
    const batchSize = 500;
    const totalBatches = Math.ceil(total / batchSize);

    for (let batch = 0; batch < totalBatches; batch++) {
      const skip = batch * batchSize;
      const pyqs = await PYQ.find({}).skip(skip).limit(batchSize).lean();

      for (const pyq of pyqs) {
        processed++;
        const updates = {};
        let needsUpdate = false;

        // Normalize exam
        const normalizedExam = normalizeExam(pyq.exam);
        if (normalizedExam !== pyq.exam) {
          updates.exam = normalizedExam;
          needsUpdate = true;
        }

        // Normalize level
        const normalizedLevel = normalizeLevel(pyq.level);
        if (normalizedLevel !== (pyq.level || '')) {
          updates.level = normalizedLevel;
          needsUpdate = true;
        }

        // Normalize question
        const normalizedQuestion = normalizeQuestion(pyq.question);
        if (normalizedQuestion !== pyq.question) {
          updates.question = normalizedQuestion;
          needsUpdate = true;
        }

        // Normalize answer
        const normalizedAnswer = normalizeAnswer(pyq.answer || '');
        if (normalizedAnswer !== (pyq.answer || '')) {
          updates.answer = normalizedAnswer;
          needsUpdate = true;
        }

        // Detect and set language (use 'lang' to avoid MongoDB text index conflict)
        const language = getPrimaryLanguage(pyq.question || '');
        if (language !== (pyq.lang || 'en')) {
          updates.lang = language;
          needsUpdate = true;
        }

        // Normalize topicTags
        const normalizedTags = normalizeTopicTags(pyq.topicTags);
        const currentTags = Array.isArray(pyq.topicTags) ? pyq.topicTags : [];
        if (JSON.stringify(normalizedTags.sort()) !== JSON.stringify(currentTags.sort())) {
          updates.topicTags = normalizedTags;
          needsUpdate = true;
        }

        // Normalize paper and theme
        if (pyq.paper) {
          const normalizedPaper = String(pyq.paper).trim();
          if (normalizedPaper !== pyq.paper) {
            updates.paper = normalizedPaper;
            needsUpdate = true;
          }
        }

        if (pyq.theme) {
          const normalizedTheme = String(pyq.theme).trim();
          if (normalizedTheme !== pyq.theme) {
            updates.theme = normalizedTheme;
            needsUpdate = true;
          }
        }

        // Validate year
        if (!pyq.year || pyq.year < 1990 || pyq.year > new Date().getFullYear() + 1) {
          await PYQ.deleteOne({ _id: pyq._id });
          deleted++;
          continue;
        }

        // Validate question length
        if (!normalizedQuestion || normalizedQuestion.length < 10) {
          await PYQ.deleteOne({ _id: pyq._id });
          deleted++;
          continue;
        }

        // Update if needed
        if (needsUpdate) {
          await PYQ.updateOne({ _id: pyq._id }, { $set: updates });
          updated++;
        }
      }
    }

    // Separate multi-language questions
    let multiLangSeparated = 0;
    let multiLangCreated = 0;
    
    const multiLangPYQs = await PYQ.find({}).lean();
    for (const pyq of multiLangPYQs) {
      const question = pyq.question || '';
      if (isMultiLanguage(question)) {
        const questionSegments = separateLanguages(question);
        if (questionSegments.length > 1) {
          multiLangSeparated++;
          // Delete original using collection.deleteOne directly
          await PYQ.collection.deleteOne({ _id: pyq._id });
          // Create separate entries using collection.insertOne directly
          for (const qSegment of questionSegments) {
            try {
              await PYQ.collection.insertOne({
                exam: pyq.exam,
                level: pyq.level || '',
                paper: pyq.paper || '',
                year: pyq.year,
                question: qSegment.text,
                answer: pyq.answer || '',
                lang: qSegment.language,
                topicTags: Array.isArray(pyq.topicTags) ? pyq.topicTags : [],
                theme: pyq.theme || '',
                sourceLink: pyq.sourceLink || '',
                verified: Boolean(pyq.verified),
                createdAt: new Date(),
                updatedAt: new Date()
              });
              multiLangCreated++;
            } catch (e) {
              // Ignore duplicates
              if (e.code !== 11000) {
                console.warn(`Could not create PYQ: ${e.message}`);
              }
            }
          }
        }
      }
    }

    // Remove duplicates (keep the oldest one, considering language)
    const duplicates = await PYQ.aggregate([
      {
        $group: {
          _id: {
            exam: '$exam',
            year: '$year',
            question: '$question',
            lang: '$lang'
          },
          ids: { $push: '$_id' },
          count: { $sum: 1 }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]);

    let duplicatesRemoved = 0;
    for (const dup of duplicates) {
      const idsToDelete = dup.ids.slice(1);
      await PYQ.deleteMany({ _id: { $in: idsToDelete } });
      duplicatesRemoved += idsToDelete.length;
    }

    // Get final statistics
    const finalCount = await PYQ.countDocuments();
    const byExam = await PYQ.aggregate([
      { $group: { _id: '$exam', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    return res.status(200).json({
      ok: true,
      processed,
      updated,
      deleted: deleted + duplicatesRemoved,
      duplicatesRemoved,
      multiLangSeparated,
      multiLangCreated,
      finalCount,
      byExam: byExam.map(({ _id, count }) => ({ exam: _id, count }))
    });
  } catch (error) {
    console.error('PYQ organize error:', error);
    return res.status(500).json({ 
      ok: false, 
      error: error.message || 'Failed to organize PYQ data' 
    });
  }
}

