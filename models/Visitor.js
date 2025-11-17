import mongoose from 'mongoose';

const visitorSchema = new mongoose.Schema({
  visitorId: {
    type: String,
    required: true,
    index: true
  },
  ipHash: {
    type: String,
    index: true
  },
  userAgent: String,
  device: {
    type: String,
    enum: ['desktop', 'mobile', 'tablet', 'unknown'],
    default: 'unknown'
  },
  browser: String,
  os: String,
  screen: String,
  referrer: String,
  landingPage: String,
  currentPage: String,
  country: String,
  city: String,
  isBot: {
    type: Boolean,
    default: false,
    index: true
  },
  sessionId: {
    type: String,
    index: true
  },
  pageViews: {
    type: Number,
    default: 1
  },
  converted: {
    type: Boolean,
    default: false,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  userEmail: String,
  convertedAt: Date,
  firstVisit: {
    type: Date,
    default: Date.now,
    index: true
  },
  lastVisit: {
    type: Date,
    default: Date.now,
    index: true
  },
  visitCount: {
    type: Number,
    default: 1
  },
  timeOnSite: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

visitorSchema.index({ visitorId: 1, lastVisit: -1 });
visitorSchema.index({ sessionId: 1 });
visitorSchema.index({ converted: 1, firstVisit: -1 });
visitorSchema.index({ isBot: 1, firstVisit: -1 });
visitorSchema.index({ createdAt: -1 });

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

