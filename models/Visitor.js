import mongoose from 'mongoose';

const visitorSchema = new mongoose.Schema({
  // Unique identifier for the visitor (fingerprint)
  visitorId: {
    type: String,
    required: true,
    index: true
  },
  // IP address (hashed for privacy)
  ipHash: {
    type: String,
    index: true
  },
  // User agent
  userAgent: String,
  // Device info
  device: {
    type: String,
    enum: ['desktop', 'mobile', 'tablet', 'unknown'],
    default: 'unknown'
  },
  // Browser
  browser: String,
  // Operating system
  os: String,
  // Screen resolution
  screen: String,
  // Referrer URL
  referrer: String,
  // Landing page
  landingPage: String,
  // Current page
  currentPage: String,
  // Country (from IP geolocation)
  country: String,
  // City (from IP geolocation)
  city: String,
  // Is this a bot?
  isBot: {
    type: Boolean,
    default: false,
    index: true
  },
  // Session ID (for tracking multiple page views in same session)
  sessionId: {
    type: String,
    index: true
  },
  // Page views in this session
  pageViews: {
    type: Number,
    default: 1
  },
  // Has this visitor converted to a user?
  converted: {
    type: Boolean,
    default: false,
    index: true
  },
  // User ID if converted
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  // User email if converted
  userEmail: String,
  // Conversion date
  convertedAt: Date,
  // First visit timestamp
  firstVisit: {
    type: Date,
    default: Date.now,
    index: true
  },
  // Last visit timestamp
  lastVisit: {
    type: Date,
    default: Date.now,
    index: true
  },
  // Visit count (total visits from this visitor)
  visitCount: {
    type: Number,
    default: 1
  },
  // Time spent on site (in seconds)
  timeOnSite: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes for better query performance
visitorSchema.index({ visitorId: 1, lastVisit: -1 });
visitorSchema.index({ sessionId: 1 });
visitorSchema.index({ converted: 1, firstVisit: -1 });
visitorSchema.index({ isBot: 1, firstVisit: -1 });
visitorSchema.index({ createdAt: -1 });

// Static method to detect bots
visitorSchema.statics.isBot = function(userAgent) {
  if (!userAgent) return true;
  
  const botPatterns = [
    /bot/i, /crawl/i, /spider/i, /slurp/i, /mediapartners/i,
    /googlebot/i, /bingbot/i, /yahoo/i, /duckduckbot/i,
    /baiduspider/i, /yandex/i, /sogou/i, /exabot/i,
    /facebot/i, /ia_archiver/i, /facebookexternalhit/i,
    /twitterbot/i, /rogerbot/i, /linkedinbot/i, /embedly/i,
    /quora link preview/i, /showyoubot/i, /outbrain/i,
    /pinterest/i, /slackbot/i, /vkShare/i, /W3C_Validator/i,
    /whatsapp/i, /flipboard/i, /tumblr/i, /bitlybot/i,
    /skypeuripreview/i, /nuzzel/i, /discordbot/i,
    /qwantify/i, /pinterestbot/i, /bitrix link preview/i,
    /xing-contenttabreceiver/i, /chrome-lighthouse/i,
    /telegrambot/i, /applebot/i, /petalbot/i
  ];
  
  return botPatterns.some(pattern => pattern.test(userAgent));
};

// Static method to detect device type
visitorSchema.statics.detectDevice = function(userAgent) {
  if (!userAgent) return 'unknown';
  
  if (/tablet|ipad|playbook|silk/i.test(userAgent)) {
    return 'tablet';
  }
  if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(userAgent)) {
    return 'mobile';
  }
  return 'desktop';
};

export default mongoose.models.Visitor || mongoose.model('Visitor', visitorSchema);

