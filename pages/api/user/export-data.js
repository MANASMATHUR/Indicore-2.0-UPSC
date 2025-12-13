import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import Chat from '@/models/Chat';

/**
 * API endpoint for exporting user data (GDPR compliance)
 * Allows users to download all their data in JSON format
 */
export default async function handler(req, res) {
    const session = await getServerSession(req, res, authOptions);

    if (!session) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        await connectToDatabase();

        if (req.method === 'GET') {
            const { format = 'json' } = req.query;

            // Fetch all user data
            const user = await User.findOne({ email: session.user.email }).lean();
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Fetch all chats
            const chats = await Chat.find({ userEmail: session.user.email }).lean();

            // Prepare export data
            const exportData = {
                exportedAt: new Date().toISOString(),
                exportFormat: format,
                userData: {
                    // Basic info
                    name: user.name,
                    email: user.email,
                    picture: user.picture,
                    lastLogin: user.lastLogin,
                    accountCreated: user.createdAt,

                    // Preferences
                    preferences: user.preferences,
                    uiPreferences: user.profile?.uiPreferences,
                    studySchedule: user.profile?.studySchedule,
                    notificationPreferences: user.profile?.notificationPreferences,

                    // Profile data
                    personalInfo: {
                        cgpa: user.profile?.cgpa,
                        university: user.profile?.university,
                        degree: user.profile?.degree,
                        year: user.profile?.year,
                        targetExam: user.profile?.targetExam,
                        examYear: user.profile?.examYear
                    },

                    // Learning data
                    learningPath: user.profile?.learningPath,
                    personalization: user.profile?.personalization,
                    performanceMetrics: user.profile?.performanceMetrics,

                    // Goals and achievements
                    goals: user.profile?.goals,

                    // Saved content
                    savedContent: user.profile?.savedContent,

                    // Statistics
                    statistics: user.statistics,

                    // Privacy settings
                    privacySettings: user.profile?.privacySettings
                },

                chatData: {
                    totalChats: chats.length,
                    chats: chats.map(chat => ({
                        chatId: chat._id,
                        title: chat.title,
                        createdAt: chat.createdAt,
                        lastMessageAt: chat.lastMessageAt,
                        messageCount: chat.messages?.length || 0,
                        messages: chat.messages || []
                    }))
                },

                metadata: {
                    totalDataPoints: calculateDataPoints(user, chats),
                    categories: [
                        'preferences',
                        'learning_path',
                        'performance',
                        'goals',
                        'bookmarks',
                        'chat_history',
                        'statistics'
                    ]
                }
            };

            // Update last export timestamp
            await User.updateOne(
                { email: session.user.email },
                {
                    $set: {
                        'profile.privacySettings.lastExportedAt': new Date()
                    }
                }
            );

            if (format === 'json') {
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Content-Disposition', `attachment; filename="indicore-data-export-${Date.now()}.json"`);
                return res.status(200).json(exportData);
            }

            return res.status(400).json({ error: 'Unsupported format. Only JSON is currently supported.' });
        }

        if (req.method === 'DELETE') {
            // Request account deletion
            const user = await User.findOne({ email: session.user.email });
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Mark account for deletion (don't immediately delete, give grace period)
            if (!user.profile.privacySettings) {
                user.profile.privacySettings = {};
            }

            user.profile.privacySettings.accountDeletionRequested = true;
            user.profile.privacySettings.deletionRequestedAt = new Date();
            await user.save();

            return res.status(200).json({
                message: 'Account deletion requested. Your account will be deleted in 30 days. You can cancel this request by logging in again.',
                deletionDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            });
        }

        if (req.method === 'POST') {
            // Cancel account deletion request
            const user = await User.findOne({ email: session.user.email });
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            if (user.profile.privacySettings?.accountDeletionRequested) {
                user.profile.privacySettings.accountDeletionRequested = false;
                user.profile.privacySettings.deletionRequestedAt = null;
                await user.save();

                return res.status(200).json({
                    message: 'Account deletion request cancelled successfully'
                });
            }

            return res.status(400).json({ error: 'No deletion request found' });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Data export API error:', error);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
}

function calculateDataPoints(user, chats) {
    let count = 0;

    // Profile fields
    count += Object.keys(user.profile || {}).length;
    count += Object.keys(user.preferences || {}).length;
    count += Object.keys(user.statistics || {}).length;

    // Learning path
    count += (user.profile?.learningPath?.currentTopics?.length || 0);
    count += (user.profile?.learningPath?.completedTopics?.length || 0);
    count += (user.profile?.learningPath?.plannedTopics?.length || 0);

    // Goals
    count += (user.profile?.goals?.shortTerm?.length || 0);
    count += (user.profile?.goals?.longTerm?.length || 0);
    count += (user.profile?.goals?.achievements?.length || 0);

    // Saved content
    count += (user.profile?.savedContent?.pyqs?.length || 0);
    count += (user.profile?.savedContent?.chatMessages?.length || 0);
    count += (user.profile?.savedContent?.flashcards?.length || 0);
    count += (user.profile?.savedContent?.essays?.length || 0);
    count += (user.profile?.savedContent?.currentAffairs?.length || 0);

    // Chats and messages
    count += chats.length;
    chats.forEach(chat => {
        count += (chat.messages?.length || 0);
    });

    return count;
}
