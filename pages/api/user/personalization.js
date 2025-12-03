import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import { getPersonalizedRecommendations, identifyWeakAreas } from '@/lib/personalizationService';

/**
 * API endpoint for managing user personalization preferences
 * GET: Get personalization data and recommendations
 * PUT: Update personalization preferences
 */
export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await connectToDatabase();
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (req.method === 'GET') {
      // Get personalization data and recommendations
      const personalization = user.profile?.personalization || {};
      const recommendations = await getPersonalizedRecommendations(session.user.email);

      return res.status(200).json({
        personalization: {
          communicationStyle: personalization.communicationStyle || {},
          topicInterests: personalization.topicInterests || [],
          studyPatterns: personalization.studyPatterns || {},
          interactionPatterns: personalization.interactionPatterns || {},
          learningPreferences: personalization.learningPreferences || {},
          lastAnalyzed: personalization.lastAnalyzed || null
        },
        recommendations,
        statistics: user.statistics || {}
      });
    }

    if (req.method === 'PUT') {
      // Update personalization preferences
      const { 
        communicationStyle, 
        learningPreferences,
        preferences 
      } = req.body;

      if (!user.profile) {
        user.profile = {};
      }
      if (!user.profile.personalization) {
        user.profile.personalization = {
          communicationStyle: {},
          topicInterests: [],
          studyPatterns: {},
          interactionPatterns: {},
          learningPreferences: {},
          recommendations: {}
        };
      }

      // Update communication style preferences
      if (communicationStyle) {
        user.profile.personalization.communicationStyle = {
          ...user.profile.personalization.communicationStyle,
          ...communicationStyle
        };
      }

      // Update learning preferences
      if (learningPreferences) {
        user.profile.personalization.learningPreferences = {
          ...user.profile.personalization.learningPreferences,
          ...learningPreferences
        };
      }

      // Update general preferences
      if (preferences) {
        if (!user.profile.preferences) {
          user.profile.preferences = new Map();
        }
        Object.entries(preferences).forEach(([key, value]) => {
          user.profile.preferences.set(key, value);
        });
      }

      user.profile.personalization.lastAnalyzed = new Date();
      user.profile.lastUpdated = new Date();

      await user.save();

      return res.status(200).json({
        message: 'Personalization preferences updated successfully',
        personalization: user.profile.personalization
      });
    }

    if (req.method === 'POST' && req.body.action === 'analyze') {
      // Trigger analysis of weak areas
      await identifyWeakAreas(session.user.email);
      
      const updatedUser = await User.findOne({ email: session.user.email });
      const recommendations = await getPersonalizedRecommendations(session.user.email);

      return res.status(200).json({
        message: 'Analysis completed',
        recommendations,
        weakAreas: updatedUser.profile?.personalization?.recommendations?.weakAreas || []
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error in personalization API:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

