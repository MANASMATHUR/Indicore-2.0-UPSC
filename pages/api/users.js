import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import Chat from '@/models/Chat';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await connectToDatabase();

    // Get all users with their chat statistics
    const users = await User.find({})
      .select('name email picture lastLogin preferences memory createdAt')
      .sort({ lastLogin: -1 })
      .lean();

    // Get chat statistics for each user
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const chatCount = await Chat.countDocuments({ 
          userEmail: user.email, 
          isActive: true 
        });
        
        const totalMessages = await Chat.aggregate([
          { $match: { userEmail: user.email, isActive: true } },
          { $project: { messageCount: { $size: '$messages' } } },
          { $group: { _id: null, total: { $sum: '$messageCount' } } }
        ]);

        return {
          ...user,
          chatCount,
          totalMessages: totalMessages[0]?.total || 0,
          lastActive: user.lastLogin
        };
      })
    );

    // Get overall statistics
    const totalUsers = users.length;
    const totalChats = await Chat.countDocuments({ isActive: true });
    const totalMessages = await Chat.aggregate([
      { $match: { isActive: true } },
      { $project: { messageCount: { $size: '$messages' } } },
      { $group: { _id: null, total: { $sum: '$messageCount' } } }
    ]);

    const stats = {
      totalUsers,
      totalChats,
      totalMessages: totalMessages[0]?.total || 0,
      averageChatsPerUser: totalUsers > 0 ? (totalChats / totalUsers).toFixed(2) : 0,
      averageMessagesPerUser: totalUsers > 0 ? ((totalMessages[0]?.total || 0) / totalUsers).toFixed(2) : 0
    };

    return res.status(200).json({
      users: usersWithStats,
      stats,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    return res.status(500).json({ 
      error: 'Failed to fetch user data',
      message: error.message 
    });
  }
}
