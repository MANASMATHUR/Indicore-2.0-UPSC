import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';

/**
 * ChatGPT-Style Memory API
 * Allows users to explicitly save and recall information
 * 
 * Examples:
 * - "Remember that my UPSC goal is to become an IPS officer"
 * - "Save to memory: I prefer studying in the morning"
 * - "Note that my optional subject is Geography"
 */
export default async function handler(req, res) {
    const session = await getServerSession(req, res, authOptions);

    if (!session) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        await connectToDatabase();

        if (req.method === 'GET') {
            // Get all saved memories
            const user = await User.findOne({ email: session.user.email })
                .select('profile.memories profile.customInfo')
                .lean();

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            const memories = user.profile?.memories || [];

            return res.status(200).json({
                memories,
                totalMemories: memories.length
            });
        }

        if (req.method === 'POST') {
            // Save a new memory
            const { memory, category, importance } = req.body;

            if (!memory || typeof memory !== 'string' || memory.trim().length === 0) {
                return res.status(400).json({ error: 'Memory content is required' });
            }

            const user = await User.findOne({ email: session.user.email });
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Initialize memories array if it doesn't exist
            if (!user.profile.memories) {
                user.profile.memories = [];
            }

            // Check for duplicates (similar content)
            const isDuplicate = user.profile.memories.some(m =>
                m.content.toLowerCase().trim() === memory.toLowerCase().trim()
            );

            if (isDuplicate) {
                return res.status(409).json({
                    error: 'This information is already saved in your memory',
                    duplicate: true
                });
            }

            // Create new memory entry
            const newMemory = {
                content: memory.trim(),
                category: category || detectCategory(memory),
                importance: importance || 'normal', // 'high', 'normal', 'low'
                savedAt: new Date(),
                lastUsed: new Date(),
                useCount: 0
            };

            user.profile.memories.push(newMemory);
            user.profile.lastUpdated = new Date();
            await user.save();

            return res.status(201).json({
                message: '✅ Saved to memory!',
                memory: newMemory,
                totalMemories: user.profile.memories.length
            });
        }

        if (req.method === 'PUT') {
            // Update a memory (mark as used, update content, etc.)
            const { memoryId, updates } = req.body;

            if (!memoryId) {
                return res.status(400).json({ error: 'Memory ID is required' });
            }

            const user = await User.findOne({ email: session.user.email });
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            const memoryIndex = user.profile.memories?.findIndex(
                m => m._id.toString() === memoryId
            );

            if (memoryIndex < 0) {
                return res.status(404).json({ error: 'Memory not found' });
            }

            const memory = user.profile.memories[memoryIndex];

            // Update fields
            if (updates.content) memory.content = updates.content;
            if (updates.category) memory.category = updates.category;
            if (updates.importance) memory.importance = updates.importance;

            // Track usage
            if (updates.markAsUsed) {
                memory.lastUsed = new Date();
                memory.useCount = (memory.useCount || 0) + 1;
            }

            user.profile.lastUpdated = new Date();
            await user.save();

            return res.status(200).json({
                message: 'Memory updated',
                memory
            });
        }

        if (req.method === 'DELETE') {
            // Delete a specific memory or clear all
            const { memoryId, clearAll } = req.body;

            const user = await User.findOne({ email: session.user.email });
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            if (clearAll) {
                // Clear all memories
                user.profile.memories = [];
                await user.save();
                return res.status(200).json({
                    message: 'All memories cleared'
                });
            }

            if (!memoryId) {
                return res.status(400).json({ error: 'Memory ID is required' });
            }

            // Delete specific memory
            const initialLength = user.profile.memories?.length || 0;
            user.profile.memories = user.profile.memories.filter(
                m => m._id.toString() !== memoryId
            );

            if (user.profile.memories.length === initialLength) {
                return res.status(404).json({ error: 'Memory not found' });
            }

            user.profile.lastUpdated = new Date();
            await user.save();

            return res.status(200).json({
                message: 'Memory deleted',
                remainingMemories: user.profile.memories.length
            });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Memory API error:', error);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
}

/**
 * Automatically detect category based on memory content
 */
function detectCategory(memory) {
    const lowerMemory = memory.toLowerCase();

    // Goal-related
    if (/goal|aim|target|aspire|want to become|dream/.test(lowerMemory)) {
        return 'goal';
    }

    // Study-related
    if (/study|read|learn|prepare|practice|revision/.test(lowerMemory)) {
        return 'study_habit';
    }

    // Exam-related
    if (/exam|test|upsc|pcs|ssc|interview|prelims|mains/.test(lowerMemory)) {
        return 'exam';
    }

    // Preference-related
    if (/prefer|like|dislike|hate|love|favorite|enjoy/.test(lowerMemory)) {
        return 'preference';
    }

    // Subject-related
    if (/subject|topic|optional|weak|strong|good at|difficult/.test(lowerMemory)) {
        return 'subject';
    }

    // Personal info
    if (/name|university|college|degree|cgpa|background/.test(lowerMemory)) {
        return 'personal';
    }

    return 'general';
}
