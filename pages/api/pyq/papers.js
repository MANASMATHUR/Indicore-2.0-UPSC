import connectToDatabase from '@/lib/mongodb';
import PYQ from '@/models/PYQ';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await connectToDatabase();

    const {
      exam = 'UPSC',
      level = '' // Prelims, Mains, or empty for all
    } = req.query;

    const filter = {
      exam: new RegExp(`^${exam}$`, 'i')
    };

    if (level) {
      filter.level = new RegExp(level, 'i');
    }

    // Get distinct papers for the exam and level
    const papers = await PYQ.distinct('paper', filter);

    // Get question counts for each paper
    const papersWithCounts = await Promise.all(
      papers.map(async (paper) => {
        const count = await PYQ.countDocuments({ ...filter, paper });
        return {
          paper: paper || 'General',
          count
        };
      })
    );

    // Sort by count (descending) and then by paper name
    papersWithCounts.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return (a.paper || '').localeCompare(b.paper || '');
    });

    return res.status(200).json({
      ok: true,
      exam,
      level: level || 'All',
      papers: papersWithCounts,
      totalPapers: papersWithCounts.length
    });
  } catch (err) {
    console.error('PYQ papers error', err);
    return res.status(500).json({ ok: false, error: 'Failed to fetch papers' });
  }
}


