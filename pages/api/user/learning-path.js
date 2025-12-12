import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';

/**
 * API endpoint for managing user learning path
 * Tracks current topics, completed topics, and planned topics
 */
export default async function handler(req, res) {
    const session = await getServerSession(req, res, authOptions);

    if (!session) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        await connectToDatabase();

        if (req.method === 'GET') {
            // Get learning path data
            const user = await User.findOne({ email: session.user.email })
                .select('profile.learningPath')
                .lean();

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            const learningPath = user.profile?.learningPath || {
                currentTopics: [],
                completedTopics: [],
                plannedTopics: []
            };

            return res.status(200).json(learningPath);
        }

        if (req.method === 'POST') {
            // Add a new topic to current or planned topics
            const { action, topic } = req.body;

            if (!action || !topic) {
                return res.status(400).json({ error: 'Action and topic are required' });
            }

            const user = await User.findOne({ email: session.user.email });
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            if (!user.profile.learningPath) {
                user.profile.learningPath = {
                    currentTopics: [],
                    completedTopics: [],
                    plannedTopics: []
                };
            }

            if (action === 'start') {
                // Start a new topic
                const newTopic = {
                    subject: topic.subject,
                    topic: topic.topic,
                    startedAt: new Date(),
                    lastStudied: new Date(),
                    completionPercentage: 0,
                    status: 'in_progress'
                };

                // Remove from planned if exists
                user.profile.learningPath.plannedTopics = user.profile.learningPath.plannedTopics.filter(
                    t => !(t.subject === topic.subject && t.topic === topic.topic)
                );

                // Check if already in current topics
                const existingIndex = user.profile.learningPath.currentTopics.findIndex(
                    t => t.subject === topic.subject && t.topic === topic.topic
                );

                if (existingIndex >= 0) {
                    user.profile.learningPath.currentTopics[existingIndex].lastStudied = new Date();
                } else {
                    user.profile.learningPath.currentTopics.push(newTopic);
                }
            } else if (action === 'plan') {
                // Add to planned topics
                const plannedTopic = {
                    subject: topic.subject,
                    topic: topic.topic,
                    priority: topic.priority || 1,
                    targetDate: topic.targetDate ? new Date(topic.targetDate) : null
                };

                // Check if already planned
                const exists = user.profile.learningPath.plannedTopics.some(
                    t => t.subject === topic.subject && t.topic === topic.topic
                );

                if (!exists) {
                    user.profile.learningPath.plannedTopics.push(plannedTopic);
                }
            }

            user.profile.lastUpdated = new Date();
            await user.save();

            return res.status(200).json({
                message: `Topic ${action === 'start' ? 'started' : 'planned'} successfully`,
                learningPath: user.profile.learningPath
            });
        }

        if (req.method === 'PUT') {
            // Update topic progress or status
            const { subject, topic, updates } = req.body;

            if (!subject || !topic || !updates) {
                return res.status(400).json({ error: 'Subject, topic, and updates are required' });
            }

            const user = await User.findOne({ email: session.user.email });
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            if (!user.profile.learningPath) {
                return res.status(404).json({ error: 'Learning path not found' });
            }

            const topicIndex = user.profile.learningPath.currentTopics.findIndex(
                t => t.subject === subject && t.topic === topic
            );

            if (topicIndex < 0) {
                return res.status(404).json({ error: 'Topic not found in current topics' });
            }

            const currentTopic = user.profile.learningPath.currentTopics[topicIndex];

            // Update fields
            if (updates.completionPercentage !== undefined) {
                currentTopic.completionPercentage = Math.min(100, Math.max(0, updates.completionPercentage));
            }
            if (updates.status) {
                currentTopic.status = updates.status;
            }
            currentTopic.lastStudied = new Date();

            // If completed, move to completed topics
            if (updates.status === 'completed' || currentTopic.completionPercentage === 100) {
                user.profile.learningPath.completedTopics.push({
                    subject: currentTopic.subject,
                    topic: currentTopic.topic,
                    completedAt: new Date(),
                    masteryLevel: updates.masteryLevel || 'basic'
                });

                user.profile.learningPath.currentTopics.splice(topicIndex, 1);
            }

            user.profile.lastUpdated = new Date();
            await user.save();

            return res.status(200).json({
                message: 'Topic updated successfully',
                learningPath: user.profile.learningPath
            });
        }

        if (req.method === 'DELETE') {
            // Remove a topic from current or planned
            const { subject, topic, from } = req.body;

            if (!subject || !topic || !from) {
                return res.status(400).json({ error: 'Subject, topic, and from are required' });
            }

            const user = await User.findOne({ email: session.user.email });
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            if (!user.profile.learningPath) {
                return res.status(404).json({ error: 'Learning path not found' });
            }

            if (from === 'current') {
                user.profile.learningPath.currentTopics = user.profile.learningPath.currentTopics.filter(
                    t => !(t.subject === subject && t.topic === topic)
                );
            } else if (from === 'planned') {
                user.profile.learningPath.plannedTopics = user.profile.learningPath.plannedTopics.filter(
                    t => !(t.subject === subject && t.topic === topic)
                );
            } else {
                return res.status(400).json({ error: 'Invalid "from" parameter' });
            }

            user.profile.lastUpdated = new Date();
            await user.save();

            return res.status(200).json({
                message: 'Topic removed successfully',
                learningPath: user.profile.learningPath
            });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Learning path API error:', error);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
}
