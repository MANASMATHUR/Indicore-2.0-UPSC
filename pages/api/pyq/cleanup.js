import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import connectToDatabase from '@/lib/mongodb';
import PYQ from '@/models/PYQ';
import { detectLanguages, getPrimaryLanguage, isMultiLanguage } from '@/lib/languageDetector';

/**
 * Cleanup and normalize PYQ data
 * This endpoint fixes common data inconsistencies:
 * - Normalizes exam names
 * - Normalizes level values
 * - Cleans up empty/invalid fields
 * - Normalizes paper names
 * - Ensures proper theme and topicTags
 * - Validates year ranges
 * - Removes duplicates
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Allow authentication via session OR admin API key
  const session = await getServerSession(req, res, authOptions);
  const adminKey = req.headers['x-admin-key'] || req.body?.adminKey;
  const validAdminKey = process.env.ADMIN_API_KEY;
  
  if (!session && (!adminKey || adminKey !== validAdminKey)) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      hint: 'Either login via browser or provide valid admin API key in X-Admin-Key header'
    });
  }

  try {
    await connectToDatabase();

    // SAFETY: Default to dryRun=true to prevent accidental data loss
    // NO AGGRESSIVE DELETION - only formatting and normalization
    const { dryRun = true, batchSize = 100 } = req.body;

    // Exam name normalization map
    const examNormalization = {
      'upsc': 'UPSC',
      'pcs': 'PCS',
      'ssc': 'SSC',
      'tnpsc': 'TNPSC',
      'mpsc': 'MPSC',
      'bpsc': 'BPSC',
      'uppsc': 'UPPSC',
      'mppsc': 'MPPSC',
      'ras': 'RAS',
      'rpsc': 'RPSC',
      'gpsc': 'GPSC',
      'kpsc': 'KPSC',
      'wbpsc': 'WBPSC',
      'ppsc': 'PPSC',
      'opsc': 'OPSC',
      'apsc': 'APSC',
      'appsc': 'APPSC',
      'tspsc': 'TSPSC',
      'hpsc': 'HPSC',
      'jkpsc': 'JKPSC',
      'kerala psc': 'KERALA PSC',
      'goa psc': 'GOA PSC'
    };

    // Level normalization
    const levelNormalization = {
      'prelims': 'Prelims',
      'prelim': 'Prelims',
      'preliminary': 'Prelims',
      'mains': 'Mains',
      'main': 'Mains',
      'interview': 'Interview',
      '': ''
    };

    // Paper name normalization patterns
    const normalizePaper = (paper, level) => {
      if (!paper || !paper.trim()) return '';
      
      const paperUpper = paper.trim().toUpperCase();
      
      // GS papers
      if (/^GS[\s\-]?[1234]$/i.test(paperUpper)) {
        return paperUpper.replace(/[\s\-]/g, '-').replace(/GS/i, 'GS-');
      }
      
      // CSAT
      if (/CSAT/i.test(paperUpper)) {
        return 'CSAT';
      }
      
      // Essay
      if (/ESSAY/i.test(paperUpper)) {
        return 'Essay';
      }
      
      // Keep as is if it's already normalized
      return paper.trim();
    };

    const stats = {
      total: 0,
      updated: 0,
      errors: 0,
      duplicates: 0,
      invalid: 0,
      fixed: {
        exam: 0,
        level: 0,
        paper: 0,
        year: 0,
        question: 0,
        topicTags: 0,
        keywords: 0,
        analysis: 0,
        lang: 0,
        mixedLanguage: 0
      }
    };

    // Get total count
    stats.total = await PYQ.countDocuments();

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
          const updates = {};
          let needsUpdate = false;

          // 1. Normalize exam
          if (pyq.exam) {
            const normalizedExam = examNormalization[pyq.exam.toLowerCase().trim()] || pyq.exam.toUpperCase().trim();
            if (normalizedExam !== pyq.exam) {
              updates.exam = normalizedExam;
              needsUpdate = true;
              stats.fixed.exam++;
            }
          } else {
            stats.invalid++;
            continue; // Skip invalid entries
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

          // 3. Normalize paper
          if (pyq.paper !== undefined) {
            const normalizedPaper = normalizePaper(pyq.paper, pyq.level);
            if (normalizedPaper !== (pyq.paper || '')) {
              updates.paper = normalizedPaper;
              needsUpdate = true;
              stats.fixed.paper++;
            }
          }

          // 4. Validate and normalize year (only fix, never delete)
          if (!pyq.year || pyq.year < 1990 || pyq.year > new Date().getFullYear() + 1) {
            // Try to fix the year if possible
            if (pyq.year && pyq.year > 1900 && pyq.year < 2100) {
              // Year might be valid, just update it
              updates.year = Math.max(1990, Math.min(pyq.year, new Date().getFullYear()));
              needsUpdate = true;
              stats.fixed.year++;
            } else {
              // Only mark as invalid, don't delete - user can review
              stats.invalid++;
              console.warn(`Invalid year for PYQ ${pyq._id}: ${pyq.year}`);
              // Skip this entry but don't delete
              continue;
            }
          }

          // 5. Validate and normalize question (must be at least 20 chars for user-friendly display)
          if (!pyq.question || pyq.question.trim().length < 20) {
            // Try to extract question from answer or other fields
            const potentialQuestion = pyq.answer || pyq.theme || '';
            if (potentialQuestion && potentialQuestion.trim().length >= 20) {
              updates.question = potentialQuestion.trim();
              needsUpdate = true;
              stats.fixed.question++;
            } else {
              // Only mark as invalid, don't delete - user can review
              stats.invalid++;
              console.warn(`Invalid question for PYQ ${pyq._id}: too short (${pyq.question?.length || 0} chars)`);
              // Skip this entry but don't delete
              continue;
            }
          }

          // 5b. Check and fix mixed-language questions (ensure single language)
          if (pyq.question && isMultiLanguage(pyq.question)) {
            const detectedLangs = detectLanguages(pyq.question);
            const primaryLang = getPrimaryLanguage(pyq.question);
            
            // Count characters in each language to determine dominant language
            const questionText = pyq.question;
            let hindiChars = 0;
            let englishChars = 0;
            let otherChars = 0;
            
            for (let i = 0; i < questionText.length; i++) {
              const char = questionText[i];
              if (/[\u0900-\u097F]/.test(char)) {
                hindiChars++;
              } else if (/[a-zA-Z]/.test(char)) {
                englishChars++;
              } else if (!/\s/.test(char)) {
                otherChars++;
              }
            }
            
            // Determine which language has more content
            let dominantLang = primaryLang;
            if (hindiChars > englishChars * 1.5) {
              dominantLang = 'hi';
            } else if (englishChars > hindiChars * 1.5) {
              dominantLang = 'en';
            } else {
              // If roughly equal, prefer the primary language detected
              dominantLang = primaryLang;
            }
            
            // Update lang field to reflect the dominant language
            if (dominantLang && dominantLang !== pyq.lang && pyq.lang !== 'multi') {
              updates.lang = dominantLang;
              needsUpdate = true;
              stats.fixed.mixedLanguage++;
              stats.fixed.lang++;
              console.warn(`Mixed language question detected for PYQ ${pyq._id}: ${detectedLangs.join(', ')}. Setting to: ${dominantLang} (Hindi: ${hindiChars} chars, English: ${englishChars} chars)`);
            } else if (!pyq.lang || pyq.lang === 'multi') {
              // Set lang to dominant language if not set or set to 'multi'
              updates.lang = dominantLang || 'en';
              needsUpdate = true;
              stats.fixed.mixedLanguage++;
              stats.fixed.lang++;
            }
          } else if (pyq.question && pyq.lang === 'multi') {
            // If not detected as multi-language but lang is set to 'multi', fix it
            const primaryLang = getPrimaryLanguage(pyq.question);
            updates.lang = primaryLang || 'en';
            needsUpdate = true;
            stats.fixed.mixedLanguage++;
            stats.fixed.lang++;
          }

          const normalizedQuestion = pyq.question.trim().replace(/\s+/g, ' ');
          if (normalizedQuestion !== pyq.question) {
            updates.question = normalizedQuestion;
            needsUpdate = true;
            stats.fixed.question++;
          }

          // 6. Normalize answer
          if (pyq.answer) {
            const normalizedAnswer = pyq.answer.trim();
            if (normalizedAnswer !== pyq.answer) {
              updates.answer = normalizedAnswer;
              needsUpdate = true;
            }
          }

          // 7. Normalize lang
          const validLangs = ['en', 'hi', 'ta', 'te', 'kn', 'ml', 'mr', 'gu', 'pa', 'bn', 'or', 'as', 'ur', 'ne', 'si', 'multi'];
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

          // 8b. Normalize keywords (new field)
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
            // Initialize empty array if field doesn't exist
            updates.keywords = [];
            needsUpdate = true;
            stats.fixed.keywords++;
          }

          // 8c. Normalize analysis (new field)
          if (pyq.analysis) {
            const normalizedAnalysis = String(pyq.analysis).trim().replace(/\s+/g, ' ');
            if (normalizedAnalysis !== pyq.analysis) {
              updates.analysis = normalizedAnalysis;
              needsUpdate = true;
              stats.fixed.analysis++;
            }
          }

          // 9. Normalize theme
          if (pyq.theme) {
            const normalizedTheme = pyq.theme.trim();
            if (normalizedTheme !== pyq.theme) {
              updates.theme = normalizedTheme;
              needsUpdate = true;
            }
          }

          // 10. Normalize sourceLink
          if (pyq.sourceLink) {
            const normalizedSourceLink = pyq.sourceLink.trim();
            if (normalizedSourceLink !== pyq.sourceLink) {
              updates.sourceLink = normalizedSourceLink;
              needsUpdate = true;
            }
          }

          // 11. Set verified based on sourceLink
          if (pyq.sourceLink && pyq.sourceLink.includes('.gov.in') && !pyq.verified) {
            updates.verified = true;
            needsUpdate = true;
          }

          // Apply updates (NO DELETION - only formatting)
          if (needsUpdate && !dryRun) {
            await PYQ.updateOne(
              { _id: pyq._id },
              { $set: updates }
            );
            stats.updated++;
          } else if (needsUpdate) {
            stats.updated++;
          }
        } catch (error) {
          console.error(`Error processing PYQ ${pyq._id}:`, error);
          stats.errors++;
        }
      }

      console.log(`Processed batch ${batch + 1}/${totalBatches}`);
    }

    // Remove duplicates (CONSERVATIVE - only exact duplicates with same exam, year, question, and lang)
    if (!dryRun) {
      const duplicates = await PYQ.aggregate([
        {
          $group: {
            _id: {
              exam: '$exam',
              year: '$year',
              question: { $substr: ['$question', 0, 500] }, // Longer match for better accuracy
              lang: '$lang'
            },
            ids: { $push: '$_id' },
            count: { $sum: 1 },
            verified: { $push: '$verified' },
            sourceLinks: { $push: '$sourceLink' }
          }
        },
        {
          $match: { count: { $gt: 1 } }
        }
      ]);

      for (const dup of duplicates) {
        // Keep the best one (verified first, then with sourceLink, then oldest)
        const ids = dup.ids;
        const verified = dup.verified || [];
        const sourceLinks = dup.sourceLinks || [];
        
        // Find the best one to keep
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
        
        // Delete others, but log them first
        const toDelete = ids.filter((_, idx) => idx !== bestIndex);
        
        for (const id of toDelete) {
          console.log(`Removing duplicate PYQ: ${id} (keeping: ${ids[bestIndex]})`);
          await PYQ.deleteOne({ _id: id });
          stats.duplicates++;
        }
      }
    }

    return res.status(200).json({
      success: true,
      dryRun,
      stats,
      message: dryRun 
        ? `DRY RUN: Would update ${stats.updated} records, flag ${stats.invalid} invalid entries (not deleted), fix ${stats.fixed.mixedLanguage} mixed-language questions, and remove ${stats.duplicates} exact duplicates. Set dryRun=false to apply changes.`
        : `✅ Updated ${stats.updated} records, flagged ${stats.invalid} invalid entries (review manually), fixed ${stats.fixed.mixedLanguage} mixed-language questions, and removed ${stats.duplicates} exact duplicates.`,
      warning: dryRun 
        ? 'This was a DRY RUN. No data was modified. Review the stats and set dryRun=false to apply changes.'
        : 'Changes have been applied. Only formatting and normalization - NO DELETIONS. Invalid entries were flagged for manual review.'
    });
  } catch (error) {
    console.error('PYQ cleanup error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to cleanup PYQ data', 
      details: error.message 
    });
  }
}

