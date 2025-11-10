import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import connectToDatabase from '@/lib/mongodb';
import Visitor from '@/models/Visitor';
import User from '@/models/User';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Optional: Add admin check if you want to restrict this endpoint
  // const session = await getServerSession(req, res, authOptions);
  // if (!session) {
  //   return res.status(401).json({ error: 'Unauthorized' });
  // }

  try {
    await connectToDatabase();

    const { period = '7d', includeBots = 'false' } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    switch (period) {
      case '1d':
        startDate.setDate(now.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case 'all':
        startDate = new Date(0); // All time
        break;
      default:
        startDate.setDate(now.getDate() - 7);
    }

    // Build query
    const query = {
      firstVisit: { $gte: startDate }
    };

    if (includeBots === 'false') {
      query.isBot = false;
    }

    // Get total visitors
    const totalVisitors = await Visitor.countDocuments(query);

    // Get unique visitors (by visitorId)
    const uniqueVisitors = await Visitor.distinct('visitorId', query);

    // Get bots count (always calculate, regardless of includeBots filter)
    const botQuery = { 
      firstVisit: { $gte: startDate },
      isBot: true 
    };
    const botCount = await Visitor.countDocuments(botQuery);

    // Get converted visitors
    const convertedVisitors = await Visitor.countDocuments({
      ...query,
      converted: true
    });

    // Get total users
    const totalUsers = await User.countDocuments({
      createdAt: { $gte: startDate }
    });

    // Calculate conversion rate
    const conversionRate = uniqueVisitors.length > 0 
      ? ((convertedVisitors / uniqueVisitors.length) * 100).toFixed(2)
      : 0;

    // Get visitors by device
    const deviceStats = await Visitor.aggregate([
      { $match: query },
      { $group: { _id: '$device', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Get visitors by browser
    const browserStats = await Visitor.aggregate([
      { $match: query },
      { $group: { _id: '$browser', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Get visitors by OS
    const osStats = await Visitor.aggregate([
      { $match: query },
      { $group: { _id: '$os', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Get daily visitor trends
    const dailyStats = await Visitor.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$firstVisit' }
          },
          visitors: { $addToSet: '$visitorId' },
          visits: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          date: '$_id',
          uniqueVisitors: { $size: '$visitors' },
          totalVisits: '$visits'
        }
      }
    ]);

    // Get top landing pages
    const topLandingPages = await Visitor.aggregate([
      { $match: query },
      { $group: { _id: '$landingPage', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Get average time on site
    const avgTimeOnSite = await Visitor.aggregate([
      { $match: { ...query, timeOnSite: { $gt: 0 } } },
      { $group: { _id: null, avg: { $avg: '$timeOnSite' } } }
    ]);

    // Calculate human visitors count
    // If bots are excluded from query, all uniqueVisitors are humans
    // If bots are included, we need to count humans separately
    let humanVisitorCount = uniqueVisitors.length;
    if (includeBots === 'true') {
      const botVisitorIds = await Visitor.distinct('visitorId', botQuery);
      const humanVisitorIds = uniqueVisitors.filter(id => !botVisitorIds.includes(id));
      humanVisitorCount = humanVisitorIds.length;
    }
    
    // Get recent visitors (include isBot field)
    const recentVisitors = await Visitor.find(query)
      .sort({ lastVisit: -1 })
      .limit(20)
      .select('visitorId device browser os landingPage firstVisit lastVisit visitCount converted isBot')
      .lean();

    const stats = {
      period,
      dateRange: {
        start: startDate.toISOString(),
        end: now.toISOString()
      },
      totals: {
        totalVisitors: uniqueVisitors.length,
        totalVisits: totalVisitors,
        totalUsers,
        botCount: botCount, // Always show bot count
        humanVisitors: humanVisitorCount,
        convertedVisitors,
        conversionRate: `${conversionRate}%`
      },
      breakdown: {
        byDevice: deviceStats,
        byBrowser: browserStats,
        byOS: osStats
      },
      trends: {
        daily: dailyStats
      },
      topLandingPages,
      averageTimeOnSite: avgTimeOnSite[0]?.avg ? Math.round(avgTimeOnSite[0].avg) : 0,
      recentVisitors
    };

    return res.status(200).json(stats);
  } catch (error) {
    console.error('Error fetching visitor stats:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch visitor statistics',
      message: error.message 
    });
  }
}

