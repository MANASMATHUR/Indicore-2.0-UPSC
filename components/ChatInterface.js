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
import Toast, { useToast } from './Toast';
import speechService from '@/lib/speechService';
import errorHandler from '@/lib/errorHandler';
import { validateInput, validateSecurity, security } from '@/lib/validation';
import { useLoadingState, LoadingStates, LoadingTypes, StatusIndicator } from '@/lib/loadingStates';

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
  const [currentTheme, setCurrentTheme] = useState('light');
  const [searchQuery, setSearchQuery] = useState('');
  const [streamingMessage, setStreamingMessage] = useState('');
  const [useStreaming, setUseStreaming] = useState(true);
  const renameTargetIdRef = useRef(null);
  const messagesEndRef = useRef(null);

  const { chats, messages, setMessages, loadChats, createNewChat, loadChat, sendMessage, addAIMessage, deleteChat, setChats, setCurrentChat } = useChat(user.email);
  const { settings, updateSettings, loadSettings } = useSettings();
  const toast = useToast();
  
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark');
    if (currentTheme === 'dark') {
      root.classList.add('dark');
    }
  }, [currentTheme]);

  const getLanguageCode = (lang) => {
    const languageMap = {
      en: 'en-US', hi: 'hi-IN', mr: 'mr-IN', ta: 'ta-IN',
      bn: 'bn-IN', pa: 'pa-IN', gu: 'gu-IN', te: 'te-IN',
      ml: 'ml-IN', kn: 'kn-IN', es: 'es-ES'
    };
    return languageMap[lang] || lang;
  };

  const cleanTextForSpeech = (text) => {
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
  };

  const speakResponse = async (text, lang) => {
    if (!text) return;

    try {
      const validation = validateInput('multilingualText', text);
      if (!validation.isValid) {
        console.error('Speech validation failed:', validation.errors[0]?.message);
        return;
      }

      await speechService.speak(validation.value, lang, {
        rate: 0.9,
        pitch: 1.0,
        volume: 1.0
      });
    } catch (error) {
      console.error('Speech synthesis error:', error);
    }
  };

  const handleSendMessage = useCallback(async (message, isVoiceInput = false, messageLanguage = settings.language) => {
    try {
      const validation = validateInput('chatMessage', message);
      if (!validation.isValid) {
        const error = validation.errors[0];
        toast.error(error.message);
        return;
      }

      const securityCheck = validateSecurity(validation.value);
      if (!securityCheck.isValid) {
        toast.error('Security validation failed. Please check your input.');
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
        toast.error('Too many requests. Please wait a moment before sending another message.');
        return;
      }

      chatLoading.setLoading('Processing your message...', 0);
      setIsLoading(true);
      setStreamingMessage('');

      let chatId = currentChatId;

      setMessages(prev => [...prev, { sender: 'user', text: sanitizedMessage, language: messageLanguage }]);
      
      chatLoading.updateProgress(20, 'Sending message...');
      
      const updatedChat = await sendMessage(chatId, sanitizedMessage, messageLanguage);
      if (!chatId && updatedChat?._id) {
        chatId = updatedChat._id;
        setCurrentChatId(chatId);
      }

      chatLoading.updateProgress(40, 'Generating response...');

      const simpleGreetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening'];
      const isSimpleGreeting = simpleGreetings.some(greeting => 
        sanitizedMessage.toLowerCase().trim() === greeting || 
        sanitizedMessage.toLowerCase().trim().startsWith(greeting + ' ')
      );
      
      if (isSimpleGreeting) {
        const hardcodedResponse = "Hello! I'm Indicore, your AI-powered exam preparation assistant. I specialize in helping students prepare for PCS, UPSC, and SSC exams through comprehensive study materials, answer writing practice, and multilingual support. I can assist you with: Study material translation, Essay and answer writing enhancement, Mock exam evaluation, Vocabulary building, and Multilingual practice. How can I help you with your exam preparation today?";
        
        chatLoading.updateProgress(80, 'Preparing response...');
        await addAIMessage(chatId, hardcodedResponse, messageLanguage);
        
        chatLoading.updateProgress(100, 'Response ready!');
        chatLoading.setSuccess('Message sent successfully');
        
        if (isVoiceInput) {
          speechLoading.setLoading('Speaking response...');
          await speakResponse(hardcodedResponse, settings.language);
          speechLoading.setSuccess('Speech completed');
        }
        return;
      }

      chatLoading.updateProgress(60, 'Processing with AI...');

      if (useStreaming) {
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
          throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        chatLoading.updateProgress(90, 'Finalizing response...');
        await addAIMessage(chatId, data.response, messageLanguage);
        
        chatLoading.updateProgress(100, 'Response ready!');
        chatLoading.setSuccess('Message sent successfully');
        
        if (isVoiceInput) {
          speechLoading.setLoading('Speaking response...');
          await speakResponse(data.response, settings.language);
          speechLoading.setSuccess('Speech completed');
        }
        return;
      }

      if (useStreaming) {
        await handleStreamingResponse(sanitizedMessage, messageLanguage, chatId, isVoiceInput);
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
          throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();

        chatLoading.updateProgress(90, 'Finalizing response...');
        await addAIMessage(chatId, data.response, messageLanguage);
        
        chatLoading.updateProgress(100, 'Response ready!');
        chatLoading.setSuccess('Message sent successfully');

        if (isVoiceInput) {
          speechLoading.setLoading('Speaking response...');
          await speakResponse(data.response, settings.language);
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
        toast.error('Session expired. Please refresh and log in again.');
        setTimeout(() => window.location.reload(), 2000);
      } else {
        toast.error(errorResult.userMessage);
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
  }, [currentChatId, sendMessage, addAIMessage, useStreaming, settings.language, chatLoading, speechLoading, toast, user.email]);

  const handleStreamingResponse = async (message, messageLanguage, chatId, isVoiceInput) => {
    try {
      // Check for simple greetings and provide hardcoded responses
      const simpleGreetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening'];
      const isSimpleGreeting = simpleGreetings.some(greeting => 
        message.toLowerCase().trim() === greeting || 
        message.toLowerCase().trim().startsWith(greeting + ' ')
      );
      
      if (isSimpleGreeting) {
        const hardcodedResponse = "Hello! I'm Indicore, your AI-powered exam preparation assistant. I specialize in helping students prepare for PCS, UPSC, and SSC exams through comprehensive study materials, answer writing practice, and multilingual support. I can assist you with: Study material translation, Essay and answer writing enhancement, Mock exam evaluation, Vocabulary building, and Multilingual practice. How can I help you with your exam preparation today?";
        
        await addAIMessage(chatId, hardcodedResponse, messageLanguage);
        setStreamingMessage('');
        if (isVoiceInput) await speakResponse(hardcodedResponse, settings.language);
        return;
      }

      const response = await fetch('/api/ai/chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          model: settings.model,
          systemPrompt: settings.systemPrompt,
          language: messageLanguage,
          enableCaching: settings.enableCaching,
          quickResponses: settings.quickResponses
        }),
      });

      if (!response.ok) throw new Error('Failed to get streaming response');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        fullResponse += chunk;
        setStreamingMessage(fullResponse);
      }

      // Check if response is complete and not garbled
      const isGarbled = /(greeting to conversation|used in and, first print|earlyth time|beco\.\.\.|for competitive, and offering|support, languages you of|effective writing, or in your preferred)/i.test(fullResponse);
      const isIncomplete = fullResponse.trim().length < 50 || !fullResponse.endsWith('.') && !fullResponse.endsWith('!') && !fullResponse.endsWith('?') || fullResponse.includes('...');
      
      if (isGarbled || isIncomplete) {
        // Try non-streaming API as fallback
        try {
          const fallbackResponse = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message,
              model: settings.model,
              systemPrompt: settings.systemPrompt,
              language: messageLanguage
            }),
          });

          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json();
            if (fallbackData.response && fallbackData.response.length > fullResponse.length) {
              await addAIMessage(chatId, fallbackData.response, messageLanguage);
              setStreamingMessage('');
              if (isVoiceInput) await speakResponse(fallbackData.response, settings.language);
              return;
            }
          }
        } catch (fallbackError) {
          // Fallback failed - continue with original response
        }
      }

      await addAIMessage(chatId, fullResponse, messageLanguage);
      setStreamingMessage('');

      if (isVoiceInput) await speakResponse(fullResponse, settings.language);

    } catch (error) {
      throw error;
    }
  };

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
    setCurrentTheme(theme);
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
        toast.success('Chat name updated');
      } else {
        const err = await response.json();
        toast.error(err.error || 'Failed to update chat name');
      }
    } catch (e) {
      toast.error('Failed to update chat name');
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
          toast.success(`Chat ${newPinnedState ? 'pinned' : 'unpinned'}`);
        } else {
          const errorData = await response.json();
          toast.error(errorData.error || `Failed to ${newPinnedState ? 'pin' : 'unpin'} chat`);
        }
      } catch (error) {
        toast.error(`Failed to ${newPinnedState ? 'pin' : 'unpin'} chat`);
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
      toast.success('Chat exported as PDF');
    } catch (error) {
      toast.error('Failed to export PDF');
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

  return (
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
        className="chat-container transition-all duration-300 ease-in-out min-h-screen flex flex-col"
        style={{
          marginLeft: isSidebarOpen ? '20rem' : '0'
        }}
      >
        <Toast toasts={toast.toasts} onRemove={toast.removeToast} />
        
        {/* Header */}
        <Header
          user={user}
          onMenuClick={useCallback(() => setIsSidebarOpen(!isSidebarOpen), [isSidebarOpen])}
          onSettingsClick={useCallback(() => setIsSettingsOpen(!isSettingsOpen), [isSettingsOpen])}
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
          {/* Enterprise Status Indicators */}
          <div className="sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-slate-700 px-4 py-2">
            <div className="flex items-center justify-between max-w-4xl mx-auto">
              <div className="flex items-center space-x-4">
                <StatusIndicator 
                  status={chatLoading.state} 
                  message={chatLoading.message}
                  showIcon={true}
                />
                <StatusIndicator 
                  status={speechLoading.state} 
                  message={speechLoading.message}
                  showIcon={true}
                />
                <StatusIndicator 
                  status={translationLoading.state} 
                  message={translationLoading.message}
                  showIcon={true}
                />
              </div>
            </div>
          </div>

          {useStreaming ? (
            <StreamingChatMessages 
              messages={messages} 
              isLoading={isLoading} 
              messagesEndRef={messagesEndRef}
              streamingMessage={streamingMessage}
            />
          ) : (
            <ChatMessages 
              messages={messages} 
              isLoading={isLoading} 
              messagesEndRef={messagesEndRef} 
            />
          )}
        </main>

        {/* Chat Input */}
        <div className="sticky bottom-0 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700" role="region" aria-label="Chat input">
          <ChatInput
            onSendMessage={(msg) => handleSendMessage(msg, false, settings.language)}
            onVoiceClick={() => setIsVoiceDialogOpen(true)}
            onImageUpload={(msg) => handleSendMessage(msg, false, settings.language)}
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
          onClose={useCallback(() => setIsSettingsOpen(false), [])}
          settings={settings}
          onUpdateSettings={updateSettings}
        />

        <VoiceDialog
          isOpen={isVoiceDialogOpen}
          onClose={useCallback(() => setIsVoiceDialogOpen(false), [])}
          onSendMessage={useCallback((msg) => handleSendMessage(msg, true, settings.language), [handleSendMessage, settings.language])}
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
  );
}