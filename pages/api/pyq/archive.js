import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import connectToDatabase from '@/lib/mongodb';
import PYQ from '@/models/PYQ';

function buildRegex(value) {
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

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

    const {
      exam = 'UPSC',
      subject,
      theme,
      tags,
      fromYear = 2000,
      toYear = new Date().getFullYear(),
      page = 1,
      limit = 20,
      summaryOnly = 'false'
    } = req.query;

    const numericFrom = parseNumber(fromYear, 2000);
    const numericTo = parseNumber(toYear, new Date().getFullYear());
    const pageNum = Math.max(1, parseNumber(page, 1));
    const limitNum = Math.min(100, Math.max(5, parseNumber(limit, 20)));
    const skip = (pageNum - 1) * limitNum;

    const filter = {
      exam: buildRegex(exam),
      year: { $gte: numericFrom, $lte: numericTo }
    };

    if (subject || theme) {
      const subjectRegex = buildRegex(subject || theme);
      filter.$or = [
        { theme: subjectRegex },
        { topicTags: subjectRegex },
        { question: subjectRegex }
      ];
    }

    if (tags) {
      const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
      if (tagList.length) {
        filter.topicTags = { $in: tagList.map((tag) => buildRegex(tag)) };
      }
    }

    const [items, total, yearBreakdown, subjectBreakdown] = await Promise.all([
      summaryOnly === 'true'
        ? []
        : PYQ.find(filter)
            .sort({ year: -1 })
            .skip(skip)
            .limit(limitNum)
            .select('question answer year paper theme topicTags exam level -_id')
            .lean(),
      PYQ.countDocuments(filter),
      PYQ.aggregate([
        { $match: filter },
        { $group: { _id: '$year', count: { $sum: 1 } } },
        { $sort: { _id: -1 } }
      ]),
      PYQ.aggregate([
        { $match: filter },
        { $group: { _id: { $ifNull: ['$theme', 'General'] }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 15 }
      ])
    ]);

    return res.status(200).json({
      archive: {
        metadata: {
          exam,
          fromYear: numericFrom,
          toYear: numericTo,
          total,
          page: pageNum,
          totalPages: Math.max(1, Math.ceil(total / limitNum))
        },
        yearBreakdown: yearBreakdown.map((entry) => ({ year: entry._id, count: entry.count })),
        subjectBreakdown: subjectBreakdown.map((entry) => ({ subject: entry._id, count: entry.count })),
        questions: summaryOnly === 'true' ? [] : items
      }
    });
  } catch (error) {
    console.error('Error fetching PYQ archive:', error);
    return res.status(500).json({ error: 'Failed to fetch PYQ archive', details: error.message });
  }
}
