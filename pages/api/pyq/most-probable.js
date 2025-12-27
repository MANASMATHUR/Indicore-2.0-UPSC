import connectToDatabase from '@/lib/mongodb';
import PYQ from '@/models/PYQ';
import pyqAnalysisService from '@/lib/pyqAnalysisService';

/**
 * Get most probable questions based on:
 * - Recent trends (last 3-5 years)
 * - Topic frequency
 * - Similar patterns
 * - Keyword analysis
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { 
      exam = 'UPSC', 
      level = '', 
      paper = '', 
      subject = '',
      limit = 20,
      yearRange = 5 // Look at last 5 years for trends
    } = req.body;

    await connectToDatabase();

    const currentYear = new Date().getFullYear();
    const fromYear = currentYear - yearRange;

    // Build filter
    const filter = {
      exam: exam.toUpperCase(),
      year: { $gte: fromYear, $lte: currentYear }
    };

    if (level) filter.level = level;
    if (paper) filter.paper = { $regex: paper, $options: 'i' };

    // Get recent questions for trend analysis
    const recentQuestions = await PYQ.find(filter)
      .sort({ year: -1, verified: -1 })
      .limit(500)
      .lean();

    // Analyze trends
    const topicFrequency = new Map();
    const keywordFrequency = new Map();
    const yearFrequency = new Map();

    recentQuestions.forEach(q => {
      // Count topic tags
      if (q.topicTags && Array.isArray(q.topicTags)) {
        q.topicTags.forEach(tag => {
          topicFrequency.set(tag, (topicFrequency.get(tag) || 0) + 1);
        });
      }

      // Count keywords
      if (q.keywords && Array.isArray(q.keywords)) {
        q.keywords.forEach(keyword => {
          keywordFrequency.set(keyword, (keywordFrequency.get(keyword) || 0) + 1);
        });
      }

      // Count by year
      if (q.year) {
        yearFrequency.set(q.year, (yearFrequency.get(q.year) || 0) + 1);
      }
    });

    // Get top topics and keywords
    const topTopics = Array.from(topicFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([topic]) => topic);

    const topKeywords = Array.from(keywordFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([keyword]) => keyword);

    // Find questions that match top trends
    const trendFilter = {
      ...filter,
      $or: [
        { topicTags: { $in: topTopics } },
        { keywords: { $in: topKeywords } },
        { theme: { $in: topTopics } }
      ]
    };

    // If subject is specified, prioritize it
    if (subject) {
      trendFilter.$or.push(
        { topicTags: { $regex: subject, $options: 'i' } },
        { theme: { $regex: subject, $options: 'i' } }
      );
    }

    const probableQuestions = await PYQ.find(trendFilter)
      .sort({ 
        verified: -1,
        year: -1,
        // Prioritize questions with analysis
        analysis: { $exists: true, $ne: '' } ? 1 : 0
      })
      .limit(limit * 2) // Get more to filter
      .lean();

    // Score questions based on:
    // 1. Recency (newer = higher score)
    // 2. Topic match (matches top topics = higher score)
    // 3. Keyword match (matches top keywords = higher score)
    // 4. Has analysis (has analysis = higher score)
    // 5. Verified status (verified = higher score)

    const scoredQuestions = probableQuestions.map(q => {
      let score = 0;

      // Recency score (0-30 points)
      const yearsAgo = currentYear - (q.year || currentYear);
      score += Math.max(0, 30 - (yearsAgo * 2));

      // Topic match score (0-25 points)
      const matchingTopics = (q.topicTags || []).filter(tag => topTopics.includes(tag)).length;
      score += Math.min(25, matchingTopics * 5);

      // Keyword match score (0-20 points)
      const matchingKeywords = (q.keywords || []).filter(kw => topKeywords.includes(kw)).length;
      score += Math.min(20, matchingKeywords * 3);

      // Analysis score (0-15 points)
      if (q.analysis && q.analysis.length > 0) {
        score += 15;
      }

      // Verified score (0-10 points)
      if (q.verified || (q.sourceLink && q.sourceLink.includes('.gov.in'))) {
        score += 10;
      }

      // Subject match bonus (if specified)
      if (subject) {
        const subjectLower = subject.toLowerCase();
        const questionLower = (q.question || '').toLowerCase();
        const tagsLower = (q.topicTags || []).join(' ').toLowerCase();
        if (questionLower.includes(subjectLower) || tagsLower.includes(subjectLower)) {
          score += 20;
        }
      }

      return { ...q, score };
    });

    // Sort by score and take top N
    const topQuestions = scoredQuestions
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ score, ...q }) => ({
        ...q,
        relevanceScore: score,
        trendReasons: [
          ...(q.topicTags || []).filter(tag => topTopics.includes(tag)).map(tag => `Trending topic: ${tag}`),
          ...(q.keywords || []).filter(kw => topKeywords.includes(kw)).slice(0, 2).map(kw => `Important keyword: ${kw}`),
          q.year >= currentYear - 2 ? 'Recent question' : null,
          q.analysis ? 'Has detailed analysis' : null
        ].filter(Boolean)
      }));

    return res.status(200).json({
      success: true,
      questions: topQuestions,
      trends: {
        topTopics: topTopics.slice(0, 5),
        topKeywords: topKeywords.slice(0, 8),
        yearDistribution: Object.fromEntries(yearFrequency),
        totalAnalyzed: recentQuestions.length
      },
      count: topQuestions.length
    });

  } catch (error) {
    console.error('Most probable questions error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to get most probable questions',
      message: error.message 
    });
  }
}

