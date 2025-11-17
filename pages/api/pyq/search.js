import connectToDatabase from '@/lib/mongodb';
import PYQ from '@/models/PYQ';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await connectToDatabase();

    const {
      exam = 'UPSC', // default UPSC
      theme = '',
      fromYear,
      toYear,
      level, // Prelims/Mains
      paper, // GS-2, GS-3 etc.
      limit = 200
    } = req.query;

    const filter = {};
    
    // Normalize exam filter
    if (exam) {
      const examUpper = exam.toUpperCase().trim();
      filter.exam = examUpper;
    }
    
    // Normalize level filter
    if (level) {
      const levelNormalized = level.trim();
      if (levelNormalized) {
        filter.level = new RegExp(`^${levelNormalized}$`, 'i');
      }
    }
    
    // Normalize paper filter
    if (paper) {
      const paperClean = paper.trim();
      if (paperClean) {
        filter.paper = new RegExp(paperClean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      }
    }

    if (fromYear || toYear) {
      filter.year = {};
      if (fromYear) filter.year.$gte = parseInt(fromYear, 10);
      if (toYear) filter.year.$lte = parseInt(toYear, 10);
    }

    const cap = Math.min(parseInt(limit, 10) || 200, 500);

    async function runQuery(useText) {
      const queryFilter = { ...filter };
      
      // Add theme search
      if (theme && theme.trim()) {
        const themeClean = theme.trim();
        const or = useText
          ? [ 
              { $text: { $search: themeClean } }, 
              { topicTags: { $regex: themeClean, $options: 'i' } }, 
              { question: { $regex: themeClean, $options: 'i' } },
              { theme: { $regex: themeClean, $options: 'i' } }
            ]
          : [ 
              { topicTags: { $regex: themeClean, $options: 'i' } }, 
              { question: { $regex: themeClean, $options: 'i' } },
              { theme: { $regex: themeClean, $options: 'i' } }
            ];
        queryFilter.$or = or;
      }
      
      // Ensure we only get valid, user-friendly documents
      queryFilter.question = { $exists: true, $ne: '', $regex: /.{20,}/ }; // At least 20 chars for user-friendly display
      queryFilter.year = { $gte: 1990, $lte: new Date().getFullYear() + 1 };
      queryFilter.exam = { $exists: true, $ne: '' }; // Must have exam
      
      return await PYQ.find(queryFilter)
        .sort({ 
          verified: -1, // Verified first
          analysis: -1, // Questions with analysis prioritized
          year: -1 // Then newest
        })
        .limit(cap)
        .lean();
    }

    let items = [];
    try {
      items = await runQuery(true);
    } catch (e) {
      // Fallback when $text index not present
      items = await runQuery(false);
    }

    // Filter out invalid items - only show user-friendly, quality PYQs
    const validItems = items.filter(item => 
      item.question && 
      item.question.trim().length >= 20 && // Minimum 20 chars for readability
      item.year && 
      item.year >= 1990 && 
      item.year <= new Date().getFullYear() + 1 &&
      item.exam && 
      item.exam.trim().length > 0 // Must have exam name
    );

    // Sort items: verified first, then unverified (both sorted by year descending)
    const sortedItems = validItems.sort((a, b) => {
      const aVerified = a.verified === true || (a.sourceLink && a.sourceLink.includes('.gov.in'));
      const bVerified = b.verified === true || (b.sourceLink && b.sourceLink.includes('.gov.in'));
      if (aVerified !== bVerified) return bVerified ? 1 : -1; // Verified first
      return (b.year || 0) - (a.year || 0); // Then by year descending (newest first)
    });

    const verifiedCount = sortedItems.filter(q => q.verified === true || (q.sourceLink && q.sourceLink.includes('.gov.in'))).length;
    const unverifiedCount = sortedItems.length - verifiedCount;

    // Group by decade and format lines for display
    const byDecade = new Map();
    for (const q of sortedItems) {
      const decade = Math.floor((q.year || 0) / 10) * 10;
      if (!byDecade.has(decade)) byDecade.set(decade, []);
      
      const isUnverified = q.verified === false && (!q.sourceLink || !q.sourceLink.includes('.gov.in'));
      const topicTags = q.topicTags && q.topicTags.length > 0 ? q.topicTags.join(', ') : null;
      
      // Build the label with topic/theme information
      let label = `${q.year || '—'} – ${q.paper ? `${q.paper} – ` : ''}${q.question}`;
      
      // Add topic/theme if available
      if (topicTags) {
        label += ` [Topic: ${topicTags}]`;
      }
      
      // Add verification status
      if (isUnverified) {
        label += ' ⚠️ (unverified)';
      } else if (q.sourceLink && q.sourceLink.includes('.gov.in')) {
        label += ' ✅';
      }
      
      byDecade.get(decade).push(label);
    }

    const lines = [];
    const sortedDecades = Array.from(byDecade.keys()).sort((a, b) => a - b);
    for (const d of sortedDecades) {
      lines.push(`${d}s:`);
      for (const row of byDecade.get(d)) lines.push(`- ${row}`);
      lines.push('');
    }
    
    // Summary with counts
    if (verifiedCount > 0 && unverifiedCount > 0) {
      lines.push(`Total listed: ${sortedItems.length} (${verifiedCount} ✅ verified, ${unverifiedCount} ⚠️ unverified)`);
    } else if (verifiedCount > 0) {
      lines.push(`Total listed: ${sortedItems.length} (✅ All verified from official sources)`);
    } else {
      lines.push(`Total listed: ${sortedItems.length} (⚠️ All unverified - please verify before use)`);
    }

    return res.status(200).json({
      ok: true,
      count: items.length,
      items,
      formatted: lines.join('\n')
    });
  } catch (err) {
    console.error('PYQ search error', err);
    return res.status(500).json({ ok: false, error: 'PYQ search failed' });
  }
}



