import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import Chat from '@/models/Chat';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await connectToDatabase();

    if (req.method === 'GET') {
      const user = await User.findOne({ email: session.user.email });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Get chat statistics
      const totalChats = await Chat.countDocuments({ 
        userEmail: session.user.email,
        archived: { $ne: true }
      });

      const totalMessages = await Chat.aggregate([
        { $match: { userEmail: session.user.email } },
        { $project: { messageCount: { $size: '$messages' } } },
        { $group: { _id: null, total: { $sum: '$messageCount' } } }
      ]);

      const messageCount = totalMessages[0]?.total || 0;

      // Get topics from chat names and messages
      const chats = await Chat.find({ 
        userEmail: session.user.email 
      }).select('name messages.text').limit(100);

      const topics = {};
      chats.forEach(chat => {
        const chatName = (chat.name || '').toLowerCase();
        const subjects = ['history', 'polity', 'geography', 'economics', 'science', 'environment', 'current affairs'];
        subjects.forEach(subject => {
          if (chatName.includes(subject)) {
            topics[subject] = (topics[subject] || 0) + 1;
          }
        });
      });

      const topicsArray = Object.entries(topics).map(([topic, count]) => ({
        topic,
        count,
        lastStudied: new Date()
      }));

      // Calculate study streak
      const lastStudyDate = user.statistics?.lastStudyDate 
        ? new Date(user.statistics.lastStudyDate)
        : null;
      
      let studyStreak = user.statistics?.studyStreak || 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (lastStudyDate) {
        const lastDate = new Date(lastStudyDate);
        lastDate.setHours(0, 0, 0, 0);
        const daysDiff = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
        
        if (daysDiff === 0) {
          // Studied today, streak continues
        } else if (daysDiff === 1) {
          // Studied yesterday, increment streak
          studyStreak = (studyStreak || 0) + 1;
        } else {
          // Streak broken
          studyStreak = 1;
        }
      } else {
        studyStreak = 1;
      }

      // Update user statistics
      if (!user.statistics) {
        user.statistics = {};
      }

      user.statistics.totalChats = totalChats;
      user.statistics.totalQuestions = user.memory?.totalQuestions || 0;
      user.statistics.topicsCovered = topicsArray;
      user.statistics.studyStreak = studyStreak;
      user.statistics.lastStudyDate = today;
      
      await user.save();

      return res.status(200).json({
        statistics: {
          totalStudyTime: user.statistics.totalStudyTime || 0,
          totalQuestions: user.statistics.totalQuestions || 0,
          totalChats: totalChats,
          totalMessages: messageCount,
          topicsCovered: topicsArray,
          studyStreak: studyStreak,
          lastStudyDate: user.statistics.lastStudyDate
        }
      });
    }

    if (req.method === 'POST') {
      // Update study time
      const { studyTimeMinutes } = req.body;
      
      if (typeof studyTimeMinutes !== 'number' || studyTimeMinutes < 0) {
        return res.status(400).json({ error: 'Invalid study time' });
      }

      const user = await User.findOne({ email: session.user.email });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (!user.statistics) {
        user.statistics = {};
      }

      user.statistics.totalStudyTime = (user.statistics.totalStudyTime || 0) + studyTimeMinutes;
      user.statistics.lastStudyDate = new Date();
      
      await user.save();

      return res.status(200).json({ 
        success: true,
        totalStudyTime: user.statistics.totalStudyTime
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error handling statistics:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

