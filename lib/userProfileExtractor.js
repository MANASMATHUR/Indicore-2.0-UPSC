/**
 * Utility functions to extract and store user profile information from conversations
 */
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';

// Extract user information from a message
// @param {string} message - User message
// @returns {Object} - Extracted profile information
export function extractUserInfo(message) {
  if (!message || typeof message !== 'string') return {};

  const info = {};
  const lowerMsg = message.toLowerCase();

  // CGPA detection
  const cgpaMatch = message.match(/cgpa\s*(?:is|of)?\s*(\d+(?:\.\d+)?)/i);
  if (cgpaMatch) {
    const val = parseFloat(cgpaMatch[1]);
    if (val >= 0 && val <= 10) info.cgpa = val;
  }

  // University detection
  const uniMatch = message.match(/(?:university|college|institute)\s*(?:is|of|called|at)?\s*([^.,;\n]+)/i);
  if (uniMatch) info.university = uniMatch[1].trim();

  // Target exam
  const examMatch = message.match(/(?:preparing\s+for|target\s+exam|aiming\s+for)\s*([^.,;\n]+)/i);
  if (examMatch) info.targetExam = examMatch[1].trim();

  return info;
}

// Detect if message contains important information that should be saved to memory
// Returns information that should prompt the user to save
// @param {string} message - User message
// @returns {Object|null} - Information to save, or null if nothing important
export function detectSaveWorthyInfo(message) {
  if (!message || message.length < 10) return null;

  const lowerMsg = message.toLowerCase();

  // Checking for explicit preferences or personal facts
  const triggers = [
    /i\s+prefer/i,
    /i\s+like/i,
    /i\s+don't\s+like/i,
    /my\s+(?:name|age|goal|dream|interest|hobby|job|occupation|location|city)\s+is/i,
    /i\s+work\s+as/i,
    /i\s+am\s+(?:studying|reading|learning)/i,
    /don't\s+forget/i,
    /remember\s+that/i
  ];

  if (triggers.some(t => t.test(message))) {
    return {
      type: 'user_fact',
      content: message,
      timestamp: new Date()
    };
  }

  return null;
}

// Check if user response confirms saving to memory
// @param {string} message - User message
// @returns {boolean} - True if user confirmed
export function isSaveConfirmation(message) {
  if (!message) return false;
  const lower = message.toLowerCase();
  return /^(yes|yeah|sure|yep|okay|ok|do it|save it|proceed|confirm)/i.test(lower);
}

// Update user profile with extracted information
// @param {Object} user - User document
// @param {Object} extractedInfo - Extracted information
// @returns {Object} - Updated profile
export function updateUserProfile(user, extractedInfo) {
  if (!user || !extractedInfo) return user?.profile;

  const profile = user.profile || {};

  // Merge new info
  Object.keys(extractedInfo).forEach(key => {
    if (Array.isArray(profile[key])) {
      if (!profile[key].includes(extractedInfo[key])) {
        profile[key].push(extractedInfo[key]);
      }
    } else {
      profile[key] = extractedInfo[key];
    }
  });

  profile.lastUpdated = new Date();
  return profile;
}

// Extract key information from conversation using AI
// This is called after conversations to extract important facts
// @param {Array} messages - Conversation messages
// @param {string} userEmail - User email
// @returns {Promise<Object>} - Extracted information
export async function extractConversationFacts(messages, userEmail) {
  // Logic to process a whole conversation and find persistent facts
  // This would typically involve an LLM call to summarize/extract facts
  return {};
}

// Format explicit memories for AI context
// @param {Array} memories - List of memory objects
// @returns {string} - Formatted memory string
export function formatMemoriesForAI(memories) {
  if (!Array.isArray(memories) || memories.length === 0) return '';

  const categories = {};
  memories.forEach(m => {
    if (!m || !m.content) return;
    const cat = m.category || 'general';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(m.content);
  });

  const parts = [];
  Object.keys(categories).forEach(cat => {
    const items = categories[cat].join('\n  • ');
    parts.push(`[${cat.toUpperCase()}]:\n  • ${items}`);
  });

  return parts.join('\n\n');
}

// Format user profile as context string for system prompt
// @param {Object} profile - User profile
// @returns {string} - Formatted context string
export function formatProfileContext(profile) {
  if (!profile || Object.keys(profile).length === 0) {
    return '';
  }

  const contextParts = [];

  if (profile.cgpa !== null && profile.cgpa !== undefined) {
    contextParts.push(`CGPA: ${profile.cgpa}`);
  }

  if (profile.university) {
    contextParts.push(`University: ${profile.university}`);
  }

  if (profile.degree) {
    contextParts.push(`Degree: ${profile.degree}`);
  }

  if (profile.year) {
    contextParts.push(`Year: ${profile.year}`);
  }

  if (profile.targetExam) {
    contextParts.push(`Target Exam: ${profile.targetExam}`);
  }

  if (profile.examYear) {
    contextParts.push(`Exam Year: ${profile.examYear}`);
  }

  if (profile.strengths && profile.strengths.length > 0) {
    contextParts.push(`Strengths: ${profile.strengths.join(', ')}`);
  }

  if (profile.weaknesses && profile.weaknesses.length > 0) {
    contextParts.push(`Areas for Improvement: ${profile.weaknesses.join(', ')}`);
  }

  if (profile.goals && profile.goals.length > 0) {
    contextParts.push(`Goals: ${profile.goals.join(', ')}`);
  }

  if (profile.facts && profile.facts.length > 0) {
    contextParts.push(`Important Facts: ${profile.facts.slice(-5).join('; ')}`);
  }

  if (profile.importantDates && profile.importantDates.length > 0) {
    try {
      const upcomingDates = profile.importantDates
        .filter(d => {
          if (!d || !d.date) return false;
          try {
            const date = d.date instanceof Date ? d.date : new Date(d.date);
            return !isNaN(date.getTime()) && date >= new Date();
          } catch (e) {
            return false;
          }
        })
        .slice(0, 3)
        .map(d => {
          try {
            const date = d.date instanceof Date ? d.date : new Date(d.date);
            if (isNaN(date.getTime())) return null;
            const dateStr = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
            return `${d.description} on ${dateStr}`;
          } catch (e) {
            return null;
          }
        })
        .filter(d => d !== null)
        .join(', ');
      if (upcomingDates) {
        contextParts.push(`Upcoming Events: ${upcomingDates}`);
      }
    } catch (e) {
    }
  }

  let profileContext = '';
  if (contextParts.length > 0) {
    profileContext = `\n\nUSER PROFILE INFORMATION (Remember this across ALL conversations - this is persistent memory):\n${contextParts.join('\n')}\n\nIMPORTANT: Use this information to provide personalized responses. If the user asks about their information (like "What is my CGPA?", "What are my goals?", "What did I tell you about X?"), refer to this profile. This information persists across all chat sessions, so remember it even in new conversations.`;
  }

  // Add personalization context (will be added separately in chat endpoints)
  return profileContext;
}
