import { getTrendingSummary } from '@/lib/cacheLayer';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const summary = await getTrendingSummary();
    return res.status(200).json(summary);
  } catch (error) {
    console.error('Trending topics fetch failed:', error);
    return res.status(500).json({ error: 'Failed to load trending topics' });
  }
}

