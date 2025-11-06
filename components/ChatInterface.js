'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { signOut } from 'next-auth/react';
import Header from './layout/Header';
import Sidebar from './layout/Sidebar';
import ChatMessages from './chat/ChatMessages';
import StreamingChatMessages from './chat/StreamingChatMessages';
import ChatInput from './chat/ChatInput';
import SettingsPanel from './settings/SettingsPanel';
import VoiceDialog from './VoiceDialog';
import RenameChatModal from './RenameChatModal';
import ExamPaperUpload from './ExamPaperUpload';
import EssayEnhancement from './EssayEnhancement';
import VocabularyBuilder from './VocabularyBuilder';
import MockEvaluation from './MockEvaluation';
import { useChat } from '@/hooks/useChat';
import { useSettings } from '@/hooks/useSettings';
import { ToastProvider, useToast } from './ui/ToastProvider';
import speechService from '@/lib/speechService';
import errorHandler from '@/lib/errorHandler';
import { validateInput, validateSecurity, security } from '@/lib/validation';
import { useLoadingState } from '@/lib/loadingStates';

export default function ChatInterface({ user }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isVoiceDialogOpen, setIsVoiceDialogOpen] = useState(false);
  const [isExamUploadOpen, setIsExamUploadOpen] = useState(false);
  const [isEssayEnhancementOpen, setIsEssayEnhancementOpen] = useState(false);
  const [isVocabularyBuilderOpen, setIsVocabularyBuilderOpen] = useState(false);
  const [isMockEvaluationOpen, setIsMockEvaluationOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameInitial, setRenameInitial] = useState('');
  const [currentChatId, setCurrentChatId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  // Temporarily disabled dark mode - force light mode only
  const [currentTheme, setCurrentTheme] = useState('light');
  const [searchQuery, setSearchQuery] = useState('');
  const [streamingMessage, setStreamingMessage] = useState('');
  const [useStreaming, setUseStreaming] = useState(true);
  const renameTargetIdRef = useRef(null);
  const messagesEndRef = useRef(null);

  const { chats, messages, setMessages, loadChats, createNewChat, loadChat, sendMessage, addAIMessage, deleteChat, setChats, setCurrentChat } = useChat(user.email);
  const { settings, updateSettings, loadSettings } = useSettings();
  const { showToast } = useToast();
  
  const chatLoading = useLoadingState();
  const speechLoading = useLoadingState();
  const translationLoading = useLoadingState();

  useEffect(() => {
    loadChats();
    loadSettings();
    
    if (settings.useStreaming !== undefined) {
      setUseStreaming(settings.useStreaming);
    }
  }, [loadChats, loadSettings, settings.useStreaming]);

  useEffect(() => {
    // Throttle scrolling to prevent lag with many messages
    const timeoutId = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, [messages]);

  useEffect(() => {
    // Temporarily disabled dark mode - always keep light mode
    const root = document.documentElement;
    root.classList.remove('dark');
    // Force light mode - dark mode temporarily disabled
    // if (currentTheme === 'dark') {
    //   root.classList.add('dark');
    // }
  }, [currentTheme]);

  const getLanguageCode = useCallback((lang) => {
    const languageMap = {
      en: 'en-US', hi: 'hi-IN', mr: 'mr-IN', ta: 'ta-IN',
      bn: 'bn-IN', pa: 'pa-IN', gu: 'gu-IN', te: 'te-IN',
      ml: 'ml-IN', kn: 'kn-IN', es: 'es-ES'
    };
    return languageMap[lang] || lang;
  }, []);

  const cleanTextForSpeech = useCallback((text) => {
    if (!text) return '';
    return text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/\[(\d+)\]/g, '')
      .replace(/\[\d+\]/g, '')
      .replace(/^\s*[-\*•]\s+/gm, '')
      .replace(/^\s*\d+\.\s+/gm, '')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }, []);

  const speakResponse = async (text, lang) => {
    if (!text) return;

    try {
      const validation = validateInput('multilingualText', text);
      if (!validation.isValid) {
        return;
      }

      // Ensure we use the correct language for speech
      const speechLanguage = lang || settings.language || 'en';
      
      await speechService.speak(validation.value, speechLanguage, {
        rate: 0.9,
        pitch: 1.0,
        volume: 1.0
      });
    } catch (error) {
      console.error('Speech error:', error);
      // Don't show error to user for speech - just fail silently
    }
  };

  const handleSendAssistantMessage = useCallback(async (message) => {
    if (!message.trim()) return;
    
    // Get or create a chat, ensuring we extract the ID string
    let chatId = currentChatId;
    if (!chatId) {
      const newChat = await createNewChat();
      if (newChat?._id) {
        chatId = typeof newChat._id === 'string' ? newChat._id : String(newChat._id);
        setCurrentChatId(chatId);
      }
    }
    
    if (!chatId) {
      return;
    }
    
    await addAIMessage(chatId, message, settings.language);
  }, [currentChatId, createNewChat, addAIMessage, settings.language]);

  const handleStreamingResponse = useCallback(async (message, messageLanguage, chatId, isVoiceInput) => {
    try {
      let speechLanguage = messageLanguage;
      if (isVoiceInput) {
        const translationMatch = message.match(/translate.*?(?:to|in|into)\s+(\w+)/i);
        if (translationMatch) {
          const requestedLang = translationMatch[1].toLowerCase();
          const languageMap = {
            'marathi': 'mr', 'hindi': 'hi', 'tamil': 'ta', 'bengali': 'bn',
            'punjabi': 'pa', 'gujarati': 'gu', 'telugu': 'te', 'malayalam': 'ml',
            'kannada': 'kn', 'spanish': 'es', 'english': 'en'
          };
          if (languageMap[requestedLang]) {
            speechLanguage = languageMap[requestedLang];
          }
        }
      }

      const trimmedMessage = message.toLowerCase().trim();
      const simpleGreetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening'];
      const isSimpleGreeting = simpleGreetings.some(greeting => {
        const exactMatch = trimmedMessage === greeting;
        const greetingOnly = new RegExp(`^${greeting.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s,;:!.]*$`, 'i');
        return exactMatch || greetingOnly.test(trimmedMessage);
      });
      
      if (isSimpleGreeting) {
        const hardcodedResponse = "Hi! I'm here to help you prepare for PCS, UPSC, and SSC exams. Ask me anything about topics, get study notes translated, practice answer writing, or search for previous year questions. What would you like to start with?";
        await addAIMessage(chatId, hardcodedResponse, messageLanguage);
        setStreamingMessage('');
        if (isVoiceInput) await speakResponse(hardcodedResponse, speechLanguage);
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000);

      try {
        const response = await fetch('/api/ai/chat-stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            chatId,
            model: settings.model,
            systemPrompt: settings.systemPrompt,
            language: messageLanguage,
            enableCaching: settings.enableCaching,
            quickResponses: settings.quickResponses
          }),
          signal: controller.signal
        });

        if (!response.ok) {
          let errorMessage = 'Failed to get streaming response';
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch {
          }
          throw new Error(errorMessage);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim() || line.startsWith(':')) continue;
            
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data === '[DONE]' || data === '[REGENERATING_INCOMPLETE_RESPONSE]') {
                break;
              }
              
              if (data && data !== '[DONE]') {
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.content) {
                    fullResponse += parsed.content;
                    setStreamingMessage(fullResponse);
                  } else if (parsed.choices?.[0]?.delta?.content) {
                    const content = parsed.choices[0].delta.content;
                    fullResponse += content;
                    setStreamingMessage(fullResponse);
                  } else if (parsed.error) {
                    throw new Error(parsed.error.message || parsed.error);
                  }
                } catch (e) {
                  if (line.includes('error') || line.includes('Error')) {
                    throw new Error('Stream parsing error');
                  }
                }
              }
            }
          }
        }

        if (buffer.trim()) {
          const line = buffer.trim();
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data !== '[DONE]') {
              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  fullResponse += parsed.content;
                  setStreamingMessage(fullResponse);
                } else if (parsed.choices?.[0]?.delta?.content) {
                  fullResponse += parsed.choices[0].delta.content;
                  setStreamingMessage(fullResponse);
                }
              } catch (e) {
              }
            }
          }
        }

        clearTimeout(timeoutId);
        await addAIMessage(chatId, fullResponse, messageLanguage);
        setStreamingMessage('');

        if (isVoiceInput) await speakResponse(fullResponse, speechLanguage);

      } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error('Request timeout');
        }
        throw error;
      }
    } catch (error) {
      chatLoading.setError('Failed to stream response. Please try again.');
      setIsLoading(false);
      setStreamingMessage('');
      
      const errorResult = errorHandler.handleChatError(error, {
        type: 'streaming_error',
        message: message.substring(0, 100),
        user: user.email
      });
      
      showToast(errorResult.userMessage || 'An error occurred while generating the response.', { type: 'error' });
      
      errorHandler.logError(error, {
        type: 'streaming_error',
        message: message.substring(0, 100),
        user: user.email
      }, 'error');
    }
  }, [addAIMessage, settings.model, settings.systemPrompt, settings.enableCaching, settings.quickResponses, chatLoading, showToast, user.email, speakResponse, setStreamingMessage, setIsLoading]);

  const handleSendMessage = useCallback(async (message, isVoiceInput = false, messageLanguage = settings.language) => {
    // Detect if user is asking for translation in voice input
    let speechLanguage = messageLanguage; // For speech output
    if (isVoiceInput) {
      const translationMatch = message.match(/translate.*?(?:to|in|into)\s+(\w+)/i);
      if (translationMatch) {
        const requestedLang = translationMatch[1].toLowerCase();
        const languageMap = {
          'marathi': 'mr', 'hindi': 'hi', 'tamil': 'ta', 'bengali': 'bn',
          'punjabi': 'pa', 'gujarati': 'gu', 'telugu': 'te', 'malayalam': 'ml',
          'kannada': 'kn', 'spanish': 'es', 'english': 'en'
        };
        if (languageMap[requestedLang]) {
          speechLanguage = languageMap[requestedLang]; // Only for speech, not text
        }
      }
    }
    try {
      const validation = validateInput('chatMessage', message);
      if (!validation.isValid) {
        const error = validation.errors[0];
        showToast(error.message, { type: 'error' });
        return;
      }

      const securityCheck = validateSecurity(validation.value);
      if (!securityCheck.isValid) {
        showToast('Security validation failed. Please check your input.', { type: 'error' });
        errorHandler.logError(new Error('Security validation failed'), {
          type: 'security_validation',
          message: message.substring(0, 100),
          user: user.email
        }, 'warning');
        return;
      }

      const sanitizedMessage = validation.value;
      
      try {
        security.checkRateLimit(user.email, 30, 60000);
      } catch (rateLimitError) {
        showToast('Too many requests. Please wait a moment before sending another message.', { type: 'error' });
        return;
      }

      chatLoading.setLoading('Processing your message...', 0);
      setIsLoading(true);
      setStreamingMessage('');

      let chatId = currentChatId;

      setMessages(prev => [...prev, { sender: 'user', text: sanitizedMessage, language: messageLanguage }]);
      
      chatLoading.updateProgress(20, 'Sending message...');
      
      const updatedChat = await sendMessage(chatId, sanitizedMessage, messageLanguage);
      if (updatedChat?._id) {
        const newChatId = typeof updatedChat._id === 'string' ? updatedChat._id : String(updatedChat._id);
        chatId = newChatId;
        setCurrentChatId(newChatId);
      }

      chatLoading.updateProgress(40, 'Generating response...');

      // Check for simple greetings ONLY (not greetings with additional content)
      // Only match if message is JUST a greeting or greeting followed only by punctuation/whitespace
      const trimmedMessage = sanitizedMessage.toLowerCase().trim();
      const simpleGreetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening'];
      const isSimpleGreeting = simpleGreetings.some(greeting => {
        const exactMatch = trimmedMessage === greeting;
        // Match greeting followed by optional punctuation/whitespace and nothing else
        const greetingOnly = new RegExp(`^${greeting.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s,;:!.]*$`, 'i');
        return exactMatch || greetingOnly.test(trimmedMessage);
      });
      
      if (isSimpleGreeting) {
        const hardcodedResponse = "Hi! I'm here to help you prepare for PCS, UPSC, and SSC exams. Ask me anything about topics, get study notes translated, practice answer writing, or search for previous year questions. What would you like to start with?";
        
        chatLoading.updateProgress(80, 'Preparing response...');
        await addAIMessage(chatId, hardcodedResponse, messageLanguage);
        
        chatLoading.updateProgress(100, 'Response ready!');
        chatLoading.setSuccess('Message sent successfully');
        
        if (isVoiceInput) {
          speechLoading.setLoading('Speaking response...');
          await speakResponse(hardcodedResponse, speechLanguage);
          speechLoading.setSuccess('Speech completed');
        }
        return;
      }

      chatLoading.updateProgress(60, 'Processing with AI...');

      if (useStreaming) {
        const chatIdForStream = chatId ? (typeof chatId === 'string' ? chatId : String(chatId)) : null;
        await handleStreamingResponse(sanitizedMessage, messageLanguage, chatIdForStream, isVoiceInput);
      } else {
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-CSRF-Token': security.generateCSRFToken()
          },
          body: JSON.stringify({
            message: sanitizedMessage,
            model: settings.model,
            systemPrompt: settings.systemPrompt,
            language: messageLanguage
          }),
        });

        if (!response.ok) {
          // Try to extract error message from response
          let errorMessage = `API request failed: ${response.status} ${response.statusText}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch {
            // If response is not JSON, use default error message
          }
          throw new Error(errorMessage);
        }
        
        const data = await response.json();

        chatLoading.updateProgress(90, 'Finalizing response...');
        await addAIMessage(chatId, data.response, messageLanguage);
        
        chatLoading.updateProgress(100, 'Response ready!');
        chatLoading.setSuccess('Message sent successfully');
        
        if (isVoiceInput) {
          speechLoading.setLoading('Speaking response...');
          await speakResponse(data.response, speechLanguage);
          speechLoading.setSuccess('Speech completed');
        }
      }

    } catch (error) {
      const errorResult = errorHandler.handleChatError(error, {
        messageLength: message?.length || 0,
        language: messageLanguage,
        isVoiceInput,
        user: user.email
      });

      chatLoading.setError(errorResult.userMessage);
      
      if (errorResult.requiresAuth) {
        showToast('Session expired. Please refresh and log in again.', { type: 'error' });
        setTimeout(() => window.location.reload(), 2000);
      } else {
        showToast(errorResult.userMessage, { type: 'error' });
      }
      
      errorHandler.logError(error, {
        type: 'chat_error',
        message: message?.substring(0, 100),
        language: messageLanguage,
        isVoiceInput,
        user: user.email
      }, 'error');
      
    } finally {
      setIsLoading(false);
      setStreamingMessage('');
    }
  }, [currentChatId, sendMessage, addAIMessage, useStreaming, settings.language, settings.model, settings.systemPrompt, chatLoading, speechLoading, showToast, user.email, createNewChat, setCurrentChatId, setMessages, handleStreamingResponse]);

  const handleChatSelect = useCallback(async (chatId) => {
    setCurrentChatId(chatId);
    await loadChat(chatId);
    setIsSidebarOpen(false);
  }, [loadChat]);

  const handleNewChat = useCallback(async () => {
    const newChat = await createNewChat();
    setCurrentChatId(newChat._id);
    setIsSidebarOpen(false);
  }, [createNewChat]);

  const handleLogout = useCallback(() => signOut({ callbackUrl: '/' }), []);

  const handleThemeChange = useCallback((theme) => {
    // Temporarily disabled dark mode - always keep light mode
    // setCurrentTheme(theme);
    setCurrentTheme('light'); // Force light mode only
  }, []);

  const handleSearchChat = useCallback((query) => {
    setSearchQuery(query);
  }, []);


  const handleEditChat = async (chatId) => {
    const chat = chats.find(c => c._id === chatId);
    if (!chat) return;
    setRenameInitial(chat.name || `Chat ${chats.indexOf(chat) + 1}`);
    setIsRenameOpen(true);
    renameTargetIdRef.current = chatId;
  };

  const handleConfirmRename = async (newName) => {
    const chatId = renameTargetIdRef.current;
    setIsRenameOpen(false);
    if (!chatId) return;
    try {
      const response = await fetch(`/api/chat/${chatId}/update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      });
      if (response.ok) {
        const data = await response.json();
        setChats(prev => prev.map(c => c._id === chatId ? { ...c, name: data.chat.name } : c));
        if (currentChatId === chatId) {
          setCurrentChat((prev) => prev ? { ...prev, name: data.chat.name } : prev);
        }
        showToast('Chat name updated', { type: 'success' });
      } else {
        const err = await response.json();
        showToast(err.error || 'Failed to update chat name', { type: 'error' });
      }
    } catch (e) {
      showToast('Failed to update chat name', { type: 'error' });
    }
  };

  const handlePinChat = async (chatId) => {
    const chat = chats.find(c => c._id === chatId);
    if (chat) {
      const newPinnedState = !chat.pinned;
      try {
        const response = await fetch(`/api/chat/${chatId}/update`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pinned: newPinnedState })
        });

        if (response.ok) {
          const data = await response.json();
          setChats(prevChats => 
            prevChats.map(c => 
              c._id === chatId 
                ? { ...c, pinned: data.chat.pinned }
                : c
            )
          );
          showToast(`Chat ${newPinnedState ? 'pinned' : 'unpinned'}`, { type: 'success' });
        } else {
          const errorData = await response.json();
          showToast(errorData.error || `Failed to ${newPinnedState ? 'pin' : 'unpin'} chat`, { type: 'error' });
        }
      } catch (error) {
        showToast(`Failed to ${newPinnedState ? 'pin' : 'unpin'} chat`, { type: 'error' });
      }
    }
  };

  const downloadChatAsPDF = async () => {
    if (!messages.length) return;
    
    try {
      const jsPDF = (await import('jspdf')).default;
      const doc = new jsPDF();
      
      let y = 20;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 20;
      
      // Add title
      doc.setFontSize(16);
      doc.text('Chat Export', margin, y);
      y += 20;
      
      // Add messages
      doc.setFontSize(12);
      messages.forEach((message, index) => {
        if (y > pageHeight - 30) {
          doc.addPage();
          y = 20;
        }
        
        const sender = message.sender === 'user' ? 'You' : 'AI';
        const rawText = message.text || message.content || '';
        
        // Clean the text for PDF export
        const cleanText = rawText
          .replace(/\*\*(.*?)\*\*/g, '$1')           // Remove bold markdown
          .replace(/\*(.*?)\*/g, '$1')               // Remove italic markdown
          .replace(/\[(\d+)\]/g, '')                 // Remove reference numbers like [1], [2], etc.
          .replace(/\[\d+\]/g, '')                   // Remove any remaining [number] patterns
          .replace(/^- /gm, '')                      // Remove bullet points
          .replace(/\*\s/g, '')                      // Remove asterisk bullets
          .replace(/\d+\.\s/g, '')                   // Remove numbered lists (1., 2., etc.)
          .replace(/\n+/g, '\n')                     // Normalize newlines
          .replace(/\s+/g, ' ')                      // Replace multiple spaces with single space
          .trim();
        
        doc.text(`${sender}:`, margin, y);
        y += 7;
        
        // Split long text into multiple lines
        const lines = doc.splitTextToSize(cleanText, 170);
        doc.text(lines, margin + 10, y);
        y += lines.length * 5 + 10;
      });
      
      doc.save(`chat-export-${new Date().toISOString().split('T')[0]}.pdf`);
      showToast('Chat exported as PDF', { type: 'success' });
    } catch (error) {
      showToast('Failed to export PDF', { type: 'error' });
    }
  };

  const handleExamEvaluation = (evaluation, examType, subject) => {
    const evaluationMessage = `📝 **Exam Paper Evaluation Results**\n\n**Exam Type:** ${examType.toUpperCase()}\n**Subject:** ${subject}\n\n${evaluation}`;
    handleSendMessage(evaluationMessage, false, settings.language);
  };

  const handleEssayEnhancement = (enhancedText, language) => {
    const enhancedMessage = `✍️ **Enhanced Essay**\n\n${enhancedText}`;
    handleSendMessage(enhancedMessage, false, language);
  };

  const handleVocabularyAddition = (vocabularyText, language) => {
    handleSendMessage(vocabularyText, false, language);
  };

  const handleMockEvaluation = (evaluation, language) => {
    const evaluationMessage = `📊 **Mock Evaluation Results**\n\n${evaluation}`;
    handleSendMessage(evaluationMessage, false, language);
  };

  const handleRegenerate = useCallback(async (messageIndex) => {
    if (messageIndex <= 0) return;
    // Get the user message that preceded this AI response
    const userMessage = messages[messageIndex - 1];
    if (userMessage && userMessage.sender === 'user') {
      // Remove the AI response and regenerate
      setMessages(prev => prev.slice(0, messageIndex));
      await handleSendMessage(userMessage.text || userMessage.content, false, userMessage.language || settings.language);
    }
  }, [messages, handleSendMessage, settings.language]);

  const handlePromptClick = useCallback((prompt) => {
    handleSendMessage(prompt, false, settings.language);
  }, [handleSendMessage, settings.language]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Ctrl+K or Cmd+K: New chat
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        handleNewChat();
      }
      // Escape: Close sidebar if open
      if (e.key === 'Escape' && isSidebarOpen) {
        setIsSidebarOpen(false);
      }
      // Ctrl+/ or Cmd+/: Toggle settings
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setIsSettingsOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleNewChat, isSidebarOpen]);


  return (
    <ToastProvider>
    <div className="min-h-screen bg-red-50 dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 overflow-x-hidden">
      {/* Skip link for accessibility */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      
      {/* Sidebar - positioned outside the main container */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        chats={chats}
        currentChatId={currentChatId}
        onChatSelect={handleChatSelect}
        onNewChat={handleNewChat}
        onDeleteChat={async (id) => {
          const ok = await deleteChat(id);
          if (ok && currentChatId === id) {
            setCurrentChatId(null);
          }
        }}
        onEditChat={handleEditChat}
        onPinChat={handlePinChat}
        onSearchChat={handleSearchChat}
      />

      <div 
        className={`chat-container min-h-screen flex flex-col ${isSidebarOpen ? 'chat-container-sidebar-open' : 'chat-container-sidebar-closed'}`}
      >
        
        
        {/* Header */}
        <Header
          user={user}
          onMenuClick={useCallback(() => setIsSidebarOpen(!isSidebarOpen), [isSidebarOpen])}
          onSettingsClick={useCallback(() => {
            setIsSettingsOpen(prev => !prev);
          }, [])}
          onLogout={handleLogout}
          onExamUpload={useCallback(() => setIsExamUploadOpen(true), [])}
          onEssayEnhancement={useCallback(() => setIsEssayEnhancementOpen(true), [])}
          onVocabularyBuilder={useCallback(() => setIsVocabularyBuilderOpen(true), [])}
          onMockEvaluation={useCallback(() => setIsMockEvaluationOpen(true), [])}
          onDownloadPDF={downloadChatAsPDF}
          currentTheme={currentTheme}
          onThemeChange={handleThemeChange}
        />

        {/* Chat Messages */}
        <main id="main-content" className="flex-1 overflow-y-auto" role="main" aria-label="Chat messages">
          {useStreaming ? (
            <StreamingChatMessages 
              messages={messages} 
              isLoading={isLoading} 
              messagesEndRef={messagesEndRef}
              streamingMessage={streamingMessage}
              onRegenerate={handleRegenerate}
              onPromptClick={handlePromptClick}
            />
          ) : (
            <ChatMessages 
              messages={messages} 
              isLoading={isLoading} 
              messagesEndRef={messagesEndRef}
              onRegenerate={handleRegenerate}
              onPromptClick={handlePromptClick}
            />
          )}
        </main>

        {/* Chat Input */}
        <div className="sticky bottom-0 z-10" role="region" aria-label="Chat input">
          <ChatInput
            onSendMessage={useCallback((msg) => handleSendMessage(msg, false, settings.language), [handleSendMessage, settings.language])}
            onVoiceClick={useCallback(() => setIsVoiceDialogOpen(true), [])}
            onImageUpload={useCallback((msg) => handleSendMessage(msg, false, settings.language), [handleSendMessage, settings.language])}
            onSendAssistantMessage={handleSendAssistantMessage}
            disabled={isLoading}
          />
        </div>

        {/* Modals */}
        <RenameChatModal
          isOpen={isRenameOpen}
          initialName={renameInitial}
          onCancel={() => setIsRenameOpen(false)}
          onConfirm={handleConfirmRename}
        />

        <SettingsPanel
          isOpen={isSettingsOpen}
          onClose={useCallback(() => {
            setIsSettingsOpen(false);
          }, [])}
          settings={settings}
          onUpdateSettings={updateSettings}
        />

        <VoiceDialog
          isOpen={isVoiceDialogOpen}
          onClose={useCallback(() => setIsVoiceDialogOpen(false), [])}
          onSendMessage={useCallback(async (msg, speakLanguage) => {
            const langToUse = speakLanguage || settings.language;
            await handleSendMessage(msg, true, langToUse);
          }, [handleSendMessage, settings.language])}
          language={settings.language}
        />

        <ExamPaperUpload
          isOpen={isExamUploadOpen}
          onClose={useCallback(() => setIsExamUploadOpen(false), [])}
          onEvaluate={handleExamEvaluation}
        />

        <EssayEnhancement
          isOpen={isEssayEnhancementOpen}
          onClose={useCallback(() => setIsEssayEnhancementOpen(false), [])}
          onEnhance={handleEssayEnhancement}
        />

        <VocabularyBuilder
          isOpen={isVocabularyBuilderOpen}
          onClose={useCallback(() => setIsVocabularyBuilderOpen(false), [])}
          onAddToChat={handleVocabularyAddition}
        />

        <MockEvaluation
          isOpen={isMockEvaluationOpen}
          onClose={useCallback(() => setIsMockEvaluationOpen(false), [])}
          onEvaluate={handleMockEvaluation}
        />

      </div>
    </div>
    </ToastProvider>
  );
}