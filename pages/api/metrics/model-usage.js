import { getMetricsSummary } from '@/lib/metrics';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const summary = getMetricsSummary();
    return res.status(200).json(summary);
  } catch (error) {
    console.error('Failed to load model metrics:', error);
    return res.status(500).json({ error: 'Unable to fetch metrics' });
  }
}

