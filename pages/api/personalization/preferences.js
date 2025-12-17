import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';

/**
 * Update user preferences
 * POST /api/personalization/preferences
 */
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        await connectToDatabase();

        // Get session
        const session = await getServerSession(req, res, authOptions);

        if (!session?.user?.email) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Please login to update preferences'
            });
        }

        const {
            communicationStyle,
            learningPreferences,
            uiPreferences,
            studySchedule,
            notificationPreferences
        } = req.body;

        // Get user
        const user = await User.findOne({ email: session.user.email });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Update preferences
        if (communicationStyle) {
            user.profile.personalization.communicationStyle = {
                ...user.profile.personalization.communicationStyle,
                ...communicationStyle
            };
        }

        if (learningPreferences) {
            user.profile.personalization.learningPreferences = {
                ...user.profile.personalization.learningPreferences,
                ...learningPreferences
            };
        }

        if (uiPreferences) {
            user.profile.uiPreferences = {
                ...user.profile.uiPreferences,
                ...uiPreferences
            };
        }

        if (studySchedule) {
            user.profile.studySchedule = {
                ...user.profile.studySchedule,
                ...studySchedule
            };
        }

        if (notificationPreferences) {
            user.profile.notificationPreferences = {
                ...user.profile.notificationPreferences,
                ...notificationPreferences
            };
        }

        // Update last analyzed timestamp
        user.profile.personalization.lastAnalyzed = new Date();

        await user.save();

        return res.status(200).json({
            success: true,
            message: 'Preferences updated successfully',
            preferences: {
                communicationStyle: user.profile.personalization.communicationStyle,
                learningPreferences: user.profile.personalization.learningPreferences,
                uiPreferences: user.profile.uiPreferences,
                studySchedule: user.profile.studySchedule,
                notificationPreferences: user.profile.notificationPreferences
            }
        });

    } catch (error) {
        console.error('Error in preferences endpoint:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}
