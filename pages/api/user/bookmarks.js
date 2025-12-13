import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';

/**
 * API endpoint for managing bookmarks and saved content
 * Supports PYQs, chat messages, flashcards, essays, and current affairs
 */
export default async function handler(req, res) {
    const session = await getServerSession(req, res, authOptions);

    if (!session) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        await connectToDatabase();

        if (req.method === 'GET') {
            // Get all bookmarks or filter by type
            const { type } = req.query;

            const user = await User.findOne({ email: session.user.email })
                .select('profile.savedContent')
                .lean();

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            const savedContent = user.profile?.savedContent || {
                pyqs: [],
                chatMessages: [],
                flashcards: [],
                essays: [],
                currentAffairs: []
            };

            if (type && savedContent[type]) {
                return res.status(200).json({ [type]: savedContent[type] });
            }

            return res.status(200).json(savedContent);
        }

        if (req.method === 'POST') {
            // Add a new bookmark
            const { type, item } = req.body;

            if (!type || !item) {
                return res.status(400).json({ error: 'Type and item data are required' });
            }

            const validTypes = ['pyqs', 'chatMessages', 'flashcards', 'essays', 'currentAffairs'];
            if (!validTypes.includes(type)) {
                return res.status(400).json({ error: 'Invalid bookmark type' });
            }

            const user = await User.findOne({ email: session.user.email });
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            if (!user.profile.savedContent) {
                user.profile.savedContent = {
                    pyqs: [],
                    chatMessages: [],
                    flashcards: [],
                    essays: [],
                    currentAffairs: []
                };
            }

            const bookmark = {
                ...item,
                savedAt: new Date()
            };

            // Avoid duplicates based on type-specific IDs
            let isDuplicate = false;
            if (type === 'pyqs' && item.questionId) {
                isDuplicate = user.profile.savedContent.pyqs.some(b => b.questionId === item.questionId);
            } else if (type === 'chatMessages' && item.messageId) {
                isDuplicate = user.profile.savedContent.chatMessages.some(b => b.messageId === item.messageId);
            } else if (type === 'flashcards' && item.flashcardId) {
                isDuplicate = user.profile.savedContent.flashcards.some(b => b.flashcardId === item.flashcardId);
            } else if (type === 'essays' && item.essayId) {
                isDuplicate = user.profile.savedContent.essays.some(b => b.essayId === item.essayId);
            } else if (type === 'currentAffairs' && item.articleId) {
                isDuplicate = user.profile.savedContent.currentAffairs.some(b => b.articleId === item.articleId);
            }

            if (isDuplicate) {
                return res.status(409).json({ error: 'Item already bookmarked' });
            }

            user.profile.savedContent[type].push(bookmark);
            user.profile.lastUpdated = new Date();
            await user.save();

            return res.status(201).json({
                message: 'Bookmark added successfully',
                bookmark,
                totalBookmarks: user.profile.savedContent[type].length
            });
        }

        if (req.method === 'PUT') {
            // Update a bookmark (e.g., add tags or notes)
            const { type, itemId, updates } = req.body;

            if (!type || !itemId || !updates) {
                return res.status(400).json({ error: 'Type, itemId, and updates are required' });
            }

            const user = await User.findOne({ email: session.user.email });
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            if (!user.profile.savedContent || !user.profile.savedContent[type]) {
                return res.status(404).json({ error: 'Bookmarks not found' });
            }

            let bookmarkIndex = -1;
            if (type === 'pyqs') {
                bookmarkIndex = user.profile.savedContent.pyqs.findIndex(b => b.questionId === itemId);
            } else if (type === 'chatMessages') {
                bookmarkIndex = user.profile.savedContent.chatMessages.findIndex(b => b.messageId === itemId);
            } else if (type === 'flashcards') {
                bookmarkIndex = user.profile.savedContent.flashcards.findIndex(b => b.flashcardId === itemId);
            } else if (type === 'essays') {
                bookmarkIndex = user.profile.savedContent.essays.findIndex(b => b.essayId === itemId);
            } else if (type === 'currentAffairs') {
                bookmarkIndex = user.profile.savedContent.currentAffairs.findIndex(b => b.articleId === itemId);
            }

            if (bookmarkIndex < 0) {
                return res.status(404).json({ error: 'Bookmark not found' });
            }

            const bookmark = user.profile.savedContent[type][bookmarkIndex];

            // Update allowed fields
            if (updates.tags) bookmark.tags = updates.tags;
            if (updates.notes !== undefined) bookmark.notes = updates.notes;

            user.profile.lastUpdated = new Date();
            await user.save();

            return res.status(200).json({
                message: 'Bookmark updated successfully',
                bookmark
            });
        }

        if (req.method === 'DELETE') {
            // Remove a bookmark
            const { type, itemId } = req.body;

            if (!type || !itemId) {
                return res.status(400).json({ error: 'Type and itemId are required' });
            }

            const user = await User.findOne({ email: session.user.email });
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            if (!user.profile.savedContent || !user.profile.savedContent[type]) {
                return res.status(404).json({ error: 'Bookmarks not found' });
            }

            let initialLength = user.profile.savedContent[type].length;

            if (type === 'pyqs') {
                user.profile.savedContent.pyqs = user.profile.savedContent.pyqs.filter(b => b.questionId !== itemId);
            } else if (type === 'chatMessages') {
                user.profile.savedContent.chatMessages = user.profile.savedContent.chatMessages.filter(b => b.messageId !== itemId);
            } else if (type === 'flashcards') {
                user.profile.savedContent.flashcards = user.profile.savedContent.flashcards.filter(b => b.flashcardId !== itemId);
            } else if (type === 'essays') {
                user.profile.savedContent.essays = user.profile.savedContent.essays.filter(b => b.essayId !== itemId);
            } else if (type === 'currentAffairs') {
                user.profile.savedContent.currentAffairs = user.profile.savedContent.currentAffairs.filter(b => b.articleId !== itemId);
            }

            if (user.profile.savedContent[type].length === initialLength) {
                return res.status(404).json({ error: 'Bookmark not found' });
            }

            user.profile.lastUpdated = new Date();
            await user.save();

            return res.status(200).json({
                message: 'Bookmark removed successfully',
                remainingBookmarks: user.profile.savedContent[type].length
            });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Bookmarks API error:', error);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
}
