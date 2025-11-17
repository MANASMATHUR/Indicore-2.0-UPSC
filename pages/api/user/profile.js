import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import { updateUserProfile, formatProfileContext } from '@/lib/userProfileExtractor';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await connectToDatabase();

    if (req.method === 'GET') {
      const user = await User.findOne({ email: session.user.email })
        .select('profile name email')
        .lean();

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.status(200).json({
        profile: user.profile || {},
        name: user.name,
        email: user.email
      });
    }

    if (req.method === 'PUT') {
      const { profile } = req.body;

      if (!profile || typeof profile !== 'object') {
        return res.status(400).json({ error: 'Profile data is required' });
      }

      const user = await User.findOne({ email: session.user.email });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const updatedProfile = updateUserProfile(user, profile);
      user.profile = updatedProfile;
      await user.save();

      return res.status(200).json({
        success: true,
        profile: updatedProfile,
        message: 'Profile updated successfully'
      });
    }
  } catch (error) {
    console.error('Error handling user profile:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

