import connectToDatabase from '@/lib/mongodb';
import PYQ from '@/models/PYQ';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await connectToDatabase();
    const body = req.body;
    if (!Array.isArray(body) || body.length === 0) {
      return res.status(400).json({ ok: false, error: 'Provide an array of PYQ items' });
    }

    const normalized = body.map((it) => ({
      exam: it.exam || 'UPSC',
      level: it.level || '',
      paper: it.paper || '',
      year: typeof it.year === 'string' ? parseInt(it.year, 10) : it.year,
      question: it.question || '',
      topicTags: Array.isArray(it.topicTags) ? it.topicTags : (it.topicTags ? String(it.topicTags).split(',').map(s => s.trim()) : []),
      sourceLink: it.sourceLink || '',
      verified: Boolean(it.verified)
    })).filter(it => it.question && it.year);

    if (normalized.length === 0) {
      return res.status(400).json({ ok: false, error: 'No valid items to insert' });
    }

    const inserted = await PYQ.insertMany(normalized, { ordered: false });
    return res.status(200).json({ ok: true, inserted: inserted.length });
  } catch (err) {
    console.error('PYQ seed error', err);
    return res.status(500).json({ ok: false, error: 'PYQ seeding failed' });
  }
}


