/**
 * Generate a unique visitor ID based on various factors
 * This creates a fingerprint that persists across sessions (stored in localStorage)
 */
export function generateVisitorId() {
  if (typeof window === 'undefined') return null;
  
  // Try to get existing visitor ID from localStorage
  let visitorId = localStorage.getItem('indicore_visitor_id');
  
  if (!visitorId) {
    // Generate a new visitor ID using a simple hash function
    const components = [
      navigator.userAgent || '',
      navigator.language || '',
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset().toString(),
      navigator.platform || ''
    ];
    
    const fingerprint = components.join('|');
    // Simple hash function for client-side
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    visitorId = Math.abs(hash).toString(36) + Date.now().toString(36);
    localStorage.setItem('indicore_visitor_id', visitorId);
  }
  
  return visitorId;
}

/**
 * Generate a session ID (changes on each new session)
 */
export function generateSessionId() {
  if (typeof window === 'undefined') return null;
  
  let sessionId = sessionStorage.getItem('indicore_session_id');
  
  if (!sessionId) {
    // Generate unique session ID
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      sessionId = crypto.randomUUID();
    } else {
      sessionId = Date.now().toString(36) + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
    }
    sessionStorage.setItem('indicore_session_id', sessionId);
  }
  
  return sessionId;
}

/**
 * Hash IP address for privacy (server-side only)
 */
export function hashIP(ip) {
  if (typeof window !== 'undefined') return null; // Client-side should not hash IPs
  if (!ip) return null;
  
  // This will be used server-side where crypto is available
  const crypto = require('crypto');
  const salt = process.env.IP_SALT || 'indicore_salt';
  return crypto.createHash('sha256').update(ip + salt).digest('hex');
}

/**
 * Extract browser name from user agent
 */
export function getBrowser(userAgent) {
  if (!userAgent) return 'Unknown';
  
  if (userAgent.indexOf('Firefox') > -1) return 'Firefox';
  if (userAgent.indexOf('Chrome') > -1) return 'Chrome';
  if (userAgent.indexOf('Safari') > -1) return 'Safari';
  if (userAgent.indexOf('Edge') > -1) return 'Edge';
  if (userAgent.indexOf('Opera') > -1 || userAgent.indexOf('OPR') > -1) return 'Opera';
  if (userAgent.indexOf('MSIE') > -1 || userAgent.indexOf('Trident') > -1) return 'IE';
  
  return 'Unknown';
}

/**
 * Extract OS from user agent
 */
export function getOS(userAgent) {
  if (!userAgent) return 'Unknown';
  
  if (userAgent.indexOf('Windows') > -1) return 'Windows';
  if (userAgent.indexOf('Mac') > -1) return 'macOS';
  if (userAgent.indexOf('Linux') > -1) return 'Linux';
  if (userAgent.indexOf('Android') > -1) return 'Android';
  if (userAgent.indexOf('iOS') > -1 || userAgent.indexOf('iPhone') > -1 || userAgent.indexOf('iPad') > -1) return 'iOS';
  
  return 'Unknown';
}

/**
 * Get client-side visitor data
 */
export function getVisitorData() {
  if (typeof window === 'undefined') return null;
  
  return {
    visitorId: generateVisitorId(),
    sessionId: generateSessionId(),
    userAgent: navigator.userAgent || '',
    screen: `${screen.width}x${screen.height}`,
    language: navigator.language || 'en',
    referrer: document.referrer || '',
    landingPage: window.location.pathname + window.location.search,
    currentPage: window.location.pathname + window.location.search,
    timestamp: new Date().toISOString()
  };
}

