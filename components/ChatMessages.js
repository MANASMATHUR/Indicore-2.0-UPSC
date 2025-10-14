'use client';

export default function ChatMessages({ messages = [], isLoading = false, messagesEndRef }) {
  if (!messages.length && !isLoading) {
    return (
      <div className="flex-1 p-6 bg-gray-50 dark:bg-slate-800/50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🤖</div>
          <h3 className="text-xl font-semibold text-gray-800 dark:text-slate-100 mb-2">
            Welcome to Indicore AI!
          </h3>
          <p className="text-gray-600 dark:text-slate-300 max-w-md">
            I'm your multilingual AI assistant. I can help you with questions in multiple languages 
            and remember our conversations. Start by typing a message below!
          </p>
        </div>
      </div>
    );
  }

  const cleanText = (text) => {
    if (!text) return '';
    return text
      .replace(/\[\d+\]/g, '')          
      .replace(/\*\*(.*?)\*\*/g, '$1')  
      .replace(/\*(.*?)\*/g, '$1');     
  };

  return (
    <div className="flex-1 p-6 bg-gray-50 dark:bg-slate-800/50 overflow-y-auto messages">
      <div className="space-y-3">
        {messages.map((message, index) => {
          const sender = message?.sender || message?.role || 'assistant';
          const text = message?.text || message?.content || '';
          const ts = message?.timestamp ? new Date(message.timestamp) : null;
          const timeStr = ts && !isNaN(ts) ? ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

          return (
            <div key={index} className={`message ${sender === 'user' ? 'user' : 'assistant'}`}>
              <div className="message-content">
                {cleanText(text)}
                {timeStr && (
                  <div className={`mt-1 text-[10px] opacity-70 ${sender === 'user' ? 'text-white' : 'text-gray-500 dark:text-slate-400'}`}>
                    {timeStr}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="message assistant">
            <div className="message-content">
              <div className="flex items-center gap-2">
                <div className="animate-pulse-slow flex space-x-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-sm text-gray-500 dark:text-slate-400">AI is thinking...</span>
              </div>
            </div>
          </div>
        )}
      </div>
      <div ref={messagesEndRef} />
    </div>
  );
}
