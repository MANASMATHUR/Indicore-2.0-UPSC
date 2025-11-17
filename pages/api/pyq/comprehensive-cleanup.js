import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import connectToDatabase from '@/lib/mongodb';
import PYQ from '@/models/PYQ';

/**
 * Comprehensive PYQ Database Cleanup
 * This script performs extensive cleanup and normalization:
 * - Removes duplicates (intelligent matching)
 * - Normalizes all fields
 * - Validates data integrity
 * - Removes invalid/empty entries
 * - Fixes common data issues
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await connectToDatabase();

    // SAFETY: Default to dryRun=true
    const { dryRun = true, batchSize = 100, aggressive = false } = req.body;

    const stats = {
      total: 0,
      processed: 0,
      updated: 0,
      deleted: 0,
      duplicates: 0,
      invalid: 0,
      errors: 0,
      fixed: {
        exam: 0,
        level: 0,
        paper: 0,
        year: 0,
        question: 0,
        topicTags: 0,
        keywords: 0,
        analysis: 0,
        lang: 0
      }
    };

    stats.total = await PYQ.countDocuments();

    // Normalization maps
    const examNormalization = {
      'upsc': 'UPSC', 'pcs': 'PCS', 'ssc': 'SSC', 'tnpsc': 'TNPSC',
      'mpsc': 'MPSC', 'bpsc': 'BPSC', 'uppsc': 'UPPSC', 'mppsc': 'MPPSC',
      'ras': 'RAS', 'rpsc': 'RPSC', 'gpsc': 'GPSC', 'kpsc': 'KPSC',
      'wbpsc': 'WBPSC', 'ppsc': 'PPSC', 'opsc': 'OPSC', 'apsc': 'APSC',
      'appsc': 'APPSC', 'tspsc': 'TSPSC', 'hpsc': 'HPSC', 'jkpsc': 'JKPSC',
      'kerala psc': 'KERALA PSC', 'goa psc': 'GOA PSC'
    };

    const levelNormalization = {
      'prelims': 'Prelims', 'prelim': 'Prelims', 'preliminary': 'Prelims',
      'mains': 'Mains', 'main': 'Mains',
      'interview': 'Interview', '': ''
    };

    const validLangs = ['en', 'hi', 'ta', 'te', 'kn', 'ml', 'mr', 'gu', 'pa', 'bn', 'or', 'as', 'ur', 'ne', 'si', 'multi'];

    // Process in batches
    const totalBatches = Math.ceil(stats.total / batchSize);
    
    for (let batch = 0; batch < totalBatches; batch++) {
      const skip = batch * batchSize;
      const pyqs = await PYQ.find({})
        .skip(skip)
        .limit(batchSize)
        .lean();

      for (const pyq of pyqs) {
        try {
          stats.processed++;
          const updates = {};
          let needsUpdate = false;
          let shouldDelete = false;

          // 1. Validate and normalize exam
          if (!pyq.exam || typeof pyq.exam !== 'string') {
            if (aggressive) {
              shouldDelete = true;
              stats.invalid++;
              continue;
            }
          } else {
            const normalizedExam = examNormalization[pyq.exam.toLowerCase().trim()] || pyq.exam.toUpperCase().trim();
            if (normalizedExam !== pyq.exam) {
              updates.exam = normalizedExam;
              needsUpdate = true;
              stats.fixed.exam++;
            }
          }

          // 2. Normalize level
          if (pyq.level !== undefined && pyq.level !== null) {
            const levelStr = String(pyq.level).trim();
            const normalizedLevel = levelNormalization[levelStr.toLowerCase()] || levelStr;
            if (normalizedLevel !== pyq.level) {
              updates.level = normalizedLevel;
              needsUpdate = true;
              stats.fixed.level++;
            }
          }

          // 3. Normalize paper (clean common variations)
          if (pyq.paper) {
            let normalizedPaper = String(pyq.paper).trim();
            // Fix common GS paper formats
            normalizedPaper = normalizedPaper.replace(/^GS[\s\-_]?([1234])$/i, 'GS-$1');
            normalizedPaper = normalizedPaper.replace(/^GS[\s\-_]?([1234])[\s\-_]?PAPER$/i, 'GS-$1');
            if (normalizedPaper !== pyq.paper) {
              updates.paper = normalizedPaper;
              needsUpdate = true;
              stats.fixed.paper++;
            }
          }

          // 4. Validate and fix year
          if (!pyq.year || pyq.year < 1990 || pyq.year > new Date().getFullYear() + 1) {
            if (aggressive && (!pyq.year || pyq.year < 1900 || pyq.year > 2100)) {
              shouldDelete = true;
              stats.invalid++;
              continue;
            } else if (pyq.year && pyq.year > 1900 && pyq.year < 2100) {
              updates.year = Math.max(1990, Math.min(pyq.year, new Date().getFullYear()));
              needsUpdate = true;
              stats.fixed.year++;
            }
          }

          // 5. Validate and normalize question
          if (!pyq.question || typeof pyq.question !== 'string' || pyq.question.trim().length < 10) {
            // Try to extract from answer or other fields
            const potentialQuestion = (pyq.answer || pyq.theme || '').trim();
            if (potentialQuestion && potentialQuestion.length >= 10) {
              updates.question = potentialQuestion;
              needsUpdate = true;
              stats.fixed.question++;
            } else if (aggressive) {
              shouldDelete = true;
              stats.invalid++;
              continue;
            }
          } else {
            const normalizedQuestion = pyq.question.trim().replace(/\s+/g, ' ');
            if (normalizedQuestion !== pyq.question) {
              updates.question = normalizedQuestion;
              needsUpdate = true;
              stats.fixed.question++;
            }
          }

          // 6. Normalize answer
          if (pyq.answer && typeof pyq.answer === 'string') {
            const normalizedAnswer = pyq.answer.trim().replace(/\s+/g, ' ');
            if (normalizedAnswer !== pyq.answer) {
              updates.answer = normalizedAnswer;
              needsUpdate = true;
            }
          }

          // 7. Normalize lang
          if (!pyq.lang || !validLangs.includes(pyq.lang)) {
            updates.lang = 'en';
            needsUpdate = true;
            stats.fixed.lang++;
          }

          // 8. Normalize topicTags
          if (pyq.topicTags) {
            const normalizedTags = Array.isArray(pyq.topicTags)
              ? pyq.topicTags
                  .map(tag => String(tag).trim())
                  .filter(tag => tag.length > 0 && tag.length < 100) // Remove empty and too long tags
                  .slice(0, 10) // Limit to 10 tags
                  .map(tag => tag.charAt(0).toUpperCase() + tag.slice(1).toLowerCase()) // Capitalize first letter
              : [];
            
            const currentTags = Array.isArray(pyq.topicTags) ? pyq.topicTags : [];
            if (JSON.stringify(normalizedTags.sort()) !== JSON.stringify(currentTags.sort())) {
              updates.topicTags = normalizedTags;
              needsUpdate = true;
              stats.fixed.topicTags++;
            }
          } else {
            updates.topicTags = [];
            needsUpdate = true;
            stats.fixed.topicTags++;
          }

          // 9. Normalize keywords
          if (pyq.keywords) {
            const normalizedKeywords = Array.isArray(pyq.keywords)
              ? pyq.keywords
                  .map(kw => String(kw).trim())
                  .filter(kw => kw.length > 0 && kw.length < 50) // Remove empty and too long keywords
                  .slice(0, 8) // Limit to 8 keywords
              : [];
            
            const currentKeywords = Array.isArray(pyq.keywords) ? pyq.keywords : [];
            if (JSON.stringify(normalizedKeywords.sort()) !== JSON.stringify(currentKeywords.sort())) {
              updates.keywords = normalizedKeywords;
              needsUpdate = true;
              stats.fixed.keywords++;
            }
          } else if (pyq.keywords === undefined) {
            updates.keywords = [];
            needsUpdate = true;
            stats.fixed.keywords++;
          }

          // 10. Normalize analysis
          if (pyq.analysis && typeof pyq.analysis === 'string') {
            const normalizedAnalysis = pyq.analysis.trim().replace(/\s+/g, ' ');
            if (normalizedAnalysis !== pyq.analysis) {
              updates.analysis = normalizedAnalysis;
              needsUpdate = true;
              stats.fixed.analysis++;
            }
          }

          // 11. Normalize theme
          if (pyq.theme && typeof pyq.theme === 'string') {
            const normalizedTheme = pyq.theme.trim().replace(/\s+/g, ' ');
            if (normalizedTheme !== pyq.theme) {
              updates.theme = normalizedTheme;
              needsUpdate = true;
            }
          }

          // 12. Normalize sourceLink
          if (pyq.sourceLink && typeof pyq.sourceLink === 'string') {
            const normalizedSourceLink = pyq.sourceLink.trim();
            if (normalizedSourceLink !== pyq.sourceLink) {
              updates.sourceLink = normalizedSourceLink;
              needsUpdate = true;
            }
          }

          // 13. Set verified based on sourceLink
          if (pyq.sourceLink && pyq.sourceLink.includes('.gov.in') && !pyq.verified) {
            updates.verified = true;
            needsUpdate = true;
          }

          // Apply updates or delete
          if (shouldDelete && !dryRun) {
            await PYQ.deleteOne({ _id: pyq._id });
            stats.deleted++;
          } else if (needsUpdate && !dryRun) {
            await PYQ.updateOne(
              { _id: pyq._id },
              { $set: updates }
            );
            stats.updated++;
          } else if (needsUpdate) {
            stats.updated++;
          }

        } catch (error) {
          console.error(`Error processing PYQ ${pyq._id}:`, error.message);
          stats.errors++;
        }
      }

      console.log(`Processed batch ${batch + 1}/${totalBatches}`);
    }

    // Remove duplicates (intelligent matching)
    if (!dryRun) {
      const duplicates = await PYQ.aggregate([
        {
          $group: {
            _id: {
              exam: '$exam',
              year: '$year',
              questionHash: { $substr: ['$question', 0, 200] }, // Use first 200 chars for matching
              lang: '$lang'
            },
            ids: { $push: '$_id' },
            count: { $sum: 1 },
            verified: { $push: '$verified' },
            sourceLinks: { $push: '$sourceLink' },
            updatedAt: { $max: '$updatedAt' }
          }
        },
        {
          $match: { count: { $gt: 1 } }
        }
      ]);

      for (const dup of duplicates) {
        const ids = dup.ids;
        const verified = dup.verified || [];
        const sourceLinks = dup.sourceLinks || [];
        
        // Find the best one to keep (verified first, then with sourceLink, then most recent)
        let bestIndex = 0;
        for (let i = 1; i < ids.length; i++) {
          const currentVerified = verified[i] === true;
          const bestVerified = verified[bestIndex] === true;
          const currentHasSource = sourceLinks[i] && sourceLinks[i].includes('.gov.in');
          const bestHasSource = sourceLinks[bestIndex] && sourceLinks[bestIndex].includes('.gov.in');
          
          if ((currentVerified && !bestVerified) || 
              (currentHasSource && !bestHasSource && !bestVerified) ||
              (!currentVerified && !bestVerified && !currentHasSource && !bestHasSource && i < bestIndex)) {
            bestIndex = i;
          }
        }
        
        // Delete others
        const toDelete = ids.filter((_, idx) => idx !== bestIndex);
        for (const id of toDelete) {
          await PYQ.deleteOne({ _id: id });
          stats.duplicates++;
        }
      }
    } else {
      // Count duplicates for dry run
      const duplicates = await PYQ.aggregate([
        {
          $group: {
            _id: {
              exam: '$exam',
              year: '$year',
              questionHash: { $substr: ['$question', 0, 200] },
              lang: '$lang'
            },
            count: { $sum: 1 }
          }
        },
        {
          $match: { count: { $gt: 1 } }
        }
      ]);
      stats.duplicates = duplicates.reduce((sum, dup) => sum + (dup.count - 1), 0);
    }

    // Get final statistics
    const finalCount = await PYQ.countDocuments();
    const byExam = await PYQ.aggregate([
      { $group: { _id: '$exam', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    return res.status(200).json({
      success: true,
      dryRun,
      stats,
      finalCount,
      byExam: byExam.map(({ _id, count }) => ({ exam: _id, count })),
      message: dryRun 
        ? `DRY RUN: Would update ${stats.updated} records, delete ${stats.deleted} invalid entries, and remove ${stats.duplicates} duplicates. Set dryRun=false to apply changes.`
        : `✅ Updated ${stats.updated} records, deleted ${stats.deleted} invalid entries, and removed ${stats.duplicates} duplicates.`,
      warning: dryRun 
        ? 'This was a DRY RUN. No data was modified.'
        : 'Changes have been applied. Review the stats carefully.'
    });
  } catch (error) {
    console.error('Comprehensive cleanup error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to cleanup PYQ data', 
      details: error.message 
    });
  }
}

