const Chat = require('../models/Chat');
const User = require('../models/User');

let isDbReady = false;

// In-memory fallback stores
const usersByEmail = new Map();
const chats = []; // array of { _id, userEmail, name, messages, createdAt }
let nextId = 1;

function generateId() {
    return String(nextId++);
}

function setDbReady(ready) {
    isDbReady = !!ready;
}

async function findOrCreateUserByEmail(email, data = {}) {
    const defaultAvatar = '/static/default-avatar.jpg'; // public folder

    if (isDbReady) {
        let user = await User.findOne({ email });
        if (!user) {
            user = new User({ email, avatar: defaultAvatar, ...data });
            await user.save();
        }
        const obj = user.toObject();
        obj.avatar = obj.avatar || defaultAvatar;
        return obj;
    }

    if (!usersByEmail.has(email)) {
        usersByEmail.set(email, { _id: generateId(), email, avatar: defaultAvatar, ...data });
    }
    return usersByEmail.get(email);
}

async function listChatsByEmail(email) {
    if (isDbReady) {
        const dbChats = await Chat.find({ userEmail: email }).sort({ createdAt: -1 });
        return dbChats.map(c => {
            const obj = c.toObject();
            obj.messages = obj.messages || [];
            obj.createdAt = obj.createdAt?.toISOString?.() || obj.createdAt;
            return obj;
        });
    }

    return chats
        .filter(c => c.userEmail === email)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map(c => ({ ...c, messages: c.messages || [] }));
}

async function createChatForEmail(email, name = 'New Chat') {
    const chatName = name || `Chat ${chats.length + 1}`;
    if (isDbReady) {
        const newChat = new Chat({ userEmail: email, name: chatName, messages: [], createdAt: new Date() });
        await newChat.save();
        const obj = newChat.toObject();
        obj.messages = obj.messages || [];
        obj.createdAt = obj.createdAt?.toISOString?.() || obj.createdAt;
        return obj;
    }

    const chat = { 
        _id: generateId(), 
        userEmail: email, 
        name: chatName, 
        messages: [], 
        createdAt: new Date().toISOString() 
    };
    chats.push(chat);
    return chat;
}

async function getChatById(id) {
    if (isDbReady) {
        const chat = await Chat.findById(id);
        if (!chat) return null;
        const obj = chat.toObject();
        obj.messages = obj.messages || [];
        obj.createdAt = obj.createdAt?.toISOString?.() || obj.createdAt;
        return obj;
    }

    const chat = chats.find(c => c._id === id);
    if (!chat) return null;
    chat.messages = chat.messages || [];
    return chat;
}

async function addMessageToChat(id, message) {
    const msgWithMeta = {
        ...message,
        language: message.language || 'en', // ensure language is stored
        timestamp: message.timestamp || new Date().toISOString()
    };

    if (isDbReady) {
        const chat = await Chat.findById(id);
        if (!chat) return null;
        chat.messages.push(msgWithMeta);
        await chat.save();
        const obj = chat.toObject();
        obj.messages = obj.messages || [];
        obj.createdAt = obj.createdAt?.toISOString?.() || obj.createdAt;
        return obj;
    }

    const chat = chats.find(c => c._id === id);
    if (!chat) return null;
    chat.messages.push(msgWithMeta);
    return chat;
}

module.exports = {
    setDbReady,
    findOrCreateUserByEmail,
    listChatsByEmail,
    createChatForEmail,
    getChatById,
    addMessageToChat,
};
