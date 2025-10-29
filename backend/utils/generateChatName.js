module.exports = async function generateChatName(firstMessage) {
  if (!firstMessage) return 'New Chat';
  const trimmed = String(firstMessage).trim();
  if (trimmed.length <= 30) return trimmed || 'New Chat';
  return `${trimmed.slice(0, 30)}...`;
};


