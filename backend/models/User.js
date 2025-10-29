const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  picture: String,
  lastLogin: { type: Date, default: Date.now },
  preferences: {
    language: { type: String, default: 'en' },
    model: { type: String, default: 'sonar-pro' },
    systemPrompt: {
      type: String,
      default:
        'You are a helpful Multilingual AI assistant. Your name is Indicore-Ai. Provide accurate, detailed, and well-structured responses.',
    },
  },
  memory: {
    totalQuestions: { type: Number, default: 0 },
    sessionQuestions: { type: Number, default: 0 },
    lastSessionStart: { type: Date, default: Date.now },
  },
}, { timestamps: true });

userSchema.index({ email: 1 });
userSchema.index({ googleId: 1 });

module.exports = mongoose.models.User || mongoose.model('User', userSchema);


