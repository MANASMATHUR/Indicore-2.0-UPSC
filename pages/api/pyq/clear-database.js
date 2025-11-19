import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import connectToDatabase from '@/lib/mongodb';
import PYQ from '@/models/PYQ';

/**
 * Clear PYQ Database
 * WARNING: This endpoint can DELETE ALL PYQ data from the database
 * Use with extreme caution!
 * 
 * Safety features:
 * - Requires authentication
 * - Requires explicit confirmation
 * - Supports filtering by exam, year range, etc.
 * - Defaults to dryRun=true
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

    // SAFETY: Default to dryRun=true to prevent accidental deletion
    const { 
      dryRun = true, 
      confirmDelete = false,
      exam = null,        // Filter by exam (e.g., 'UPSC', 'PCS')
      fromYear = null,    // Filter by year range
      toYear = null,
      level = null,       // Filter by level (e.g., 'Prelims', 'Mains')
      paper = null,       // Filter by paper (e.g., 'GS-1', 'GS-2')
      verified = null,    // Filter by verified status (true/false)
      invalidOnly = false // Only delete invalid entries
    } = req.body;

    // Build filter
    const filter = {};

    if (exam) {
      filter.exam = exam.toUpperCase().trim();
    }

    if (level) {
      filter.level = level.trim();
    }

    if (paper) {
      filter.paper = { $regex: paper.trim(), $options: 'i' };
    }

    if (fromYear || toYear) {
      filter.year = {};
      if (fromYear) filter.year.$gte = parseInt(fromYear, 10);
      if (toYear) filter.year.$lte = parseInt(toYear, 10);
    }

    if (verified !== null) {
      filter.verified = verified === true;
    }

    // If invalidOnly is true, find entries with invalid data
    if (invalidOnly) {
      filter.$or = [
        { question: { $exists: false } },
        { question: '' },
        { question: { $regex: /^.{0,19}$/ } }, // Less than 20 chars
        { year: { $exists: false } },
        { year: { $lt: 1990 } },
        { year: { $gt: new Date().getFullYear() + 1 } },
        { exam: { $exists: false } },
        { exam: '' }
      ];
    }

    // Get count before deletion
    const countBefore = await PYQ.countDocuments(filter);
    const totalCount = await PYQ.countDocuments();

    // Safety check: Require explicit confirmation for full database deletion
    if (!dryRun && !confirmDelete && Object.keys(filter).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Safety check failed',
        message: 'To delete ALL records, you must set confirmDelete=true in the request body',
        warning: 'This will delete ALL PYQ data from the database!',
        countBefore,
        totalCount
      });
    }

    // Safety check: Require explicit confirmation for large deletions (>1000 records)
    if (!dryRun && !confirmDelete && countBefore > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Safety check failed',
        message: `To delete ${countBefore} records, you must set confirmDelete=true in the request body`,
        warning: 'This is a large deletion operation!',
        countBefore,
        totalCount
      });
    }

    let deletedCount = 0;
    let stats = {
      totalBefore: totalCount,
      matchingRecords: countBefore,
      deleted: 0,
      remaining: 0
    };

    if (!dryRun && confirmDelete) {
      // Perform deletion
      const result = await PYQ.deleteMany(filter);
      deletedCount = result.deletedCount;
      stats.deleted = deletedCount;
      stats.remaining = await PYQ.countDocuments();
    } else {
      // Dry run - just report what would be deleted
      stats.deleted = countBefore;
      stats.remaining = totalCount - countBefore;
    }

    // Get breakdown by exam after deletion (if not dry run)
    let byExam = [];
    if (!dryRun && confirmDelete) {
      byExam = await PYQ.aggregate([
        { $group: { _id: '$exam', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
    } else {
      // For dry run, show what would remain
      const remainingFilter = {};
      Object.keys(filter).forEach(key => {
        if (key !== '$or') {
          remainingFilter[key] = filter[key];
        }
      });
      // Invert the filter for remaining count
      const remainingCount = totalCount - countBefore;
      byExam = await PYQ.aggregate([
        { $match: remainingFilter },
        { $group: { _id: '$exam', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
    }

    return res.status(200).json({
      success: true,
      dryRun,
      confirmDelete,
      stats,
      byExam: byExam.map(({ _id, count }) => ({ exam: _id, count })),
      filter: Object.keys(filter).length > 0 ? filter : 'ALL RECORDS',
      message: dryRun
        ? `DRY RUN: Would delete ${countBefore} record(s) matching the filter. Set dryRun=false and confirmDelete=true to apply.`
        : confirmDelete
        ? `✅ Successfully deleted ${deletedCount} record(s). ${stats.remaining} records remain in database.`
        : `⚠️ Deletion not performed. Set confirmDelete=true to confirm deletion.`,
      warning: dryRun
        ? 'This was a DRY RUN. No data was deleted.'
        : confirmDelete
        ? '⚠️ Data has been permanently deleted. This action cannot be undone!'
        : '⚠️ Deletion requires explicit confirmation. Set confirmDelete=true to proceed.'
    });
  } catch (error) {
    console.error('PYQ database clear error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to clear PYQ database', 
      details: error.message 
    });
  }
}

