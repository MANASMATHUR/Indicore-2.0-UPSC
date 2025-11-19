'use client';

import { useState, useEffect, memo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Button from '../ui/Button';
import speechService from '@/lib/speechService';
import { Badge } from '../ui/Badge';
import errorHandler from '@/lib/errorHandler';
import { validateInput } from '@/lib/validation';
import { useLoadingState, LoadingStates, StatusIndicator } from '@/lib/loadingStates';
import { useToast } from '../ui/ToastProvider';
import { sanitizeTranslationOutput } from '@/lib/translationUtils';
import { stripMarkdown, supportedLanguages } from '@/lib/messageUtils';

const StreamingChatMessages = memo(({ messages = [], isLoading = false, messagesEndRef, streamingMessage = null, onRegenerate, onPromptClick, searchQuery = '', onBookmark, onEdit, onDelete }) => {
  const [translatingMessage, setTranslatingMessage] = useState(null);
  const [translatedText, setTranslatedText] = useState({});
  const translationLoading = useLoadingState();
  const { showToast } = useToast();

  const handleTranslate = async (messageIndex, targetLang) => {
    const message = messages[messageIndex];
    if (!message) {
      showToast('Message not found', { type: 'error' });
      return;
    }
    
    let text = message?.text || message?.content || '';
    if (!text.trim()) {
      showToast('No text found to translate', { type: 'error' });
      return;
    }

    try {
      text = stripMarkdown(text);
    } catch (e) {
    }
    
    if (!text?.trim()) {
      showToast('No text to translate', { type: 'error' });
      return;
    }

    try {
      const validation = validateInput('multilingualText', text);
      if (!validation?.isValid) {
        const error = validation?.errors?.[0];
        showToast(`Translation failed: ${error?.message || 'Invalid input'}`, { type: 'error' });
        return;
      }

      if (!validation.value) {
        showToast('No text to translate', { type: 'error' });
        return;
      }
      
      translationLoading?.setLoading?.('Translating...', 0);
      setTranslatingMessage(messageIndex);
      
      const response = await fetch('/api/ai/translate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRF-Token': (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('csrfToken') : null) || ''
        },
        body: JSON.stringify({
          text: validation.value,
          sourceLanguage: 'auto',
          targetLanguage: targetLang,
          isStudyMaterial: true
        }),
      });

      translationLoading?.updateProgress?.(70, 'Processing...');

      if (!response.ok) {
        let errorMsg = `Translation failed: ${response.status}`;
        try {
          const err = await response.json();
          errorMsg = err.error || err.message || errorMsg;
        } catch (e) {
          const txt = await response.text().catch(() => '');
          if (txt) errorMsg = txt.substring(0, 200);
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      if (!data?.translatedText) {
        throw new Error('Invalid translation response');
      }
      
      translationLoading?.updateProgress?.(90);
      
      setTranslatedText(prev => ({
        ...prev,
        [`${messageIndex}-${targetLang}`]: data.translatedText
      }));
      
      translationLoading?.setSuccess?.('Done');
      
    } catch (error) {
      const errorMsg = errorHandler?.handleChatError?.(error, {
        type: 'streaming_translation_error',
        messageIndex,
        targetLang
      })?.userMessage || error?.message || 'Translation failed';
      
      translationLoading?.setError?.(errorMsg);
      showToast(errorMsg, { type: 'error' });
      errorHandler?.logError?.(error, { type: 'streaming_translation_error' }, 'warning');
    } finally {
      setTranslatingMessage(null);
    }
  };

  if (!messages.length && !isLoading && !streamingMessage) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 min-h-full">
        <div className="text-center max-w-2xl animate-fade-in">
          <div className="relative mb-8">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-32 h-32 bg-gradient-to-br from-red-400 to-orange-500 rounded-full blur-3xl opacity-20 animate-pulse"></div>
            </div>
            <div className="relative text-7xl mb-6">🎓</div>
          </div>
          <h3 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Welcome to Indicore
          </h3>
          <p className="text-gray-700 dark:text-gray-300 text-lg leading-relaxed mb-6">
            Your intelligent assistant for PCS, UPSC, and SSC exams
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 hover:shadow-md transition-shadow">
              <div className="text-sm font-semibold text-gray-900 dark:text-slate-200 mb-1">Multilingual Support</div>
              <div className="text-xs text-gray-600 dark:text-slate-400">Support for 10+ languages</div>
            </div>
            <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 hover:shadow-md transition-shadow">
              <div className="text-sm font-semibold text-gray-900 dark:text-slate-200 mb-1">PYQ Database</div>
              <div className="text-xs text-gray-600 dark:text-slate-400">Previous year questions</div>
            </div>
            <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 hover:shadow-md transition-shadow">
              <div className="text-sm font-semibold text-gray-900 dark:text-slate-200 mb-1">Web Search</div>
              <div className="text-xs text-gray-600 dark:text-slate-400">Up-to-date information</div>
            </div>
          </div>
          {/* Suggested Prompts */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl mx-auto">
            {[
              "What is the UPSC syllabus for 2025?",
              "Give me notes on Indian History",
              "Search UPSC PYQs for Geography",
              "Translate this to Hindi: Modern History",
              "Explain the Indian Constitution",
              "What are the best books for UPSC preparation?"
            ].map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => onPromptClick && onPromptClick(prompt)}
                className="px-4 py-3 text-left bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 border border-red-200/50 dark:border-slate-700/50 rounded-xl text-sm text-red-900 dark:text-slate-200 hover:border-red-400 dark:hover:border-red-600 hover:shadow-md transition-all duration-200 backdrop-blur-sm"
              >
                {prompt}
              </button>
            ))}
          </div>
          <p className="text-gray-600 dark:text-slate-400 text-sm mt-6">
            Start by typing a message below or click a suggestion above
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto messages" style={{ minHeight: 'calc(100vh - 200px)' }}>
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        {messages.map((message, index) => (
          <MessageItem
            key={index}
            message={message}
            index={index}
            onTranslate={handleTranslate}
            translatingMessage={translatingMessage}
            translatedText={translatedText}
            onRegenerate={onRegenerate}
            onPromptClick={onPromptClick}
            messages={messages}
            searchQuery={searchQuery}
            onBookmark={onBookmark}
            onEdit={onEdit}
            onDelete={onDelete}
            isBookmarked={message.bookmarked || false}
          />
        ))}

        {/* Streaming Message */}
        {streamingMessage && streamingMessage.trim().length > 0 && (
          <div className="message assistant mb-4 flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center text-white text-sm font-semibold shadow-md ring-2 ring-red-100 dark:ring-red-900/50">
              🎓
            </div>
            <div className="message-content relative rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-md flex-1 px-4 py-3 sm:px-5 sm:py-4 min-w-0">
              <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-semibold prose-strong:font-semibold prose-strong:text-inherit prose-sm sm:prose-base">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => <p className="mb-3 last:mb-0 leading-7 text-slate-700 dark:text-slate-200 text-[15px]">{children}</p>,
                    strong: ({ children }) => <strong className="font-semibold text-slate-900 dark:text-slate-50">{children}</strong>,
                    em: ({ children }) => <em className="italic text-slate-700 dark:text-slate-300">{children}</em>,
                    ul: ({ children }) => <ul className="mb-3 mt-2 list-disc space-y-1.5 pl-5 text-slate-700 dark:text-slate-200">{children}</ul>,
                    ol: ({ children }) => <ol className="mb-3 mt-2 list-decimal space-y-1.5 pl-5 text-slate-700 dark:text-slate-200">{children}</ol>,
                    li: ({ children }) => <li className="leading-7 text-[15px]">{children}</li>,
                    h1: ({ children }) => <h1 className="text-xl sm:text-2xl font-bold mb-3 mt-4 first:mt-0 text-slate-900 dark:text-slate-50">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-lg sm:text-xl font-bold mb-2 mt-4 first:mt-0 text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-2">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-base sm:text-lg font-semibold mb-2 mt-3 first:mt-0 text-slate-700 dark:text-slate-200">{children}</h3>,
                    h4: ({ children }) => <h4 className="text-sm sm:text-base font-semibold mb-2 mt-3 text-slate-700 dark:text-slate-200">{children}</h4>,
                    code: ({ inline, children, ...props }) => {
                      if (inline) {
                        return (
                          <code className="bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm px-1.5 py-0.5 rounded font-mono" {...props}>
                            {children}
                          </code>
                        );
                      }
                      return (
                        <code className="block bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm p-3 rounded-lg overflow-x-auto font-mono border border-slate-200 dark:border-slate-700 my-2" {...props}>
                          {children}
                        </code>
                      );
                    },
                  }}
                >
                  {streamingMessage}
                </ReactMarkdown>
                <span className="inline-block w-0.5 h-4 bg-red-500 ml-1 animate-pulse align-middle"></span>
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
  translatedText,
  onRegenerate,
  onPromptClick,
  messages = [],
  searchQuery = '',
  onBookmark,
  onEdit,
  onDelete,
  isBookmarked = false
}) => {
  const { showToast } = useToast();
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const sender = message?.sender || message?.role || 'assistant';
  const text = message?.text || message?.content || '';
  const ts = message?.timestamp ? new Date(message.timestamp) : null;
  const timeStr = ts && !isNaN(ts) ? ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const isTranslating = translatingMessage === index;

  const cleanText = useCallback((text) => text || '', []);

  const highlightText = (text, query) => {
    if (!query || !query.trim()) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, i) => 
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-300 dark:bg-yellow-600/50 px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const handleCopy = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        showToast('Copied to clipboard', { type: 'success' });
      }
    } catch (e) {
      showToast('Failed to copy', { type: 'error' });
    }
  };

  const handleEdit = () => {
    if (sender !== 'user') return;
    setEditText(text);
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (onEdit && editText.trim() && editText !== text) {
      await onEdit(index, editText.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditText('');
  };

  return (
    <div 
      className={`message ${sender === 'user' ? 'user' : 'assistant'} mb-2 sm:mb-3 flex items-start gap-2 sm:gap-3 highlight-match`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-message-index={index}
    >
      {sender === 'assistant' && (
        <div className="flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-red-400 to-orange-500 flex items-center justify-center text-white text-xs sm:text-sm font-semibold shadow-md ring-2 ring-red-100 dark:ring-red-900/50">
          🎓
        </div>
      )}
      <div
        className={`message-content relative rounded-xl border flex-1 flex flex-col ${
          sender === 'user'
            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md ml-auto px-4 py-3 sm:px-5 sm:py-4'
            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-md px-4 py-3 sm:px-5 sm:py-4'
        }`}
      >
        {isEditing && sender === 'user' ? (
          <div className="w-full">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full p-3 border border-blue-300 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
              autoFocus
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleSaveEdit}
                className="px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
              >
                Save
              </button>
              <button
                onClick={handleCancelEdit}
                className="px-3 py-1.5 bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-500 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className={`prose prose-slate dark:prose-invert max-w-none prose-headings:font-semibold prose-strong:font-semibold prose-strong:text-inherit prose-sm sm:prose-base ${sender === 'user' ? 'prose-invert' : ''}`}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
              p: ({ children }) => <p className={`mb-3 last:mb-0 leading-7 text-[15px] ${sender === 'user' ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}>{children}</p>,
              strong: ({ children }) => <strong className={`font-semibold ${sender === 'user' ? 'text-white' : 'text-slate-900 dark:text-slate-50'}`}>{children}</strong>,
              em: ({ children }) => <em className={`italic ${sender === 'user' ? 'text-blue-50' : 'text-slate-700 dark:text-slate-300'}`}>{children}</em>,
              ul: ({ children }) => <ul className={`mb-3 mt-2 list-disc space-y-1.5 pl-5 ${sender === 'user' ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}>{children}</ul>,
              ol: ({ children }) => <ol className={`mb-3 mt-2 list-decimal space-y-1.5 pl-5 ${sender === 'user' ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}>{children}</ol>,
              li: ({ children }) => <li className="leading-7 text-[15px]">{children}</li>,
              h1: ({ children }) => <h1 className={`text-xl sm:text-2xl font-bold mb-3 mt-4 first:mt-0 ${sender === 'user' ? 'text-white' : 'text-slate-900 dark:text-slate-50'}`}>{children}</h1>,
              h2: ({ children }) => <h2 className={`text-lg sm:text-xl font-bold mb-2 mt-4 first:mt-0 border-b pb-2 ${sender === 'user' ? 'text-white border-blue-400' : 'text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700'}`}>{children}</h2>,
              h3: ({ children }) => <h3 className={`text-base sm:text-lg font-semibold mb-2 mt-3 first:mt-0 ${sender === 'user' ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}>{children}</h3>,
              h4: ({ children }) => <h4 className={`text-sm sm:text-base font-semibold mb-2 mt-3 ${sender === 'user' ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}>{children}</h4>,
              code: ({ inline, children, ...props }) => {
                if (inline) {
                  return (
                    <code className={`text-sm px-1.5 py-0.5 rounded font-mono ${sender === 'user' ? 'bg-blue-400/30 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100'}`} {...props}>
                      {children}
                    </code>
                  );
                }
                return (
                  <code className={`block text-sm p-3 rounded-lg overflow-x-auto font-mono border my-2 ${sender === 'user' ? 'bg-blue-400/20 text-white border-blue-400/30' : 'bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-700'}`} {...props}>
                    {children}
                  </code>
                );
              },
              blockquote: ({ children }) => (
                <blockquote className={`border-l-4 pl-4 my-2 italic py-2 rounded-r-lg ${sender === 'user' ? 'border-blue-300 bg-blue-400/20 text-blue-50' : 'border-red-400 dark:border-red-400 bg-red-50/50 dark:bg-red-900/30 text-slate-700 dark:text-slate-100'}`}>
                  {children}
                </blockquote>
              ),
            }}
          >
            {searchQuery ? highlightText(cleanText(text), searchQuery) : cleanText(text)}
          </ReactMarkdown>
        </div>
        )}
        
        {/* Translation dropdown for AI messages and OCR results */}
        {sender === 'assistant' && text.trim() && onTranslate && (
          <div className="mt-4">
            <select
              onChange={(e) => {
                if (e.target.value && onTranslate) {
                  onTranslate(index, e.target.value);
                  e.target.value = '';
                }
              }}
              disabled={isTranslating}
              className="text-xs px-3 py-1.5 bg-white/90 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed font-medium cursor-pointer backdrop-blur focus:outline-none"
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
          <div className={`mt-3 text-xs opacity-60 ${sender === 'user' ? 'text-white/70' : 'text-red-600 dark:text-gray-400'}`}>
            {timeStr}
          </div>
        )}

        {/* Message Action Buttons - At Bottom, Visible on Hover */}
        {isHovered && text.trim() && !isEditing && (
          <div className={`mt-3 flex gap-2 flex-wrap justify-end ${sender === 'user' ? 'justify-start' : ''}`}>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:border-red-300 dark:hover:border-red-600 transition-all duration-200"
              title="Copy message"
              aria-label="Copy message"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy
            </button>
            
            {onBookmark && (
              <button
                onClick={() => onBookmark(index, !isBookmarked)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium backdrop-blur-sm rounded-lg shadow-sm border transition-all duration-200 ${
                  isBookmarked
                    ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700 text-yellow-700 dark:text-yellow-300'
                    : 'bg-white/90 dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:border-yellow-300 dark:hover:border-yellow-600'
                }`}
                title={isBookmarked ? "Unbookmark message" : "Bookmark message"}
                aria-label={isBookmarked ? "Unbookmark message" : "Bookmark message"}
              >
                <svg className="w-3.5 h-3.5" fill={isBookmarked ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                {isBookmarked ? 'Bookmarked' : 'Bookmark'}
              </button>
            )}
            
            {sender === 'user' && onEdit && (
              <button
                onClick={handleEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200"
                title="Edit message"
                aria-label="Edit message"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
            )}
            
            {onDelete && (
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to delete this message?')) {
                    onDelete(index);
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 dark:hover:border-red-600 transition-all duration-200"
                title="Delete message"
                aria-label="Delete message"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
            )}
            
            {sender === 'assistant' && onRegenerate && (
              <button
                onClick={() => onRegenerate(index)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:border-red-300 dark:hover:border-red-600 transition-all duration-200"
                title="Regenerate response"
                aria-label="Regenerate response"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Regenerate
              </button>
            )}
          </div>
        )}

        {/* Quick Reply Suggestions for Assistant Messages */}
        {sender === 'assistant' && text.trim() && (
          <QuickReplySuggestions 
            messageText={text}
            onSelect={onPromptClick}
            isLastMessage={index === messages.length - 1}
          />
        )}
      </div>
      {sender === 'user' && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-semibold shadow-md ring-2 ring-blue-100 dark:ring-blue-900/50">
          👤
        </div>
      )}
    </div>
  );
});

const QuickReplySuggestions = memo(({ messageText, onSelect, isLastMessage }) => {
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    const lowerText = messageText.toLowerCase();
    const newSuggestions = [];

    if (lowerText.includes('upsc') || lowerText.includes('syllabus')) {
      newSuggestions.push('Give me a detailed study plan for UPSC');
      newSuggestions.push('What are the best books for UPSC preparation?');
    } else if (lowerText.includes('history')) {
      newSuggestions.push('Explain the causes of Indian independence');
      newSuggestions.push('What are important dates in Indian History?');
    } else if (lowerText.includes('geography')) {
      newSuggestions.push('Explain climate patterns in India');
      newSuggestions.push('What are the major rivers in India?');
    } else if (lowerText.includes('pyq') || lowerText.includes('previous year')) {
      newSuggestions.push('Search more PYQs for this topic');
      newSuggestions.push('Give me tips for answering this type of question');
    } else {
      newSuggestions.push('Can you explain this in more detail?');
      newSuggestions.push('Give me related study notes');
    }

    setSuggestions(newSuggestions.slice(0, 2));
  }, [messageText]);

  if (!isLastMessage || !suggestions.length || !onSelect) return null;

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {suggestions.map((suggestion, idx) => (
        <button
          key={idx}
          onClick={() => onSelect(suggestion)}
          className="px-3 py-1.5 text-xs bg-red-50 dark:bg-slate-800/80 hover:bg-red-100 dark:hover:bg-slate-700 border border-red-200 dark:border-slate-700 rounded-lg text-red-700 dark:text-slate-300 hover:border-red-300 dark:hover:border-red-600 transition-all duration-200"
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
});

const TranslationResult = memo(({ text, language, langCode }) => {
  const { showToast } = useToast();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speechLoading = useLoadingState();
  const [dense, setDense] = useState(false);

  const handleSpeak = async () => {
    if (!window.speechSynthesis) {
      showToast('Speech synthesis is not supported in this browser. Please use Chrome, Edge, or Safari.', { type: 'error' });
      return;
    }
    
   
    let cleanText = sanitizeTranslationOutput(text)
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold formatting
      .replace(/\*(.*?)\*/g, '$1') // Remove italic formatting
      .replace(/#{1,6}\s*/g, '') // Remove markdown headers
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove markdown links
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();

    if (!speechService) {
      return;
    }
    
    try {
      const validation = validateInput('multilingualText', cleanText);
      if (!validation.isValid) {
        return;
      }

      speechLoading.setLoading('Preparing speech...', 0);
      setIsSpeaking(true);
      
      speechLoading.updateProgress(50, 'Synthesizing speech...');
      await speechService.speak(validation.value, langCode);
      speechLoading.setSuccess('Speech completed');
      
    } catch (error) {
      console.error('Speech error:', error);
      
      const errorResult = errorHandler.handleSpeechError(error, {
        textLength: text.length,
        language: langCode,
        type: 'translation_speech'
      });
      
      speechLoading.setError(errorResult.userMessage);
      
      errorHandler.logError(error, {
        type: 'translation_speech_error',
        textLength: text.length,
        language: langCode
      }, 'warning');
    } finally {
      setIsSpeaking(false);
    }
  };

  return (
    <div className="mt-4 p-4 bg-gradient-to-r from-red-50/80 to-orange-50/80 dark:from-gray-800/60 dark:to-slate-800/60 border border-red-200/50 dark:border-gray-700/50 rounded-xl shadow-md dark:shadow-lg backdrop-blur-sm animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-red-700 dark:text-gray-300 font-semibold">
          Translated to {language}:
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSpeak}
            disabled={isSpeaking}
            className={`text-xs px-3 py-1.5 bg-gradient-to-r from-red-200 to-orange-200 dark:from-red-800/50 dark:to-red-900/50 text-red-700 dark:text-red-200 rounded-lg hover:from-red-300 hover:to-orange-300 dark:hover:from-red-700 dark:hover:to-red-800 transition-all duration-200 font-medium shadow-sm hover:shadow-md backdrop-blur-sm hover:scale-105 focus:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500/20 ${isSpeaking ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isSpeaking ? '🔊 Speaking...' : '🔊 Speak'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              try {
                if (navigator.clipboard) {
                  await navigator.clipboard.writeText(sanitizeTranslationOutput(text));
                  showToast('Copied', { type: 'success' });
                }
              } catch (e) { showToast('Copy failed', { type: 'error' }); }
            }}
            className="text-xs px-3 py-1.5 bg-white/90 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-all duration-200 font-medium shadow-sm hover:shadow-md backdrop-blur-sm hover:scale-105 focus:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500/20"
          >
            📋 Copy
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDense(v => !v)}
            className="text-xs px-2 py-1.5 bg-white/90 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-all duration-200 font-medium shadow-sm backdrop-blur-sm hover:scale-105 focus:scale-105 focus:outline-none focus:ring-2 focus:ring-slate-500/20"
          >
            Aa
          </Button>
        </div>
      </div>
      <div className={`text-base ${dense ? 'leading-6' : 'leading-7'} text-red-900 dark:text-gray-100 break-words whitespace-pre-wrap`}>
        {sanitizeTranslationOutput(text)}
      </div>
    </div>
  );
});

const LoadingMessage = memo(() => (
  <div className="message assistant animate-fade-in flex items-start gap-3">
    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-red-400 to-orange-500 flex items-center justify-center text-white text-sm font-semibold shadow-md ring-2 ring-red-100 dark:ring-red-900/50 animate-pulse">
      🎓
    </div>
    <div className="message-content flex-1">
      <div className="flex items-center gap-3">
        <div className="flex space-x-2">
          <div className="w-2.5 h-2.5 bg-gradient-to-r from-red-400 to-red-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
          <div className="w-2.5 h-2.5 bg-gradient-to-r from-red-400 to-red-500 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
          <div className="w-2.5 h-2.5 bg-gradient-to-r from-red-400 to-red-500 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
        </div>
        <span className="text-sm text-red-600 dark:text-gray-400 font-medium">AI is thinking...</span>
      </div>
      {/* Skeleton loader for message content */}
      <div className="mt-3 space-y-2">
        <div className="h-3 bg-red-200/30 dark:bg-slate-700/50 rounded animate-pulse" style={{ width: '85%' }}></div>
        <div className="h-3 bg-red-200/30 dark:bg-slate-700/50 rounded animate-pulse" style={{ width: '70%' }}></div>
        <div className="h-3 bg-red-200/30 dark:bg-slate-700/50 rounded animate-pulse" style={{ width: '60%' }}></div>
      </div>
    </div>
  </div>
));

StreamingChatMessages.displayName = 'StreamingChatMessages';
MessageItem.displayName = 'MessageItem';
TranslationResult.displayName = 'TranslationResult';
LoadingMessage.displayName = 'LoadingMessage';

export default StreamingChatMessages;
