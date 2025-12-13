/**
 * Enhanced User Information Extractor
 * Extracts and stores user information from natural conversation
 * Works like ChatGPT's memory system
 */

/**
 * Enhanced information patterns for better extraction
 */
const ENHANCED_PATTERNS = {
    // Personal details
    name: /(?:my name is|i am|i'm|call me)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
    age: /(?:i am|i'm)\s+(\d{2})\s+years?\s+old/i,

    // Educational background
    university: /(?:studying at|student at|from)\s+([A-Z][A-Za-z\s]+(?:University|College|Institute))/i,
    degree: /(?:pursuing|doing|completed?)\s+(B\.?Tech|M\.?Tech|B\.?A|M\.?A|B\.?Sc|M\.?Sc|BBA|MBA|B\.?Com|M\.?Com)(?:\s+in\s+([A-Za-z\s]+))?/i,
    cgpa: /(?:my cgpa is|cgpa of|cgpa:|grade)\s+(\d+(?:\.\d+)?)/i,
    year: /(?:in|studying in|currently in)\s+(\d+)(?:st|nd|rd|th)?\s+year/i,

    // Exam preparation
    targetExam: /(?:preparing for|targeting|appearing for|giving)\s+(UPSC|IAS|PCS|SSC|TNPSC|MPSC|BPSC|UPPSC|state\s+psc|civil\s+services)/i,
    examYear: /(?:in|for|exam in|appearing in)\s+(\d{4})/i,
    attempt: /(?:this is my|my)\s+(\d+)(?:st|nd|rd|th)?\s+attempt/i,

    // Study preferences & habits
    studyTime: /(?:i study|i prefer studying|study)\s+(?:at|in the|during)\s+(morning|afternoon|evening|night|early morning|late night)/i,
    studyHours: /(?:study|studying)\s+(?:for\s+)?(\d+)\s+hours?\s+(?:a\s+)?(?:day|daily)/i,
    preferredSubjects: /(?:i like|i prefer|i'm good at|strong in|interested in)\s+([A-Za-z\s,]+)(?:more than|over|compared to)/i,
    weakSubjects: /(?:i struggle with|weak in|difficult|challenging|hard time with|not good at)\s+([A-Za-z\s,]+)/i,

    // Goals & targets
    goalScore: /(?:want to score|aiming for|target is|goal is)\s+(\d+)/i,
    currentAffairsSource: /(?:i read|i follow|i get news from)\s+([A-Za-z\s]+(?:newspaper|magazine|website|channel))/i,

    // Location
    location: /(?:i am from|i live in|based in|staying in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,

    // Special interests or background
    optionalSubject: /(?:my optional|optional subject is|taking)\s+([A-Za-z\s]+)(?:as optional)?/i,
    previousWork: /(?:i worked as|worked at|working as|job as)\s+([A-Za-z\s]+)/i,
    hobbies: /(?:hobbies include|i like|i enjoy|interests are)\s+([A-Za-z\s,]+)/i,

    // Study materials
    books: /(?:i read|i use|i'm reading|following)\s+([A-Z][A-Za-z\s']+)(?:book|by)/i,
    coachingCenter: /(?:i attend|joined|enrolled in|going to)\s+([A-Z][A-Za-z\s]+)(?:academy|institute|coaching|classes)/i
};

/**
 * Extract comprehensive user information from message
 */
export function extractEnhancedUserInfo(message) {
    if (!message || typeof message !== 'string') return {};

    const extracted = {};

    for (const [key, pattern] of Object.entries(ENHANCED_PATTERNS)) {
        const match = message.match(pattern);
        if (match) {
            extracted[key] = match[1].trim();

            // For degree, capture specialization if present
            if (key === 'degree' && match[2]) {
                extracted.degreeSpecialization = match[2].trim();
            }
        }
    }

    return extracted;
}

/**
 * Detect if user is sharing save-worthy information
 * Enhanced version with more patterns
 */
export function detectEnhancedSaveWorthyInfo(message) {
    const saveWorthyPatterns = [
        // Direct statements
        { pattern: /(?:remember|note|keep in mind|don't forget)(?:\s+that)?\s+(.+)/i, type: 'note' },
        { pattern: /(?:i want you to|please)\s+(?:remember|note)\s+(.+)/i, type: 'note' },

        // Important facts
        { pattern: /(?:important|crucial|key point)(?:\s+is)?\s*:?\s*(.+)/i, type: 'important' },
        { pattern: /(?:always|never)\s+(.+)/i, type: 'rule' },

        // Personal preferences
        { pattern: /i\s+(?:don't\s+)?(?:like|prefer|enjoy|hate|love)\s+(.+)/i, type: 'preference' },
        { pattern: /i\s+(?:usually|typically|normally|always)\s+(.+)/i, type: 'habit' },

        // Goals and targets
        { pattern: /(?:my goal is|i want to|i aim to|i plan to)\s+(.+)/i, type: 'goal' },
        { pattern: /(?:by|before)\s+(?:the\s+)?(?:end of|next)\s+([A-Za-z]+\s+\d{4})/i, type: 'deadline' },

        // Exam-specific
        { pattern: /(?:my exam is|exam date is|appearing on)\s+(.+)/i, type: 'exam_date' },
        { pattern: /(?:focusing on|concentrating on|prioritizing)\s+(.+)/i, type: 'focus' }
    ];

    for (const { pattern, type } of saveWorthyPatterns) {
        const match = message.match(pattern);
        if (match) {
            return {
                value: match[1].trim(),
                type,
                shouldAskConfirmation: true
            };
        }
    }

    return null;
}

/**
 * Generate a personalized greeting based on user profile
 */
export function generatePersonalizedGreeting(userProfile) {
    if (!userProfile) return "Hello! How can I help you today?";

    const parts = [];
    const name = userProfile.name?.split(' ')[0] || 'there';
    const timeOfDay = getTimeOfDay();

    parts.push(`Good ${timeOfDay}, ${name}!`);

    // Add context based on profile
    if (userProfile.targetExam) {
        const streak = userProfile.statistics?.studyStreak || 0;
        if (streak > 0) {
            parts.push(`🔥 ${streak} day streak! Keep it up!`);
        }

        if (userProfile.examYear) {
            const daysUntilExam = calculateDaysUntilExam(userProfile.examYear);
            if (daysUntilExam > 0 && daysUntilExam < 365) {
                parts.push(`${daysUntilExam} days until ${userProfile.targetExam} ${userProfile.examYear}.`);
            }
        }
    }

    // Suggest based on study patterns
    const currentHour = new Date().getHours();
    const peakHours = userProfile.personalization?.studyPatterns?.preferredTimeOfDay || [];
    const isPeakTime = peakHours.some(h => h.hour === currentHour && h.frequency > 2);

    if (isPeakTime) {
        parts.push("This is usually your productive time! 📚");
    }

    return parts.join(' ');
}

/**
 * Generate context summary for AI about the user
 */
export function generateUserContextSummary(userProfile) {
    if (!userProfile) return '';

    const context = [];

    // Basic info
    if (userProfile.name) {
        context.push(`Name: ${userProfile.name}`);
    }

    // Educational background
    if (userProfile.degree || userProfile.university) {
        const edu = [];
        if (userProfile.degree) edu.push(userProfile.degree);
        if (userProfile.university) edu.push(`from ${userProfile.university}`);
        if (userProfile.year) edu.push(`(${userProfile.year} year)`);
        context.push(`Education: ${edu.join(' ')}`);
    }

    if (userProfile.cgpa) {
        context.push(`CGPA: ${userProfile.cgpa}`);
    }

    // Exam preparation
    if (userProfile.targetExam) {
        const examInfo = [userProfile.targetExam];
        if (userProfile.examYear) examInfo.push(userProfile.examYear);
        context.push(`Target: ${examInfo.join(' ')}`);
    }

    // Study patterns
    const personalization = userProfile.personalization;
    if (personalization) {
        // Communication style
        if (personalization.communicationStyle?.tone) {
            context.push(`Prefers ${personalization.communicationStyle.tone} tone`);
        }

        // Top interests
        if (personalization.topicInterests?.length > 0) {
            const topTopics = personalization.topicInterests
                .sort((a, b) => b.frequency - a.frequency)
                .slice(0, 3)
                .map(t => t.topic);
            context.push(`Favorite topics: ${topTopics.join(', ')}`);
        }

        // Weak areas
        if (personalization.recommendations?.weakAreas?.length > 0) {
            const weakTopics = personalization.recommendations.weakAreas
                .slice(0, 2)
                .map(w => w.topic);
            context.push(`Needs help with: ${weakTopics.join(', ')}`);
        }
    }

    // Goals
    if (userProfile.goals?.shortTerm?.length > 0) {
        const activeGoals = userProfile.goals.shortTerm.filter(g => !g.completed);
        if (activeGoals.length > 0) {
            context.push(`Current goal: ${activeGoals[0].title}`);
        }
    }

    // Learning path
    if (userProfile.learningPath?.currentTopics?.length > 0) {
        const currentTopic = userProfile.learningPath.currentTopics[0];
        context.push(`Currently studying: ${currentTopic.topic} (${currentTopic.completionPercentage}% complete)`);
    }

    return context.join(' | ');
}

/**
 * Check if message is asking about the user's own information
 */
export function isAskingAboutSelf(message) {
    const selfQueryPatterns = [
        /what do you know about me/i,
        /what have i told you/i,
        /what do you remember/i,
        /my profile/i,
        /my information/i,
        /tell me about myself/i,
        /what are my preferences/i,
        /show my data/i
    ];

    return selfQueryPatterns.some(pattern => pattern.test(message));
}

/**
 * Generate a summary of what the AI knows about the user
 */
export function generateKnowledgeSummary(userProfile) {
    if (!userProfile) {
        return "I don't have any information about you yet. Feel free to tell me about yourself!";
    }

    let summary = "📋 Here's what I know about you:\n\n";

    // Personal & Educational
    if (userProfile.name || userProfile.university || userProfile.degree) {
        summary += "**Personal & Education:**\n";
        if (userProfile.name) summary += `- Name: ${userProfile.name}\n`;
        if (userProfile.university) summary += `- University: ${userProfile.university}\n`;
        if (userProfile.degree) summary += `- Degree: ${userProfile.degree}`;
        if (userProfile.year) summary += ` (${userProfile.year} year)`;
        summary += "\n";
        if (userProfile.cgpa) summary += `- CGPA: ${userProfile.cgpa}\n`;
        summary += "\n";
    }

    // Exam Preparation
    if (userProfile.targetExam) {
        summary += "**Exam Preparation:**\n";
        summary += `- Target: ${userProfile.targetExam}`;
        if (userProfile.examYear) summary += ` ${userProfile.examYear}`;
        summary += "\n";

        const stats = userProfile.statistics;
        if (stats) {
            if (stats.studyStreak > 0) summary += `- Study Streak: ${stats.studyStreak} days 🔥\n`;
            if (stats.totalStudyTime > 0) summary += `- Total Study Time: ${Math.round(stats.totalStudyTime / 60)} hours\n`;
        }
        summary += "\n";
    }

    // Learning Progress
    if (userProfile.learningPath?.currentTopics?.length > 0) {
        summary += "**Current Learning:**\n";
        userProfile.learningPath.currentTopics.slice(0, 3).forEach(topic => {
            summary += `- ${topic.topic} (${topic.completionPercentage}% complete)\n`;
        });
        summary += "\n";
    }

    // Preferences
    const personalization = userProfile.personalization;
    if (personalization) {
        summary += "**Your Preferences:**\n";

        if (personalization.communicationStyle?.tone) {
            summary += `- Communication: ${personalization.communicationStyle.tone} tone\n`;
        }
        if (personalization.communicationStyle?.responseLength) {
            summary += `- Response length: ${personalization.communicationStyle.responseLength}\n`;
        }

        if (personalization.topicInterests?.length > 0) {
            const topTopics = personalization.topicInterests
                .sort((a, b) => b.frequency - a.frequency)
                .slice(0, 5)
                .map(t => t.topic);
            summary += `- Favorite topics: ${topTopics.join(', ')}\n`;
        }
        summary += "\n";
    }

    // Goals
    if (userProfile.goals?.shortTerm?.length > 0 || userProfile.goals?.longTerm?.length > 0) {
        summary += "**Your Goals:**\n";
        const activeShortTerm = userProfile.goals.shortTerm?.filter(g => !g.completed) || [];
        const activeLongTerm = userProfile.goals.longTerm?.filter(g => !g.completed) || [];

        activeShortTerm.slice(0, 2).forEach(goal => {
            summary += `- ${goal.title} (${goal.category})\n`;
        });
        activeLongTerm.slice(0, 1).forEach(goal => {
            summary += `- ${goal.title} (long-term)\n`;
        });
        summary += "\n";
    }

    summary += "_💡 I use this information to personalize my responses to your needs!_";

    return summary;
}

// Helper functions
function getTimeOfDay() {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    if (hour < 21) return 'evening';
    return 'night';
}

function calculateDaysUntilExam(examYear) {
    const examDate = new Date(parseInt(examYear), 5, 1); // Assuming June 1st
    const today = new Date();
    const diffTime = examDate - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export default {
    extractEnhancedUserInfo,
    detectEnhancedSaveWorthyInfo,
    generatePersonalizedGreeting,
    generateUserContextSummary,
    isAskingAboutSelf,
    generateKnowledgeSummary
};
