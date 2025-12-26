import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  sender: {
    type: String,
    enum: ['user', 'assistant'],
    required: true
  },
  text: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  metadata: {
    model: String,
    language: String,
    tokens: Number,
    bookmarked: {
      type: Boolean,
      default: false
    },
    editedAt: Date
  },
  bookmarked: {
    type: Boolean,
    default: false
  },
  truthAnchored: {
    type: Boolean,
    default: false
  }
});

const chatSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userEmail: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  messages: [messageSchema],
  settings: {
    language: {
      type: String,
      default: 'en'
    },
    model: {
      type: String,
      default: 'sonar-pro'
    },
    systemPrompt: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  pinned: {
    type: Boolean,
    default: false
  },
  folder: {
    type: String,
    default: null
  },
  tags: [{
    type: String
  }],
  archived: {
    type: Boolean,
    default: false
  },
  lastMessageAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

chatSchema.index({ userId: 1, createdAt: -1 });
chatSchema.index({ userEmail: 1, createdAt: -1 });
chatSchema.index({ lastMessageAt: -1 });
chatSchema.index({ userEmail: 1, archived: 1, lastMessageAt: -1 });
chatSchema.index({ userEmail: 1, folder: 1, lastMessageAt: -1 });
chatSchema.index({ userEmail: 1, tags: 1, lastMessageAt: -1 });

chatSchema.pre('save', function (next) {
  if (this.messages && this.messages.length > 0) {
    this.lastMessageAt = this.messages[this.messages.length - 1].timestamp;
  }
  next();
});

export default mongoose.models.Chat || mongoose.model('Chat', chatSchema);
