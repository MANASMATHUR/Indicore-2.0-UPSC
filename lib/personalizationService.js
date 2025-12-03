/**
 * Personalization Service
 * Analyzes user behavior and generates personalized chatbot experiences
 */

import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import Chat from '@/models/Chat';

/**
 * Extract topic from user message
 */
function extractTopic(message) {
  if (!message || typeof message !== 'string') return null;

  const lowerMessage = message.toLowerCase();

  // Topic keywords mapping
  const topicMap = {
    'Polity': ['polity', 'constitution', 'parliament', 'president', 'prime minister', 'judiciary', 'fundamental rights', 'directive principles', 'amendment', 'article'],
    'History': ['history', 'ancient', 'medieval', 'modern', 'independence', 'freedom struggle', 'british', 'mauryan', 'gupta', 'mughal', 'vijayanagara'],
    'Geography': ['geography', 'physical', 'climate', 'rivers', 'mountains', 'monsoon', 'agriculture', 'soil', 'vegetation', 'natural resources'],
    'Economics': ['economics', 'economy', 'gdp', 'inflation', 'fiscal', 'monetary', 'budget', 'banking', 'finance', 'trade', 'market'],
    'Science': ['science', 'physics', 'chemistry', 'biology', 'technology', 'space', 'nuclear', 'renewable', 'energy', 'medicine', 'health'],
    'Environment': ['environment', 'climate change', 'pollution', 'conservation', 'biodiversity', 'forest', 'wildlife', 'sustainable', 'renewable'],
    'Current Affairs': ['current affairs', 'news', 'recent', 'latest', 'scheme', 'policy', 'government', 'initiative', 'program']
  };

  for (const [topic, keywords] of Object.entries(topicMap)) {
    if (keywords.some(keyword => lowerMessage.includes(keyword))) {
      return topic;
    }
  }

  return 'General';
}

/**
 * Analyze user's communication style from messages
 */
function analyzeCommunicationStyle(messages) {
  if (!messages || messages.length === 0) return null;

  const userMessages = messages
    .filter(msg => msg.sender === 'user' || msg.role === 'user')
    .map(msg => msg.text || msg.content || '')
    .filter(text => text.length > 0);

  if (userMessages.length === 0) return null;

  const allText = userMessages.join(' ').toLowerCase();

  // Analyze tone
  const formalIndicators = ['please', 'kindly', 'would you', 'could you', 'thank you', 'sir', 'madam'];
  const casualIndicators = ['hey', 'hi', 'what\'s up', 'cool', 'awesome', 'yeah', 'yep'];
  const friendlyIndicators = ['thanks', 'appreciate', 'help', 'great', 'love', 'enjoy'];

  let tone = 'friendly'; // default
  const formalCount = formalIndicators.filter(ind => allText.includes(ind)).length;
  const casualCount = casualIndicators.filter(ind => allText.includes(ind)).length;
  const friendlyCount = friendlyIndicators.filter(ind => allText.includes(ind)).length;

  if (formalCount > casualCount && formalCount > friendlyCount) tone = 'formal';
  else if (casualCount > friendlyCount) tone = 'casual';
  else if (friendlyCount > 0) tone = 'friendly';

  // Analyze message length preferences
  const avgUserLength = userMessages.reduce((sum, msg) => sum + msg.length, 0) / userMessages.length;
  let responseLength = 'moderate';
  if (avgUserLength < 30) responseLength = 'concise';
  else if (avgUserLength > 100) responseLength = 'detailed';

  // Analyze question types
  const questionPatterns = {
    'what': /what/i,
    'how': /how/i,
    'why': /why/i,
    'explain': /explain/i,
    'example': /example|instance|case/i,
    'step': /step|process|procedure/i
  };

  const prefersExamples = questionPatterns.example.test(allText);
  const prefersStepByStep = questionPatterns.step.test(allText);

  return {
    tone,
    responseLength,
    prefersExamples,
    prefersStepByStep
  };
}

/**
 * Update user personalization based on conversation
 */
export async function updateUserPersonalization(userEmail, message, response, chatId) {
  const MAX_RETRIES = 3;
  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      await connectToDatabase();
      const user = await User.findOne({ email: userEmail });
      if (!user) return null;

      // Initialize personalization if not exists
      if (!user.profile.personalization) {
        user.profile.personalization = {
          communicationStyle: {},
          topicInterests: [],
          studyPatterns: {},
          interactionPatterns: {},
          learningPreferences: {},
          recommendations: {}
        };
      }

      const personalization = user.profile.personalization;

      // Extract and update topic interests
      const topic = extractTopic(message);
      if (topic && topic !== 'General') {
        const existingTopic = personalization.topicInterests.find(t => t.topic === topic);
        if (existingTopic) {
          existingTopic.frequency += 1;
          existingTopic.lastAsked = new Date();
          // Increase engagement score if response was long (user likely engaged)
          if (response && response.length > 200) {
            existingTopic.engagementScore += 1;
          }
        } else {
          personalization.topicInterests.push({
            topic,
            category: topic,
            frequency: 1,
            lastAsked: new Date(),
            engagementScore: response && response.length > 200 ? 1 : 0
          });
        }
        // Keep only top 20 topics
        personalization.topicInterests = personalization.topicInterests
          .sort((a, b) => b.frequency - a.frequency)
          .slice(0, 20);
      }

      // Update study patterns - track time of day
      const currentHour = new Date().getHours();
      if (!personalization.studyPatterns.preferredTimeOfDay) {
        personalization.studyPatterns.preferredTimeOfDay = [];
      }
      const timeSlot = personalization.studyPatterns.preferredTimeOfDay.find(t => t.hour === currentHour);
      if (timeSlot) {
        timeSlot.frequency += 1;
      } else {
        personalization.studyPatterns.preferredTimeOfDay.push({ hour: currentHour, frequency: 1 });
      }

      // Analyze communication style from recent conversations
      try {
        const recentChats = await Chat.find({ userEmail })
          .sort({ lastMessageAt: -1 })
          .limit(5)
          .select('messages')
          .lean();

        const allMessages = [];
        recentChats.forEach(chat => {
          if (chat.messages && Array.isArray(chat.messages)) {
            allMessages.push(...chat.messages);
          }
        });

        if (allMessages.length > 0) {
          const style = analyzeCommunicationStyle(allMessages);
          if (style) {
            personalization.communicationStyle = {
              ...personalization.communicationStyle,
              ...style
            };
          }
        }
      } catch (err) {
        console.warn('Error analyzing communication style:', err.message);
      }

      // Update interaction patterns
      if (!personalization.interactionPatterns.averageMessagesPerSession) {
        personalization.interactionPatterns.averageMessagesPerSession = 0;
      }

      // Check for follow-up questions (messages that are short and ask for clarification)
      const isFollowUp = message.length < 50 && (
        message.toLowerCase().includes('what') ||
        message.toLowerCase().includes('how') ||
        message.toLowerCase().includes('why') ||
        message.toLowerCase().includes('explain') ||
        message.toLowerCase().includes('more')
      );
      if (isFollowUp) {
        personalization.interactionPatterns.followUpFrequency += 1;
      }

      personalization.lastAnalyzed = new Date();
      user.profile.lastUpdated = new Date();

      await user.save();
      return personalization;
    } catch (error) {
      if (error.name === 'VersionError' && retries < MAX_RETRIES - 1) {
        retries++;
        // Add a small random delay to reduce contention
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 100));
        continue;
      }
      console.error('Error updating user personalization:', error);
      return null;
    }
  }
}

/**
 * Generate personalized system prompt additions
 */
export function generatePersonalizedPrompt(userProfile) {
  if (!userProfile || !userProfile.personalization) {
    return '';
  }

  const personalization = userProfile.personalization;
  const promptParts = [];

  // Communication style personalization
  if (personalization.communicationStyle) {
    const style = personalization.communicationStyle;

    if (style.tone) {
      promptParts.push(`- Communication Tone: The user prefers a ${style.tone} communication style. Match their tone naturally.`);
    }

    if (style.responseLength) {
      const lengthGuidance = {
        'concise': 'Keep responses brief and to the point. Focus on key information only.',
        'moderate': 'Provide balanced responses with essential information and some context.',
        'detailed': 'Provide comprehensive responses with thorough explanations and context.',
        'comprehensive': 'Provide in-depth, exhaustive responses covering all aspects of the topic.'
      };
      promptParts.push(`- Response Length: ${lengthGuidance[style.responseLength] || lengthGuidance.moderate}`);
    }

    if (style.prefersExamples === true) {
      promptParts.push(`- Examples: The user appreciates examples and real-world applications. Include relevant examples when explaining concepts.`);
    }

    if (style.prefersStepByStep === true) {
      promptParts.push(`- Step-by-step: The user prefers step-by-step explanations. Break down complex topics into clear, sequential steps.`);
    }
  }

  // Topic interests
  if (personalization.topicInterests && personalization.topicInterests.length > 0) {
    const topTopics = personalization.topicInterests
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5)
      .map(t => t.topic);

    if (topTopics.length > 0) {
      promptParts.push(`- User's Top Interests: The user frequently asks about ${topTopics.join(', ')}. When relevant, connect topics to these areas of interest.`);
    }
  }

  // Learning preferences
  if (personalization.learningPreferences) {
    const prefs = personalization.learningPreferences;

    if (prefs.preferredFormat) {
      const formatGuidance = {
        'structured': 'Use clear headings, bullet points, and organized sections.',
        'conversational': 'Use a natural, flowing conversation style with paragraphs.',
        'bullet_points': 'Prefer bullet points and lists for clarity.',
        'paragraphs': 'Use paragraph format for detailed explanations.',
        'mixed': 'Use a combination of formats as appropriate.'
      };
      promptParts.push(`- Response Format: ${formatGuidance[prefs.preferredFormat] || formatGuidance.mixed}`);
    }

    if (prefs.difficultyLevel) {
      const difficultyGuidance = {
        'beginner': 'Explain concepts from the basics, use simple language, and provide foundational context.',
        'intermediate': 'Assume some prior knowledge but explain key concepts clearly.',
        'advanced': 'You can use technical terminology and assume deeper knowledge, but still explain complex ideas clearly.'
      };
      promptParts.push(`- Difficulty Level: ${difficultyGuidance[prefs.difficultyLevel] || difficultyGuidance.intermediate}`);
    }
  }

  // Weak areas (if identified)
  if (personalization.recommendations && personalization.recommendations.weakAreas && personalization.recommendations.weakAreas.length > 0) {
    const weakAreas = personalization.recommendations.weakAreas
      .slice(0, 3)
      .map(area => area.topic)
      .join(', ');
    promptParts.push(`- Areas for Improvement: The user may need extra support in ${weakAreas}. Provide additional context and examples when discussing these topics.`);
  }

  if (promptParts.length === 0) {
    return '';
  }

  return `\n\nPERSONALIZATION - ADAPT TO THIS USER'S PREFERENCES:\n${promptParts.join('\n')}\n\nUse these preferences to tailor your responses while maintaining high quality and exam relevance.`;
}

/**
 * Get personalized recommendations for user
 */
export async function getPersonalizedRecommendations(userEmail) {
  try {
    await connectToDatabase();
    const user = await User.findOne({ email: userEmail });
    if (!user || !user.profile.personalization) {
      return [];
    }

    const personalization = user.profile.personalization;
    const recommendations = [];

    // Recommend topics based on interests
    if (personalization.topicInterests && personalization.topicInterests.length > 0) {
      const topTopics = personalization.topicInterests
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 3);

      topTopics.forEach(topic => {
        recommendations.push({
          type: 'continue_studying',
          topic: topic.topic,
          reason: `You've shown strong interest in ${topic.topic}. Consider exploring related subtopics.`,
          priority: topic.frequency
        });
      });
    }

    // Recommend weak areas to focus on
    if (personalization.recommendations && personalization.recommendations.weakAreas) {
      personalization.recommendations.weakAreas.forEach(area => {
        recommendations.push({
          type: 'improve',
          topic: area.topic,
          reason: `Focus on ${area.topic} to strengthen your preparation.`,
          priority: 5
        });
      });
    }

    return recommendations.sort((a, b) => b.priority - a.priority);
  } catch (error) {
    console.error('Error getting personalized recommendations:', error);
    return [];
  }
}

/**
 * Identify weak areas from conversation patterns
 */
export async function identifyWeakAreas(userEmail) {
  try {
    await connectToDatabase();
    const user = await User.findOne({ email: userEmail });
    if (!user) return;

    // Get recent chats and analyze for patterns
    const recentChats = await Chat.find({ userEmail })
      .sort({ lastMessageAt: -1 })
      .limit(20)
      .select('messages')
      .lean();

    // Analyze topics where user asks many follow-up questions (indicating difficulty)
    const topicDifficulty = {};

    recentChats.forEach(chat => {
      if (!chat.messages || !Array.isArray(chat.messages)) return;

      let currentTopic = null;
      let followUpCount = 0;

      chat.messages.forEach((msg, idx) => {
        if (msg.sender === 'user') {
          const topic = extractTopic(msg.text || '');
          if (topic && topic !== 'General') {
            if (currentTopic === topic) {
              followUpCount++;
            } else {
              currentTopic = topic;
              followUpCount = 1;
            }

            if (!topicDifficulty[topic]) {
              topicDifficulty[topic] = { followUps: 0, total: 0 };
            }
            topicDifficulty[topic].total += 1;
            if (followUpCount > 2) {
              topicDifficulty[topic].followUps += 1;
            }
          }
        }
      });
    });

    // Identify weak areas (topics with high follow-up frequency)
    const weakAreas = Object.entries(topicDifficulty)
      .filter(([topic, data]) => data.followUps > 2 && data.total > 3)
      .map(([topic, data]) => ({
        topic,
        identifiedAt: new Date(),
        improvementSuggestions: [
          `Review fundamental concepts in ${topic}`,
          `Practice more questions related to ${topic}`,
          `Focus on understanding the basics before moving to advanced topics`
        ]
      }));

    if (weakAreas.length > 0 && user.profile.personalization) {
      if (!user.profile.personalization.recommendations) {
        user.profile.personalization.recommendations = {};
      }
      user.profile.personalization.recommendations.weakAreas = weakAreas.slice(0, 5);
      await user.save();
    }
  } catch (error) {
    console.error('Error identifying weak areas:', error);
  }
}

