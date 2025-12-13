import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

/**
 * Demo component showing personalized AI responses
 * Demonstrates ChatGPT-like memory and personalization
 */
export default function PersonalizationDemo() {
    const { data: session } = useSession();
    const [userContext, setUserContext] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (session) {
            fetchUserContext();
        }
    }, [session]);

    const fetchUserContext = async () => {
        try {
            // Fetch user profile for personalization
            const res = await fetch('/api/user/profile');
            if (res.ok) {
                const profile = await res.json();
                setUserContext(profile);

                // Show personalized greeting
                const greeting = generateGreeting(profile);
                setMessages([{
                    role: 'assistant',
                    content: greeting,
                    timestamp: new Date()
                }]);
            }
        } catch (error) {
            console.error('Failed to fetch user context:', error);
        }
    };

    const generateGreeting = (profile) => {
        const name = profile.name?.split(' ')[0] || 'there';
        const timeOfDay = getTimeOfDay();

        let greeting = `Good ${timeOfDay}, ${name}! 👋\n\n`;

        if (profile.targetExam) {
            const streak = profile.statistics?.studyStreak || 0;
            greeting += `I see you're preparing for ${profile.targetExam}`;
            if (profile.examYear) greeting += ` ${profile.examYear}`;
            greeting += '.\n\n';

            if (streak > 0) {
                greeting += `🔥 Impressive ${streak}-day study streak! Keep going!\n\n`;
            }
        }

        if (profile.personalization?.topicInterests?.length > 0) {
            const topTopics = profile.personalization.topicInterests
                .sort((a, b) => b.frequency - a.frequency)
                .slice(0, 3)
                .map(t => t.topic);
            greeting += `I noticed you often study ${topTopics.join(', ')}. Want to continue with any of these today?\n\n`;
        }

        if (profile.learningPath?.currentTopics?.length > 0) {
            const current = profile.learningPath.currentTopics[0];
            greeting += `📚 You're ${current.completionPercentage}% done with "${current.topic}". Ready to continue?\n\n`;
        }

        greeting += "How can I help you today?";

        return greeting;
    };

    const sendMessage = async () => {
        if (!inputMessage.trim()) return;

        const userMessage = {
            role: 'user',
            content: inputMessage,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInputMessage('');
        setLoading(true);

        try {
            // Check if asking about themselves
            if (isAskingAboutSelf(inputMessage)) {
                const summary = generateKnowledgeSummary(userContext);
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: summary,
                    timestamp: new Date(),
                    type: 'profile_summary'
                }]);
                setLoading(false);
                return;
            }

            // Send to chat API with personalization
            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: inputMessage,
                    chatId: 'demo_chat',
                    enablePersonalization: true
                })
            });

            if (res.ok) {
                const data = await res.json();
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: data.response,
                    timestamp: new Date(),
                    personalized: true
                }]);
            }
        } catch (error) {
            console.error('Chat error:', error);
        } finally {
            setLoading(false);
        }
    };

    const isAskingAboutSelf = (message) => {
        const patterns = [
            /what do you know about me/i,
            /my profile/i,
            /tell me about myself/i,
            /what are my preferences/i
        ];
        return patterns.some(p => p.test(message));
    };

    const generateKnowledgeSummary = (profile) => {
        if (!profile) return "I don't have any information about you yet.";

        let summary = "📋 **Here's what I know about you:**\n\n";

        if (profile.name) summary += `👤 **Name:** ${profile.name}\n`;
        if (profile.targetExam) {
            summary += `🎯 **Target Exam:** ${profile.targetExam}`;
            if (profile.examYear) summary += ` ${profile.examYear}`;
            summary += '\n';
        }

        if (profile.personalization?.topicInterests?.length > 0) {
            const topics = profile.personalization.topicInterests
                .sort((a, b) => b.frequency - a.frequency)
                .slice(0, 5)
                .map(t => t.topic);
            summary += `\n📚 **Your favorite topics:**\n${topics.map(t => `• ${t}`).join('\n')}\n`;
        }

        if (profile.personalization?.communicationStyle) {
            const style = profile.personalization.communicationStyle;
            summary += `\n💬 **Communication preferences:**\n`;
            if (style.tone) summary += `• Tone: ${style.tone}\n`;
            if (style.responseLength) summary += `• Response length: ${style.responseLength}\n`;
            if (style.prefersExamples) summary += `• Loves examples and real-world applications\n`;
            if (style.prefersStepByStep) summary += `• Prefers step-by-step explanations\n`;
        }

        if (profile.learningPath?.currentTopics?.length > 0) {
            summary += `\n📖 **Currently studying:**\n`;
            profile.learningPath.currentTopics.slice(0, 3).forEach(topic => {
                summary += `• ${topic.topic} (${topic.completionPercentage}% complete)\n`;
            });
        }

        if (profile.statistics?.studyStreak > 0) {
            summary += `\n🔥 **Study Streak:** ${profile.statistics.studyStreak} days!\n`;
        }

        summary += '\n_I use all this information to give you personalized, relevant answers! 🎯_';

        return summary;
    };

    const getTimeOfDay = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'morning';
        if (hour < 17) return 'afternoon';
        if (hour < 21) return 'evening';
        return 'night';
    };

    return (
        <div className="personalization-demo">
            <div className="demo-header">
                <h1>🧠 Personalized AI Chat Demo</h1>
                <p>See how the AI adapts to your profile!</p>
                {userContext && (
                    <div className="context-indicator">
                        ✅ Personalization active for {userContext.name?.split(' ')[0] || 'you'}
                    </div>
                )}
            </div>

            <div className="chat-container">
                <div className="messages">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`message ${msg.role}`}>
                            <div className="message-header">
                                <span className="role">
                                    {msg.role === 'user' ? '👤 You' : '🤖 Indicore AI'}
                                </span>
                                {msg.personalized && <span className="badge">Personalized ✨</span>}
                                {msg.type === 'profile_summary' && <span className="badge">Profile Summary 📋</span>}
                            </div>
                            <div className="message-content">
                                {msg.content.split('\n').map((line, i) => (
                                    <p key={i}>{line}</p>
                                ))}
                            </div>
                            <div className="message-time">
                                {msg.timestamp.toLocaleTimeString()}
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div className="message assistant loading">
                            <div className="typing-indicator">
                                <span></span><span></span><span></span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="input-area">
                    <div className="quick-suggestions">
                        <button onClick={() => setInputMessage('What do you know about me?')}>
                            📋 Show my profile
                        </button>
                        <button onClick={() => setInputMessage('Suggest topics based on my weak areas')}>
                            💡 Get personalized suggestions
                        </button>
                        <button onClick={() => setInputMessage('Create a study plan for me')}>
                            📚 Create my study plan
                        </button>
                    </div>

                    <div className="input-box">
                        <input
                            type="text"
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                            placeholder="Ask me anything... I remember your preferences!"
                        />
                        <button onClick={sendMessage} disabled={!inputMessage.trim() || loading}>
                            Send
                        </button>
                    </div>
                </div>
            </div>

            <style jsx>{`
        .personalization-demo {
          max-width: 900px;
          margin: 0 auto;
          padding: 2rem;
        }

        .demo-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .demo-header h1 {
          font-size: 2rem;
          margin-bottom: 0.5rem;
        }

        .context-indicator {
          display: inline-block;
          background: #e8f5e9;
          color: #2e7d32;
          padding: 0.5rem 1rem;
          border-radius: 20px;
          font-size: 0.9rem;
          margin-top: 1rem;
        }

        .chat-container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          overflow: hidden;
        }

        .messages {
          height: 500px;
          overflow-y: auto;
          padding: 1.5rem;
          background: #f5f5f5;
        }

        .message {
          margin-bottom: 1.5rem;
          padding: 1rem;
          border-radius: 12px;
          max-width: 85%;
        }

        .message.user {
          background: #007bff;
          color: white;
          margin-left: auto;
        }

        .message.assistant {
          background: white;
          border: 1px solid #e0e0e0;
        }

        .message-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
        }

        .role {
          font-weight: 600;
          font-size: 0.9rem;
        }

        .badge {
          background: #ffd700;
          color: #000;
          padding: 0.25rem 0.5rem;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .message-content p {
          margin: 0.5rem 0;
          line-height: 1.6;
        }

        .message-time {
          font-size: 0.75rem;
          opacity: 0.6;
          margin-top: 0.5rem;
        }

        .typing-indicator {
          display: flex;
          gap: 0.25rem;
        }

        .typing-indicator span {
          width: 8px;
          height: 8px;
          background: #999;
          border-radius: 50%;
          animation: typing 1.4s infinite;
        }

        .typing-indicator span:nth-child(2) {
          animation-delay: 0.2s;
        }

        .typing-indicator span:nth-child(3) {
          animation-delay: 0.4s;
        }

        @keyframes typing {
          0%, 60%, 100% { opacity: 0.3; }
          30% { opacity: 1; }
        }

        .input-area {
          padding: 1rem;
          background: white;
          border-top: 1px solid #e0e0e0;
        }

        .quick-suggestions {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1rem;
          flex-wrap: wrap;
        }

        .quick-suggestions button {
          padding: 0.5rem 1rem;
          background: #f0f0f0;
          border: 1px solid #ddd;
          border-radius: 20px;
          cursor: pointer;
          font-size: 0.85rem;
          transition: all 0.2s;
        }

        .quick-suggestions button:hover {
          background: #e0e0e0;
        }

        .input-box {
          display: flex;
          gap: 0.5rem;
        }

        .input-box input {
          flex: 1;
          padding: 0.75rem 1rem;
          border: 1px solid #ddd;
          border-radius: 24px;
          font-size: 1rem;
        }

        .input-box button {
          padding: 0.75rem 2rem;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 24px;
          cursor: pointer;
          font-weight: 600;
          transition: background 0.2s;
        }

        .input-box button:hover:not(:disabled) {
          background: #0056b3;
        }

        .input-box button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
        </div>
    );
}
