import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';

const MAX_SNIPPET_LENGTH = 320;

function sanitizeText(text = '', limit = MAX_SNIPPET_LENGTH) {
  if (!text || typeof text !== 'string') return '';
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit).trim()}…`;
}

function deriveTitle(text = '') {
  if (!text || typeof text !== 'string') return 'Recent Conversation';
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'Recent Conversation';
  const words = cleaned.split(' ').slice(0, 12).join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function extractKeyPoints(response = '') {
  if (!response || typeof response !== 'string') return [];
  const bullets = [];
  const bulletMatches = response.match(/(?:^|\n)\s*(?:[-*•]|\d+\.)\s*(.+)/g);
  if (bulletMatches) {
    for (const line of bulletMatches) {
      const cleaned = line.replace(/(?:^|\n)\s*(?:[-*•]|\d+\.)\s*/, '').trim();
      if (cleaned) bullets.push(cleaned);
      if (bullets.length >= 3) break;
    }
  }

  if (bullets.length === 0) {
    const sentences = response
      .replace(/\s+/g, ' ')
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(Boolean);
    return sentences.slice(0, 3);
  }

  return bullets.slice(0, 3);
}

export function buildConversationMemoryPrompt(summaries = [], limit = 5) {
  if (!Array.isArray(summaries) || summaries.length === 0) return '';
  const sorted = [...summaries]
    .filter(entry => entry && (entry.summary || entry.title))
    .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
    .slice(0, limit);

  if (!sorted.length) return '';

  const sections = sorted.map((entry, idx) => {
    const title = entry.title || `Conversation ${idx + 1}`;
    const summary = entry.summary || entry.userMessage || 'Context unavailable.';
    const keyPoints = Array.isArray(entry.keyPoints) ? entry.keyPoints.filter(Boolean) : [];
    const formattedPoints = keyPoints.length > 0
      ? `\n   • ${keyPoints.join('\n   • ')}`
      : '';
    return `${idx + 1}. ${title}\n   Summary: ${summary}${formattedPoints}`;
  });

  return sections.join('\n\n');
}

export async function saveConversationMemory({
  userEmail,
  chatId,
  userMessage,
  assistantResponse
}) {
  if (!userEmail || !userMessage || !assistantResponse) {
    return null;
  }

  try {
    await connectToDatabase();
    const user = await User.findOne({ email: userEmail });
    if (!user) return null;

    user.profile = user.profile || {};
    const summaries = Array.isArray(user.profile.conversationSummaries)
      ? user.profile.conversationSummaries.filter(Boolean)
      : [];

    const entry = {
      chatId: chatId ? String(chatId) : undefined,
      title: deriveTitle(userMessage),
      summary: sanitizeText(assistantResponse, 260),
      keyPoints: extractKeyPoints(assistantResponse),
      userMessage: sanitizeText(userMessage, 200),
      assistantSummary: sanitizeText(assistantResponse, 300),
      timestamp: new Date()
    };

    const filtered = summaries.filter(existing => {
      if (!existing) return false;
      if (entry.chatId && existing.chatId) {
        return existing.chatId !== entry.chatId;
      }
      return true;
    });

    filtered.unshift(entry);
    user.profile.conversationSummaries = filtered.slice(0, 8);
    user.profile.lastUpdated = new Date();

    await user.save();
    return user.profile.conversationSummaries;
  } catch (error) {
    console.warn('[ConversationMemory] Failed to save memory:', error.message);
    return null;
  }
}

