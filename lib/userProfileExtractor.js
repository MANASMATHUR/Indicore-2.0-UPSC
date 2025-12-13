/**
 * Utility functions to extract and store user profile information from conversations
 */

/**
 * Extract user information from a message
 * @param {string} message - User message
 * @returns {Object} - Extracted profile information
 */
export function extractUserInfo(message) {
  if (!message || typeof message !== 'string') {
    return {};
  }

  const info = {};
  const lowerMessage = message.toLowerCase();

  const cgpaMatch = message.match(/\b(?:my\s+)?(?:cgpa|gpa)\s*(?:is\s*)?(?:[:=]?\s*)?(\d+\.?\d*)\b/i);
  if (cgpaMatch && cgpaMatch[1]) {
    const cgpa = parseFloat(cgpaMatch[1]);
    if (cgpa >= 0 && cgpa <= 10) {
      info.cgpa = cgpa;
    }
  }

  const universityPatterns = [
    /\b(?:i\s+)?(?:study|studying|am|go\s+to|attending)\s+(?:at\s+)?(?:the\s+)?([A-Z][A-Za-z\s&]{2,30}?(?:\s+university|\s+college|\s+institute|\s+univ|\s+univ\.))/i,
    /\b(?:university|college|institute)\s+(?:is|of|name\s+is)\s+([A-Z][A-Za-z\s&]{2,30})/i,
    /\b(?:from|at)\s+([A-Z][A-Za-z\s&]{2,30}?(?:\s+university|\s+college|\s+institute))/i
  ];
  for (const pattern of universityPatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      info.university = match[1].trim();
      break;
    }
  }

  const degreePatterns = [
    /\b(?:i\s+)?(?:am\s+)?(?:doing|pursuing|studying)\s+(?:a\s+)?(?:b\.?tech|b\.?e\.?|b\.?sc|b\.?a|m\.?tech|m\.?sc|m\.?a|ph\.?d|bachelor|master|doctorate|engineering|science|arts|commerce|law|medicine)\b/i,
    /\b(b\.?tech|b\.?e\.?|b\.?sc|b\.?a|m\.?tech|m\.?sc|m\.?a|ph\.?d)\s+(?:in|student|degree)/i
  ];
  for (const pattern of degreePatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      info.degree = match[1].trim().toUpperCase();
      break;
    }
  }

  const yearMatch = message.match(/\b(?:i\s+)?(?:am\s+)?(?:in\s+)?(?:my\s+)?(?:1st|first|2nd|second|3rd|third|4th|fourth|final|last)\s+year\b/i);
  if (yearMatch) {
    const yearText = yearMatch[0].toLowerCase();
    if (yearText.includes('1st') || yearText.includes('first')) info.year = '1st';
    else if (yearText.includes('2nd') || yearText.includes('second')) info.year = '2nd';
    else if (yearText.includes('3rd') || yearText.includes('third')) info.year = '3rd';
    else if (yearText.includes('4th') || yearText.includes('fourth')) info.year = '4th';
    else if (yearText.includes('final') || yearText.includes('last')) info.year = 'Final';
  }

  const examPatterns = [
    /\b(?:preparing|preparing\s+for|target|targeting|aiming\s+for)\s+(?:the\s+)?(upsc|pcs|ssc|ias|ips|ifs|ies|gate|cat|jee|neet)\b/i,
    /\b(upsc|pcs|ssc|ias|ips|ifs|ies|gate|cat|jee|neet)\s+(?:exam|preparation|prep)/i
  ];
  for (const pattern of examPatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      info.targetExam = match[1].toUpperCase();
      break;
    }
  }

  const examYearMatch = message.match(/\b(?:exam\s+year|target\s+year|appearing\s+in)\s+(\d{4})\b/i);
  if (examYearMatch && examYearMatch[1]) {
    const year = parseInt(examYearMatch[1]);
    const currentYear = new Date().getFullYear();
    if (year >= currentYear && year <= currentYear + 5) {
      info.examYear = examYearMatch[1];
    }
  }

  if (lowerMessage.includes('strength') || lowerMessage.includes('good at') || lowerMessage.includes('strong in')) {
    const strengthMatch = message.match(/(?:strength|good\s+at|strong\s+in)\s+(?:is|are|in)?\s*([^.,!?]+)/i);
    if (strengthMatch && strengthMatch[1]) {
      const strengths = strengthMatch[1].split(/[,&and]+/).map(s => s.trim()).filter(s => s.length > 0);
      if (strengths.length > 0) {
        info.strengths = strengths;
      }
    }
  }

  if (lowerMessage.includes('weakness') || lowerMessage.includes('weak in') || lowerMessage.includes('need help with')) {
    const weaknessMatch = message.match(/(?:weakness|weak\s+in|need\s+help\s+with)\s+(?:is|are|in)?\s*([^.,!?]+)/i);
    if (weaknessMatch && weaknessMatch[1]) {
      const weaknesses = weaknessMatch[1].split(/[,&and]+/).map(s => s.trim()).filter(s => s.length > 0);
      if (weaknesses.length > 0) {
        info.weaknesses = weaknesses;
      }
    }
  }

  const factPatterns = [
    /\b(?:i|my|i'm|i am)\s+(?:am|have|like|prefer|want|need|work|live|study|do|enjoy|love|hate|dislike|interested|passionate|focused|planning|trying|learning)\s+([^.,!?]{5,80})/gi,
    /\b(?:i|my|i'm|i am)\s+(?:favorite|favourite|preferred|prefer|good at|bad at|weak in|strong in)\s+([^.,!?]{3,50})/gi,
    /\b(?:i|my|i'm|i am)\s+(?:from|in|at|near|based in|located in)\s+([A-Z][A-Za-z\s]{2,40})/gi,
    /\b(?:my|i have|i've|i own|i work|i study)\s+([^.,!?]{5,60})/gi,
    /\b(?:remember|note|keep in mind|i told you|i mentioned|i said)\s+(?:that\s+)?(?:i|my|i'm|i am)\s+([^.,!?]{5,80})/gi,
    // Enhanced patterns for exam-related facts
    /\b(?:my|i have|i've|i am|i'm)\s+([a-z]+)\s+(?:is|are|was|will be)\s+(?:my|the|a|an)\s+([^.,!?]{3,50})\s+(?:exam|subject|paper|test)/gi,
    /\b([a-z]+)\s+(?:is|are|was|will be)\s+(?:my|the|a|an)\s+([^.,!?]{3,50})\s+(?:exam|subject|paper|test)/gi,
    /\b(?:preparing|prep|studying)\s+(?:for|my)\s+([^.,!?]{3,50})\s+(?:exam|subject|paper|test)/gi,
    /\b(?:my|the)\s+([^.,!?]{3,50})\s+(?:exam|subject|paper|test)\s+(?:is|are|will be|on)\s+([^.,!?]{3,50})/gi
  ];

  const extractedFacts = [];
  for (const pattern of factPatterns) {
    const matches = message.matchAll(pattern);
    for (const match of matches) {
      // Handle patterns with multiple capture groups (like exam patterns)
      if (match.length > 2 && match[1] && match[2]) {
        // For patterns like "X is my Y exam"
        const fact = `${match[1].trim()} is my ${match[2].trim()} exam`;
        if (fact.length > 10 && fact.length < 200 && !extractedFacts.includes(fact)) {
          extractedFacts.push(fact);
        }
      } else if (match[1]) {
        const fact = match[1].trim();
        if (fact.length > 5 && fact.length < 200 && !extractedFacts.includes(fact)) {
          extractedFacts.push(fact);
        }
      }
    }
  }

  // Special handling for "X is my Y exam" patterns (e.g., "tom is my history exam")
  const examNamePattern = /\b([a-z]+)\s+(?:is|are|was|will be)\s+(?:my|the|a|an)\s+([^.,!?]{3,50})\s+(?:exam|subject|paper|test)/gi;
  const examMatches = message.matchAll(examNamePattern);
  for (const match of examMatches) {
    if (match[1] && match[2]) {
      const examName = match[1].trim();
      const examType = match[2].trim();
      const fact = `${examName} is my ${examType} exam`;
      if (!extractedFacts.some(f => f.toLowerCase().includes(examName.toLowerCase()) && f.toLowerCase().includes(examType.toLowerCase()))) {
        extractedFacts.push(fact);
      }
    }
  }

  if (extractedFacts.length > 0) {
    info.facts = extractedFacts.slice(0, 5); // Increased from 3 to 5 to capture more facts
  }

  if (lowerMessage.includes('goal') || lowerMessage.includes('want to') || lowerMessage.includes('plan to') || lowerMessage.includes('aim to')) {
    const goalMatch = message.match(/(?:goal|want to|plan to|aim to|objective)\s+(?:is|are|to)?\s*([^.,!?]{5,100})/i);
    if (goalMatch && goalMatch[1]) {
      info.goals = [goalMatch[1].trim()];
    }
  }

  const datePatterns = [
    /\b(?:exam|test|deadline|due|event|meeting|appointment)\s+(?:on|is|will be|scheduled for)\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}|(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4})/i,
    /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+(?:is|will be|for)\s+(?:my|the)\s+(?:exam|test|deadline|event)/i
  ];
  for (const pattern of datePatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      try {
        const dateStr = match[1];
        let parsedDate = new Date(dateStr);
        if (isNaN(parsedDate.getTime())) {
          const parts = dateStr.split(/[\/\-]/);
          if (parts.length === 3) {
            parsedDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
          }
        }
        if (!isNaN(parsedDate.getTime())) {
          info.importantDates = [{
            description: message.substring(Math.max(0, match.index - 30), Math.min(message.length, match.index + match[0].length + 30)).trim(),
            date: parsedDate,
            type: 'event'
          }];
          break;
        }
      } catch (e) {
        info.importantDates = [{
          description: `${message.substring(Math.max(0, match.index - 30), Math.min(message.length, match.index + match[0].length + 30)).trim()} (${match[1]})`,
          date: new Date(),
          type: 'event'
        }];
        break;
      }
    }
  }

  return info;
}

/**
 * Detect if message contains important information that should be saved to memory
 * Returns information that should prompt the user to save
 * @param {string} message - User message
 * @returns {Object|null} - Information to save, or null if nothing important
 */
export function detectSaveWorthyInfo(message) {
  if (!message || typeof message !== 'string') {
    return null;
  }

  const lowerMessage = message.toLowerCase();
  const saveWorthyInfo = {};

  // Detect exam-related facts (e.g., "tom is my history exam")
  const examFactPattern = /\b([a-z]+)\s+(?:is|are|was|will be)\s+(?:my|the|a|an)\s+([^.,!?]{3,50})\s+(?:exam|subject|paper|test)/i;
  const examMatch = message.match(examFactPattern);
  if (examMatch && examMatch[1] && examMatch[2]) {
    saveWorthyInfo.type = 'exam_fact';
    saveWorthyInfo.value = `${examMatch[1].trim()} is my ${examMatch[2].trim()} exam`;
    saveWorthyInfo.description = `I noticed you mentioned "${saveWorthyInfo.value}". Should I save this to your memory so I can remember it in future conversations?`;
    return saveWorthyInfo;
  }

  // Detect exam dates
  const examDatePattern = /\b(?:my|the)\s+([^.,!?]{3,50})\s+(?:exam|test)\s+(?:is|will be|on|scheduled for)\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}|(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4})/i;
  const dateMatch = message.match(examDatePattern);
  if (dateMatch && dateMatch[1] && dateMatch[2]) {
    saveWorthyInfo.type = 'exam_date';
    saveWorthyInfo.value = `${dateMatch[1].trim()} exam on ${dateMatch[2].trim()}`;
    saveWorthyInfo.description = `I noticed you mentioned your exam date: "${saveWorthyInfo.value}". Should I save this to your memory?`;
    return saveWorthyInfo;
  }

  // Detect goals
  if (lowerMessage.includes('goal') || lowerMessage.includes('want to') || lowerMessage.includes('plan to')) {
    const goalMatch = message.match(/(?:my\s+)?(?:goal|want to|plan to|aim to|objective)\s+(?:is|are|to)?\s*([^.,!?]{5,100})/i);
    if (goalMatch && goalMatch[1]) {
      saveWorthyInfo.type = 'goal';
      saveWorthyInfo.value = goalMatch[1].trim();
      saveWorthyInfo.description = `I noticed you mentioned a goal: "${saveWorthyInfo.value}". Should I save this to your memory?`;
      return saveWorthyInfo;
    }
  }

  // Detect important facts (personal information)
  const factPatterns = [
    /\b(?:i|my|i'm|i am)\s+(?:am|have|like|prefer|want|need|work|live|study|do|enjoy|love|hate|dislike|interested|passionate|focused|planning|trying|learning)\s+([^.,!?]{10,80})/i,
    /\b(?:my|i have|i've|i own)\s+([^.,!?]{10,60})/i
  ];

  for (const pattern of factPatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      const fact = match[1].trim();
      // Only prompt for facts that seem important (not too generic)
      if (fact.length > 10 && fact.length < 200 &&
        !fact.match(/^(?:a|an|the|is|are|was|were|will|would|can|could|should|may|might)\s/i)) {
        saveWorthyInfo.type = 'fact';
        saveWorthyInfo.value = fact;
        saveWorthyInfo.description = `I noticed you mentioned: "${fact}". Should I save this to your memory so I can remember it in future conversations?`;
        return saveWorthyInfo;
      }
    }
  }

  return null;
}

/**
 * Check if user response confirms saving to memory
 * @param {string} message - User message
 * @returns {boolean} - True if user confirmed
 */
export function isSaveConfirmation(message) {
  if (!message || typeof message !== 'string') {
    return false;
  }

  const lowerMessage = message.toLowerCase().trim();
  const confirmations = [
    'yes', 'yeah', 'yep', 'yup', 'sure', 'ok', 'okay', 'alright', 'fine',
    'save it', 'save', 'remember', 'remember it', 'keep it', 'store it',
    'add it', 'add to memory', 'save to memory', 'yes save', 'yes please',
    'go ahead', 'do it', 'confirm', 'agreed', 'correct'
  ];

  return confirmations.some(conf => lowerMessage === conf || lowerMessage.startsWith(conf + ' '));
}

/**
 * Update user profile with extracted information
 * @param {Object} user - User document
 * @param {Object} extractedInfo - Extracted information
 * @returns {Object} - Updated profile
 */
export function updateUserProfile(user, extractedInfo) {
  if (!user || !extractedInfo || Object.keys(extractedInfo).length === 0) {
    return user?.profile || {};
  }

  const profile = user.profile || {};
  let updated = false;

  if (extractedInfo.cgpa !== undefined && extractedInfo.cgpa !== null) {
    if (profile.cgpa !== extractedInfo.cgpa) {
      profile.cgpa = extractedInfo.cgpa;
      updated = true;
    }
  }

  if (extractedInfo.university) {
    if (profile.university !== extractedInfo.university) {
      profile.university = extractedInfo.university;
      updated = true;
    }
  }

  if (extractedInfo.degree) {
    if (profile.degree !== extractedInfo.degree) {
      profile.degree = extractedInfo.degree;
      updated = true;
    }
  }

  if (extractedInfo.year) {
    if (profile.year !== extractedInfo.year) {
      profile.year = extractedInfo.year;
      updated = true;
    }
  }

  if (extractedInfo.targetExam) {
    if (profile.targetExam !== extractedInfo.targetExam) {
      profile.targetExam = extractedInfo.targetExam;
      updated = true;
    }
  }

  if (extractedInfo.examYear) {
    if (profile.examYear !== extractedInfo.examYear) {
      profile.examYear = extractedInfo.examYear;
      updated = true;
    }
  }

  if (extractedInfo.strengths && extractedInfo.strengths.length > 0) {
    const existingStrengths = profile.strengths || [];
    const newStrengths = extractedInfo.strengths.filter(s => !existingStrengths.includes(s));
    if (newStrengths.length > 0) {
      profile.strengths = [...existingStrengths, ...newStrengths];
      updated = true;
    }
  }

  if (extractedInfo.weaknesses && extractedInfo.weaknesses.length > 0) {
    const existingWeaknesses = profile.weaknesses || [];
    const newWeaknesses = extractedInfo.weaknesses.filter(w => !existingWeaknesses.includes(w));
    if (newWeaknesses.length > 0) {
      profile.weaknesses = [...existingWeaknesses, ...newWeaknesses];
      updated = true;
    }
  }

  if (extractedInfo.goals && extractedInfo.goals.length > 0) {
    const existingGoals = Array.isArray(profile.goals) ? profile.goals : [];
    const newGoals = extractedInfo.goals.filter(g => !existingGoals.some(eg => eg.toLowerCase() === g.toLowerCase()));
    if (newGoals.length > 0) {
      profile.goals = [...existingGoals, ...newGoals];
      updated = true;
    }
  }

  if (extractedInfo.importantDates && extractedInfo.importantDates.length > 0) {
    if (!profile.importantDates) {
      profile.importantDates = [];
    }
    extractedInfo.importantDates.forEach(newDate => {
      if (!newDate || !newDate.date) return;

      try {
        const newDateValue = newDate.date instanceof Date
          ? newDate.date.getTime()
          : new Date(newDate.date).getTime();

        if (isNaN(newDateValue)) return;

        const exists = profile.importantDates.some(d => {
          if (!d || !d.date) return false;
          try {
            const dDateValue = d.date instanceof Date ? d.date.getTime() : new Date(d.date).getTime();
            return !isNaN(dDateValue) && dDateValue === newDateValue && d.description === newDate.description;
          } catch (e) {
            return false;
          }
        });

        if (!exists) {
          profile.importantDates.push({
            description: newDate.description || 'Event',
            date: newDate.date instanceof Date ? newDate.date : new Date(newDate.date),
            type: newDate.type || 'event',
            timestamp: new Date()
          });
          updated = true;
        }
      } catch (e) {
        console.warn('Invalid date in importantDates:', e.message);
      }
    });
  }

  if (extractedInfo.facts && extractedInfo.facts.length > 0) {
    if (!profile.facts) {
      profile.facts = [];
    }
    extractedInfo.facts.forEach(newFact => {
      if (!newFact || typeof newFact !== 'string') return;
      const normalizedFact = newFact.toLowerCase().trim();
      if (normalizedFact.length < 5) return;
      const exists = profile.facts.some(f => {
        if (!f || typeof f !== 'string') return false;
        return f.toLowerCase().trim() === normalizedFact;
      });
      if (!exists) {
        profile.facts.push(newFact);
        updated = true;
      }
    });
    if (profile.facts.length > 20) {
      profile.facts = profile.facts.slice(-20);
    }
  }

  if (updated) {
    profile.lastUpdated = new Date();
  }

  return profile;
}

/**
 * Extract key information from conversation using AI
 * This is called after conversations to extract important facts
 * @param {Array} messages - Conversation messages
 * @param {string} userEmail - User email
 * @returns {Promise<Object>} - Extracted information
 */
export async function extractConversationFacts(messages, userEmail) {
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return {};
  }

  try {
    const userMessages = messages
      .filter(msg => msg && (msg.sender === 'user' || msg.role === 'user'))
      .slice(-10)
      .map(msg => (msg.text || msg.content || '').trim())
      .filter(text => text.length > 0)
      .join('\n');

    if (userMessages.length < 20) {
      return {};
    }

    const facts = [];

    const pattern1 = /\b(?:i|my|i'm|i am)\s+(?:am|have|like|prefer|want|need|work|live|study|do|enjoy|love|hate|dislike|interested|passionate|focused|planning|trying|learning)\s+[^.!?]{10,100}/gi;
    const matches1 = userMessages.matchAll(pattern1);
    for (const match of matches1) {
      const fact = match[0].trim();
      if (fact.length > 10 && fact.length < 200) {
        facts.push(fact);
      }
    }

    const pattern2 = /\b(?:my|i have|i've|i own)\s+[^.!?]{10,100}/gi;
    const matches2 = userMessages.matchAll(pattern2);
    for (const match of matches2) {
      const fact = match[0].trim();
      if (fact.length > 10 && fact.length < 200 && !facts.includes(fact)) {
        facts.push(fact);
      }
    }

    const pattern3 = /\b(?:i|i'm|i am)\s+(?:from|in|at|near|based in)\s+[A-Z][^.!?]{5,50}/gi;
    const matches3 = userMessages.matchAll(pattern3);
    for (const match of matches3) {
      const fact = match[0].trim();
      if (fact.length > 10 && fact.length < 200 && !facts.includes(fact)) {
        facts.push(fact);
      }
    }

    return {
      facts: facts.slice(0, 5),
      extractedAt: new Date()
    };
  } catch (error) {
    console.error('Error extracting conversation facts:', error);
    return {};
  }
}

/**
 * Format user profile as context string for system prompt
 * @param {Object} profile - User profile
 * @returns {string} - Formatted context string
 */
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

