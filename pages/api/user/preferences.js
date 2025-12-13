import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';

/**
 * API endpoint for managing user preferences
 * Supports GET, PUT operations for comprehensive user preferences
 */
export default async function handler(req, res) {
    const session = await getServerSession(req, res, authOptions);

    if (!session) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        await connectToDatabase();

        if (req.method === 'GET') {
            // Get all user preferences
            const user = await User.findOne({ email: session.user.email })
                .select('profile.uiPreferences profile.studySchedule profile.notificationPreferences preferences')
                .lean();

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            return res.status(200).json({
                uiPreferences: user.profile?.uiPreferences || {},
                studySchedule: user.profile?.studySchedule || {},
                notificationPreferences: user.profile?.notificationPreferences || {},
                languagePreferences: {
                    language: user.preferences?.language || 'en',
                    model: user.preferences?.model || 'sonar-pro',
                    systemPrompt: user.preferences?.systemPrompt || ''
                }
            });
        }

        if (req.method === 'PUT') {
            // Update user preferences
            const { uiPreferences, studySchedule, notificationPreferences, languagePreferences } = req.body;

            const user = await User.findOne({ email: session.user.email });
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Update UI preferences
            if (uiPreferences) {
                if (!user.profile.uiPreferences) {
                    user.profile.uiPreferences = {};
                }
                Object.assign(user.profile.uiPreferences, uiPreferences);
            }

            // Update study schedule
            if (studySchedule) {
                if (!user.profile.studySchedule) {
                    user.profile.studySchedule = {};
                }
                Object.assign(user.profile.studySchedule, studySchedule);
            }

            // Update notification preferences
            if (notificationPreferences) {
                if (!user.profile.notificationPreferences) {
                    user.profile.notificationPreferences = {};
                }
                Object.assign(user.profile.notificationPreferences, notificationPreferences);
            }

            // Update language preferences
            if (languagePreferences) {
                if (languagePreferences.language) {
                    user.preferences.language = languagePreferences.language;
                }
                if (languagePreferences.model) {
                    user.preferences.model = languagePreferences.model;
                }
                if (languagePreferences.systemPrompt !== undefined) {
                    user.preferences.systemPrompt = languagePreferences.systemPrompt;
                }
            }

            user.profile.lastUpdated = new Date();
            await user.save();

            return res.status(200).json({
                message: 'Preferences updated successfully',
                preferences: {
                    uiPreferences: user.profile.uiPreferences,
                    studySchedule: user.profile.studySchedule,
                    notificationPreferences: user.profile.notificationPreferences,
                    languagePreferences: {
                        language: user.preferences.language,
                        model: user.preferences.model,
                        systemPrompt: user.preferences.systemPrompt
                    }
                }
            });
        }

        if (req.method === 'PATCH') {
            // Partial update for specific preference sections
            const { section, data } = req.body;

            if (!section || !data) {
                return res.status(400).json({ error: 'Section and data are required' });
            }

            const user = await User.findOne({ email: session.user.email });
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            const validSections = ['uiPreferences', 'studySchedule', 'notificationPreferences'];
            if (!validSections.includes(section)) {
                return res.status(400).json({ error: 'Invalid section' });
            }

            if (!user.profile[section]) {
                user.profile[section] = {};
            }

            Object.assign(user.profile[section], data);
            user.profile.lastUpdated = new Date();
            await user.save();

            return res.status(200).json({
                message: `${section} updated successfully`,
                [section]: user.profile[section]
            });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Preferences API error:', error);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
}
