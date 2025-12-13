import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';

/**
 * API endpoint for managing user goals, milestones, and achievements
 */
export default async function handler(req, res) {
    const session = await getServerSession(req, res, authOptions);

    if (!session) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        await connectToDatabase();

        if (req.method === 'GET') {
            // Get all goals and achievements
            const user = await User.findOne({ email: session.user.email })
                .select('profile.goals')
                .lean();

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            const goals = user.profile?.goals || {
                shortTerm: [],
                longTerm: [],
                achievements: []
            };

            return res.status(200).json(goals);
        }

        if (req.method === 'POST') {
            // Create a new goal
            const { type, goal } = req.body;

            if (!type || !goal) {
                return res.status(400).json({ error: 'Type and goal data are required' });
            }

            if (!['shortTerm', 'longTerm'].includes(type)) {
                return res.status(400).json({ error: 'Invalid goal type' });
            }

            const user = await User.findOne({ email: session.user.email });
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            if (!user.profile.goals) {
                user.profile.goals = {
                    shortTerm: [],
                    longTerm: [],
                    achievements: []
                };
            }

            const newGoal = {
                title: goal.title,
                description: goal.description || '',
                targetDate: goal.targetDate ? new Date(goal.targetDate) : null,
                completed: false,
                progress: 0,
                ...(type === 'shortTerm' && { category: goal.category || 'daily' }),
                ...(type === 'longTerm' && { milestones: goal.milestones || [] })
            };

            user.profile.goals[type].push(newGoal);
            user.profile.lastUpdated = new Date();
            await user.save();

            return res.status(201).json({
                message: 'Goal created successfully',
                goal: newGoal,
                goals: user.profile.goals
            });
        }

        if (req.method === 'PUT') {
            // Update an existing goal
            const { type, goalIndex, updates } = req.body;

            if (!type || goalIndex === undefined || !updates) {
                return res.status(400).json({ error: 'Type, goalIndex, and updates are required' });
            }

            const user = await User.findOne({ email: session.user.email });
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            if (!user.profile.goals || !user.profile.goals[type]) {
                return res.status(404).json({ error: 'Goals not found' });
            }

            if (goalIndex < 0 || goalIndex >= user.profile.goals[type].length) {
                return res.status(404).json({ error: 'Goal not found' });
            }

            const goal = user.profile.goals[type][goalIndex];

            // Update fields
            if (updates.title) goal.title = updates.title;
            if (updates.description !== undefined) goal.description = updates.description;
            if (updates.targetDate) goal.targetDate = new Date(updates.targetDate);
            if (updates.progress !== undefined) {
                goal.progress = Math.min(100, Math.max(0, updates.progress));
            }
            if (updates.completed !== undefined) {
                goal.completed = updates.completed;
                if (updates.completed) {
                    goal.completedAt = new Date();

                    // Award achievement
                    const achievement = {
                        title: `Completed: ${goal.title}`,
                        description: goal.description,
                        icon: type === 'shortTerm' ? '🎯' : '🏆',
                        earnedAt: new Date(),
                        category: type
                    };
                    user.profile.goals.achievements.push(achievement);
                }
            }
            if (type === 'longTerm' && updates.milestones) {
                goal.milestones = updates.milestones;
            }

            user.profile.lastUpdated = new Date();
            await user.save();

            return res.status(200).json({
                message: 'Goal updated successfully',
                goal,
                goals: user.profile.goals
            });
        }

        if (req.method === 'DELETE') {
            // Delete a goal
            const { type, goalIndex } = req.body;

            if (!type || goalIndex === undefined) {
                return res.status(400).json({ error: 'Type and goalIndex are required' });
            }

            const user = await User.findOne({ email: session.user.email });
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            if (!user.profile.goals || !user.profile.goals[type]) {
                return res.status(404).json({ error: 'Goals not found' });
            }

            if (goalIndex < 0 || goalIndex >= user.profile.goals[type].length) {
                return res.status(404).json({ error: 'Goal not found' });
            }

            user.profile.goals[type].splice(goalIndex, 1);
            user.profile.lastUpdated = new Date();
            await user.save();

            return res.status(200).json({
                message: 'Goal deleted successfully',
                goals: user.profile.goals
            });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Goals API error:', error);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
}
