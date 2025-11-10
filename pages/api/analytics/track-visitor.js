import connectToDatabase from '@/lib/mongodb';
import Visitor from '@/models/Visitor';
import crypto from 'crypto';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      visitorId,
      sessionId,
      userAgent,
      screen,
      referrer,
      landingPage,
      currentPage,
      timeOnSite,
      updateTimeOnly
    } = req.body;

    // Validate required fields
    if (!visitorId || !sessionId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await connectToDatabase();

    // Get client IP
    const clientIP = req.headers['x-forwarded-for']?.split(',')[0] || 
                     req.headers['x-real-ip'] || 
                     req.connection?.remoteAddress || 
                     req.socket?.remoteAddress;
    
    // Hash IP for privacy
    const ipHash = clientIP ? crypto.createHash('sha256')
      .update(clientIP + (process.env.IP_SALT || 'indicore_salt'))
      .digest('hex') : null;

    // Detect if it's a bot (but we still track it)
    const isBot = Visitor.isBot(userAgent);

    // Detect device type
    const device = Visitor.detectDevice(userAgent);

    // Get browser and OS
    const browser = getBrowser(userAgent);
    const os = getOS(userAgent);

    // Try to get geolocation (optional - you can use a service like ipapi.co or similar)
    // For now, we'll skip this to avoid external API calls
    
    // Find existing visitor by visitorId
    const existingVisitor = await Visitor.findOne({ visitorId });

    if (existingVisitor) {
      // If this is just a time update, only update time
      if (updateTimeOnly) {
        existingVisitor.timeOnSite = Math.max(
          existingVisitor.timeOnSite || 0,
          timeOnSite || 0
        );
        await existingVisitor.save();
        return res.status(200).json({
          success: true,
          visitor: existingVisitor._id,
          timeUpdated: true
        });
      }

      // Update existing visitor
      const isNewSession = existingVisitor.sessionId !== sessionId;
      const isNewPage = existingVisitor.currentPage !== currentPage;

      // Update visitor data
      existingVisitor.lastVisit = new Date();
      existingVisitor.currentPage = currentPage;
      existingVisitor.timeOnSite = Math.max(
        existingVisitor.timeOnSite || 0,
        (existingVisitor.timeOnSite || 0) + (timeOnSite || 0)
      );
      
      // Update session if it's a new session
      if (isNewSession) {
        existingVisitor.sessionId = sessionId;
        existingVisitor.visitCount = (existingVisitor.visitCount || 1) + 1;
        existingVisitor.pageViews = 1;
      } else if (isNewPage) {
        // Same session, new page
        existingVisitor.pageViews = (existingVisitor.pageViews || 1) + 1;
      }

      // Update device info if available
      if (device !== 'unknown') existingVisitor.device = device;
      if (browser) existingVisitor.browser = browser;
      if (os) existingVisitor.os = os;
      if (screen) existingVisitor.screen = screen;
      if (referrer) existingVisitor.referrer = referrer;
      if (userAgent) existingVisitor.userAgent = userAgent;
      if (isBot) existingVisitor.isBot = isBot;

      await existingVisitor.save();

      return res.status(200).json({
        success: true,
        visitor: existingVisitor._id,
        isNewSession,
        isNewPage
      });
    } else {
      // Create new visitor
      const newVisitor = await Visitor.create({
        visitorId,
        sessionId,
        ipHash,
        userAgent,
        device,
        browser,
        os,
        screen,
        referrer,
        landingPage,
        currentPage,
        isBot,
        pageViews: 1,
        visitCount: 1,
        firstVisit: new Date(),
        lastVisit: new Date(),
        timeOnSite: timeOnSite || 0
      });

      return res.status(200).json({
        success: true,
        visitor: newVisitor._id,
        isNewVisitor: true
      });
    }
  } catch (error) {
    console.error('Error tracking visitor:', error);
    // Don't fail the request if tracking fails
    return res.status(200).json({ 
      success: false, 
      error: error.message 
    });
  }
}

// Helper functions (can be imported from visitorUtils if needed)
function getBrowser(userAgent) {
  if (!userAgent) return 'Unknown';
  if (userAgent.indexOf('Firefox') > -1) return 'Firefox';
  if (userAgent.indexOf('Chrome') > -1) return 'Chrome';
  if (userAgent.indexOf('Safari') > -1) return 'Safari';
  if (userAgent.indexOf('Edge') > -1) return 'Edge';
  if (userAgent.indexOf('Opera') > -1 || userAgent.indexOf('OPR') > -1) return 'Opera';
  if (userAgent.indexOf('MSIE') > -1 || userAgent.indexOf('Trident') > -1) return 'IE';
  return 'Unknown';
}

function getOS(userAgent) {
  if (!userAgent) return 'Unknown';
  if (userAgent.indexOf('Windows') > -1) return 'Windows';
  if (userAgent.indexOf('Mac') > -1) return 'macOS';
  if (userAgent.indexOf('Linux') > -1) return 'Linux';
  if (userAgent.indexOf('Android') > -1) return 'Android';
  if (userAgent.indexOf('iOS') > -1 || userAgent.indexOf('iPhone') > -1 || userAgent.indexOf('iPad') > -1) return 'iOS';
  return 'Unknown';
}

