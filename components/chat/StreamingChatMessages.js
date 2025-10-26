'use client';

import { useState, useEffect, memo } from 'react';
import Button from '../ui/Button';
import speechService from '@/lib/speechService';
import Badge from '../ui/Badge';
import errorHandler from '@/lib/errorHandler';
import { validateInput } from '@/lib/validation';
import { useLoadingState, LoadingStates, StatusIndicator } from '@/lib/loadingStates';

const supportedLanguages = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'Hindi' },
  { code: 'mr', name: 'Marathi' },
  { code: 'ta', name: 'Tamil' },
  { code: 'bn', name: 'Bengali' },
  { code: 'pa', name: 'Punjabi' },
  { code: 'gu', name: 'Gujarati' },
  { code: 'te', name: 'Telugu' },
  { code: 'ml', name: 'Malayalam' },
  { code: 'kn', name: 'Kannada' },
];

const StreamingChatMessages = memo(({ messages = [], isLoading = false, messagesEndRef, streamingMessage = null }) => {
  const [translatingMessage, setTranslatingMessage] = useState(null);
  const [translatedText, setTranslatedText] = useState({});
  const translationLoading = useLoadingState();

  const handleTranslate = async (messageIndex, targetLang) => {
    const message = messages[messageIndex];
    const text = message?.text || message?.content || '';
    
    if (!text.trim()) return;

    try {
      // Enterprise input validation
      const validation = validateInput('chatMessage', text);
      if (!validation.isValid) {
        const error = validation.errors[0];
        console.error('Translation validation failed:', error.message);
        return;
      }

      translationLoading.setLoading('Translating message...', 0);
      setTranslatingMessage(messageIndex);
      
      translationLoading.updateProgress(30, 'Sending translation request...');
      
      const response = await fetch('/api/ai/translate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRF-Token': sessionStorage.getItem('csrfToken') || ''
        },
        body: JSON.stringify({
          text: validation.value,
          sourceLanguage: 'auto',
          targetLanguage: targetLang,
          isStudyMaterial: true
        }),
      });

      translationLoading.updateProgress(70, 'Processing translation...');

      if (!response.ok) {
        throw new Error(`Translation API failed: ${response.status} ${response.statusText}`);
      }

        const data = await response.json();
      
      translationLoading.updateProgress(90, 'Finalizing translation...');
      
        setTranslatedText(prev => ({
          ...prev,
          [`${messageIndex}-${targetLang}`]: data.translatedText
        }));
      
      translationLoading.setSuccess('Translation completed');
      
    } catch (error) {
      // Enterprise error handling
      const errorResult = errorHandler.handleChatError(error, {
        type: 'streaming_translation_error',
        messageIndex,
        targetLang,
        textLength: text.length
      });
      
      translationLoading.setError(errorResult.userMessage || 'Translation failed');
      
      // Log error for monitoring
      errorHandler.logError(error, {
        type: 'streaming_translation_error',
        messageIndex,
        targetLang,
        textLength: text.length
      }, 'warning');
      
    } finally {
      setTranslatingMessage(null);
    }
  };

  if (!messages.length && !isLoading && !streamingMessage) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-2xl">
          <div className="text-6xl mb-6">🤖</div>
          <h3 className="text-2xl font-semibold text-red-900 dark:text-gray-100 mb-4">
            Welcome to Indicore AI!
          </h3>
          <p className="text-red-700 dark:text-gray-300 text-lg leading-relaxed">
            I'm your multilingual AI assistant. I can help you with questions in multiple languages 
            and remember our conversations. Start by typing a message below!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto messages" style={{ minHeight: 'calc(100vh - 200px)' }}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {messages.map((message, index) => (
          <MessageItem
            key={index}
            message={message}
            index={index}
            onTranslate={handleTranslate}
            translatingMessage={translatingMessage}
            translatedText={translatedText}
          />
        ))}

        {/* Streaming Message */}
        {streamingMessage && (
          <div className="message assistant mb-8">
            <div className="message-content">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                  AI is responding...
                </span>
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            <div className="whitespace-pre-wrap break-words">
                {streamingMessage}
                <span className="animate-pulse">|</span>
              </div>
            </div>
          </div>
        )}

        {/* Loading Message */}
        {isLoading && !streamingMessage && <LoadingMessage />}
      </div>
      <div ref={messagesEndRef} />
    </div>
  );
});

const MessageItem = memo(({ 
  message, 
  index, 
  onTranslate, 
  translatingMessage, 
  translatedText 
}) => {
  const sender = message?.sender || message?.role || 'assistant';
  const text = message?.text || message?.content || '';
  const ts = message?.timestamp ? new Date(message.timestamp) : null;
  const timeStr = ts && !isNaN(ts) ? ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const isTranslating = translatingMessage === index;

  const cleanText = (text) => text || '';

  return (
    <div className={`message ${sender === 'user' ? 'user' : 'assistant'} mb-8`}>
      <div className="message-content">
        {cleanText(text)}
        
        {/* Translation dropdown for AI messages */}
        {sender === 'assistant' && text.trim() && (
          <div className="mt-4">
            <select
              onChange={(e) => {
                if (e.target.value) {
                  onTranslate(index, e.target.value);
                  e.target.value = ''; // Reset selection
                }
              }}
              disabled={isTranslating}
              className="text-xs px-3 py-2 bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200 rounded-md border border-red-200 dark:border-red-700 hover:bg-red-200 dark:hover:bg-red-700 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed font-medium cursor-pointer"
            >
              <option value="">🌐 Translate to...</option>
              {supportedLanguages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Show translated text if available */}
        {Object.keys(translatedText).map(key => {
          if (key.startsWith(`${index}-`)) {
            const langCode = key.split('-')[1];
            const langName = supportedLanguages.find(l => l.code === langCode)?.name;
            return (
              <TranslationResult
                key={key}
                text={translatedText[key]}
                language={langName}
                langCode={langCode}
              />
            );
          }
          return null;
        })}

        {timeStr && (
          <div className={`mt-2 text-xs opacity-60 ${sender === 'user' ? 'text-red-600' : 'text-red-600 dark:text-gray-400'}`}>
            {timeStr}
          </div>
        )}
      </div>
    </div>
  );
});

const TranslationResult = memo(({ text, language, langCode }) => {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleSpeak = async () => {
    try {
      console.log('StreamingTranslationResult - Speech Request:', {
        text: text.substring(0, 100) + '...',
        language,
        langCode,
        textLength: text.length
      });

      const validation = validateInput('multilingualText', text);
      if (!validation.isValid) {
        const error = validation.errors[0];
        console.error('Speech validation failed:', error.message);
        return;
      }

      setIsSpeaking(true);
      
      console.log('Translation Speech Debug:', {
        originalText: text.substring(0, 100) + '...',
        cleanedText: validation.value.substring(0, 100) + '...',
        language: language,
        langCode: langCode,
        textLength: text.length
      });
      
      await speechService.speak(validation.value, langCode, {
        rate: 0.9,
        pitch: 1.0,
        volume: 1.0
      });
      
    } catch (error) {
      console.error('Speech synthesis error in translation:', error);
    } finally {
      setIsSpeaking(false);
    }
  };

  return (
    <div className="mt-4 p-4 bg-red-100 dark:bg-gray-800/50 border border-red-200 dark:border-gray-700 rounded-lg shadow-sm dark:shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-red-700 dark:text-gray-300 font-medium">
          Translated to {language}:
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSpeak}
          disabled={isSpeaking}
          className={`text-xs px-3 py-1.5 bg-red-200 dark:bg-red-800 text-red-700 dark:text-red-200 rounded-md hover:bg-red-300 dark:hover:bg-red-700 transition-colors duration-150 font-medium shadow-sm ${isSpeaking ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isSpeaking ? '🔊 Speaking...' : '🔊 Speak'}
        </Button>
      </div>
      <div className="text-sm text-red-800 dark:text-gray-200 leading-relaxed">
        {text}
      </div>
    </div>
  );
});

const LoadingMessage = memo(() => (
  <div className="message assistant mb-8">
    <div className="message-content">
      <div className="flex items-center gap-3">
        <div className="animate-pulse-slow flex space-x-1">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>
        <span className="text-sm text-red-600 dark:text-gray-400">AI is thinking...</span>
      </div>
    </div>
  </div>
));

StreamingChatMessages.displayName = 'StreamingChatMessages';
MessageItem.displayName = 'MessageItem';
TranslationResult.displayName = 'TranslationResult';
LoadingMessage.displayName = 'LoadingMessage';

export default StreamingChatMessages;
