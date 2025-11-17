import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';

/**
 * Convenience endpoint to run PYQ cleanup
 * This endpoint helps clean the database for better archive display
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { dryRun = true, aggressive = false } = req.body;

    // Call the cleanup endpoint internally
    const baseUrl = process.env.NEXTAUTH_URL || `http://localhost:${process.env.PORT || 3000}`;
    const cleanupUrl = `${baseUrl}/api/pyq/cleanup`;

    const response = await fetch(cleanupUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': req.headers.cookie || ''
      },
      body: JSON.stringify({
        dryRun,
        aggressive,
        batchSize: 100
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json({
      success: true,
      message: 'Cleanup completed successfully',
      cleanupResults: data,
      recommendations: [
        'Review the stats to see what was fixed',
        'Check the archive page to verify PYQs are now user-friendly',
        'If satisfied, run again with dryRun=false to apply changes',
        'Use aggressive=true to delete invalid entries (use with caution)'
      ]
    });
  } catch (error) {
    console.error('Cleanup execution error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to run cleanup', 
      details: error.message 
    });
  }
}

