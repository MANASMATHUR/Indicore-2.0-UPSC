const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
    userEmail: { type: String, required: true },
    name: { type: String }, // Chat name
    messages: [
        {
            sender: { type: String, enum: ['user', 'assistant', 'ai'], required: true },
            text: { type: String, required: true },
            language: { type: String, default: 'en' }, // store message language
            timestamp: { type: Date, default: Date.now }
        }
    ]
}, { timestamps: true });

module.exports = mongoose.model('Chat', chatSchema);
