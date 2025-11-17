import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import connectToDatabase from '@/lib/mongodb';
import PYQ from '@/models/PYQ';

/**
 * Safe validation endpoint - only reports issues, never deletes
 * Use this to check your PYQ data before running cleanup
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await connectToDatabase();

    const total = await PYQ.countDocuments();
    
    // Check for issues without modifying anything
    const issues = {
      invalidYear: [],
      shortQuestion: [],
      missingExam: [],
      duplicates: [],
      emptyFields: []
    };

    const stats = {
      total,
      valid: 0,
      invalid: 0,
      byExam: {},
      byLevel: {},
      byYear: {}
    };

    // Sample check (first 1000 to avoid timeout)
    const sampleSize = Math.min(1000, total);
    const sample = await PYQ.find({})
      .limit(sampleSize)
      .lean();

    for (const pyq of sample) {
      let isValid = true;

      // Check year
      if (!pyq.year || pyq.year < 1990 || pyq.year > new Date().getFullYear() + 1) {
        issues.invalidYear.push({
          _id: pyq._id,
          year: pyq.year,
          question: pyq.question?.substring(0, 100)
        });
        isValid = false;
      }

      // Check question
      if (!pyq.question || pyq.question.trim().length < 10) {
        issues.shortQuestion.push({
          _id: pyq._id,
          questionLength: pyq.question?.length || 0,
          question: pyq.question?.substring(0, 50)
        });
        isValid = false;
      }

      // Check exam
      if (!pyq.exam || !pyq.exam.trim()) {
        issues.missingExam.push({
          _id: pyq._id,
          question: pyq.question?.substring(0, 100)
        });
        isValid = false;
      }

      // Check empty fields
      const emptyFields = [];
      if (!pyq.level || !pyq.level.trim()) emptyFields.push('level');
      if (!pyq.paper || !pyq.paper.trim()) emptyFields.push('paper');
      if (!pyq.theme || !pyq.theme.trim()) emptyFields.push('theme');
      if (!pyq.topicTags || !Array.isArray(pyq.topicTags) || pyq.topicTags.length === 0) {
        emptyFields.push('topicTags');
      }
      if (emptyFields.length > 0) {
        issues.emptyFields.push({
          _id: pyq._id,
          emptyFields,
          question: pyq.question?.substring(0, 100)
        });
      }

      if (isValid) {
        stats.valid++;
      } else {
        stats.invalid++;
      }

      // Count by exam
      const exam = pyq.exam || 'Unknown';
      stats.byExam[exam] = (stats.byExam[exam] || 0) + 1;

      // Count by level
      const level = pyq.level || 'Unknown';
      stats.byLevel[level] = (stats.byLevel[level] || 0) + 1;

      // Count by year
      if (pyq.year) {
        stats.byYear[pyq.year] = (stats.byYear[pyq.year] || 0) + 1;
      }
    }

    // Check for duplicates (sample)
    const duplicateCheck = await PYQ.aggregate([
      {
        $group: {
          _id: {
            exam: '$exam',
            year: '$year',
            question: { $substr: ['$question', 0, 200] }
          },
          ids: { $push: '$_id' },
          count: { $sum: 1 }
        }
      },
      {
        $match: { count: { $gt: 1 } }
      },
      {
        $limit: 100 // Limit to first 100 duplicate groups
      }
    ]);

    issues.duplicates = duplicateCheck.map(dup => ({
      count: dup.count,
      sampleIds: dup.ids.slice(0, 3) // Show first 3 IDs
    }));

    return res.status(200).json({
      success: true,
      total,
      sampleSize,
      stats: {
        ...stats,
        validPercentage: ((stats.valid / sampleSize) * 100).toFixed(2) + '%',
        invalidPercentage: ((stats.invalid / sampleSize) * 100).toFixed(2) + '%'
      },
      issues: {
        invalidYear: {
          count: issues.invalidYear.length,
          samples: issues.invalidYear.slice(0, 10) // Show first 10
        },
        shortQuestion: {
          count: issues.shortQuestion.length,
          samples: issues.shortQuestion.slice(0, 10)
        },
        missingExam: {
          count: issues.missingExam.length,
          samples: issues.missingExam.slice(0, 10)
        },
        emptyFields: {
          count: issues.emptyFields.length,
          samples: issues.emptyFields.slice(0, 10)
        },
        duplicates: {
          count: issues.duplicates.length,
          samples: issues.duplicates.slice(0, 10)
        }
      },
      message: 'This is a READ-ONLY validation. No data was modified. Review the issues before running cleanup.'
    });
  } catch (error) {
    console.error('PYQ validation error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to validate PYQ data', 
      details: error.message 
    });
  }
}

