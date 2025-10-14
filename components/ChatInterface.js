'use client';

import { useState, useEffect, useRef } from 'react';
import { signOut } from 'next-auth/react';
import Sidebar from './Sidebar';
import ChatMessages from './ChatMessages';
import ChatInput from './ChatInput';
import SettingsPanel from './SettingsPanel';
import VoiceDialog from './VoiceDialog';
import ThemeDropdown from './ThemeDropdown';
import RenameChatModal from './RenameChatModal';
import ExamPaperUpload from './ExamPaperUpload';
import EssayEnhancement from './EssayEnhancement';
import VocabularyBuilder from './VocabularyBuilder';
import MockEvaluation from './MockEvaluation';
import { useChat } from '@/hooks/useChat';
import { useSettings } from '@/hooks/useSettings';
import Toast, { useToast } from './Toast';

export default function ChatInterface({ user }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isVoiceDialogOpen, setIsVoiceDialogOpen] = useState(false);
  const [isExamUploadOpen, setIsExamUploadOpen] = useState(false);
  const [isEssayEnhancementOpen, setIsEssayEnhancementOpen] = useState(false);
  const [isVocabularyBuilderOpen, setIsVocabularyBuilderOpen] = useState(false);
  const [isMockEvaluationOpen, setIsMockEvaluationOpen] = useState(false);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [currentTheme, setCurrentTheme] = useState('light');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameInitial, setRenameInitial] = useState('');
  const renameTargetIdRef = useRef(null);

  const messagesEndRef = useRef(null);

  const { chats, messages, setMessages, loadChats, createNewChat, loadChat, sendMessage, addAIMessage, deleteChat, setChats, setCurrentChat } = useChat(user.email);
  const { settings, updateSettings, loadSettings } = useSettings();
  const toast = useToast();

  useEffect(() => {
    loadChats();
    loadSettings();
  }, [loadChats, loadSettings]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getLanguageCode = (lang) => {
    const languageMap = {
      en: 'en-US', hi: 'hi-IN', mr: 'mr-IN', ta: 'ta-IN',
      bn: 'bn-IN', pa: 'pa-IN', gu: 'gu-IN', te: 'te-IN',
      ml: 'ml-IN', kn: 'kn-IN', es: 'es-ES'
    };
    return languageMap[lang] || 'en-US';
  };

  const speakResponse = (text, lang) => {
    if (!text || !('speechSynthesis' in window)) return;

    if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();

    const cleanText = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\[(\d+)\]/g, '')
      .replace(/^- /gm, '')
      .replace(/\n/g, ' ')
      .trim();

    if (!cleanText) return;

    const chunks = cleanText.match(/.{1,200}(\s|$)/g) || [cleanText];
    chunks.forEach((chunk) => {
      const utterance = new SpeechSynthesisUtterance(chunk.trim());
      utterance.lang = getLanguageCode(lang);
      window.speechSynthesis.speak(utterance);
    });
  };

  const handleSendMessage = async (message, isVoiceInput = false, messageLanguage = settings.language) => {
    if (!message.trim()) return;
    setIsLoading(true);

    try {
      let chatId = currentChatId;

      // Show user message immediately
      setMessages(prev => [...prev, { sender: 'user', text: message, language: messageLanguage }]);

      // Send message to backend (creates chat if chatId is null)
      const updatedChat = await sendMessage(chatId, message, messageLanguage);
      if (!chatId && updatedChat?._id) {
        chatId = updatedChat._id;
        setCurrentChatId(chatId);
      }

      // Fetch AI response from API
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          model: settings.model,
          systemPrompt: settings.systemPrompt,
          language: messageLanguage
        }),
      });

      if (!response.ok) throw new Error('Failed to get AI response');
      const data = await response.json();

      // Add AI message using useChat hook (no truncation)
      await addAIMessage(chatId, data.response, messageLanguage);

      if (isVoiceInput) speakResponse(data.response, messageLanguage);

      return data.response;

    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChatSelect = async (chatId) => {
    setCurrentChatId(chatId);
    await loadChat(chatId);
    setIsSidebarOpen(false);
  };

  const handleNewChat = async () => {
    const newChat = await createNewChat();
    setCurrentChatId(newChat._id);
    setIsSidebarOpen(false);
  };

  const handleLogout = () => signOut({ callbackUrl: '/' });

  useEffect(() => {
    const root = document.documentElement;
    
    // Remove dark class
    root.classList.remove('dark');
    
    // Apply current theme
    if (currentTheme === 'dark') {
      root.classList.add('dark');
    }
  }, [currentTheme]);

  const handleThemeChange = (theme) => {
    setCurrentTheme(theme);
  };

  const handleSearchChat = (query) => {
    setSearchQuery(query);
    // The search filtering is handled in the Sidebar component
    // This function is called when user types in the search box
  };

  const handleEditChat = async (chatId) => {
    const chat = chats.find(c => c._id === chatId);
    if (!chat) return;
    setRenameInitial(chat.name || `Chat ${chats.indexOf(chat) + 1}`);
    setIsRenameOpen(true);
    // Store target id in a ref to avoid stale closures
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
      console.error('Error updating chat name:', e);
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
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pinned: newPinnedState
          }),
        });

        if (response.ok) {
          const data = await response.json();
          // Update the chat in the local state
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
        console.error('Error updating pin status:', error);
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
        const text = message.text || message.content || '';
        
        doc.text(`${sender}:`, margin, y);
        y += 7;
        
        // Split long text into multiple lines
        const lines = doc.splitTextToSize(text, 170);
        doc.text(lines, margin + 10, y);
        y += lines.length * 5 + 10;
      });
      
      doc.save(`chat-export-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
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
    <div className="min-h-screen bg-gradient-to-br from-red-950 via-rose-900 to-slate-950 flex items-center justify-center p-0 md:p-4">
      <div className="chat-container">
        <Toast toasts={toast.toasts} onRemove={toast.removeToast} />
        {/* Header */}
        <div className="bg-gradient-to-r from-red-900 to-rose-700 dark:from-red-950 dark:to-rose-900 text-white p-6 text-center relative shadow-lg rounded-t-lg md:rounded-t-xl">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="absolute left-6 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-25 hover:bg-opacity-40 p-2 rounded-lg transition-all duration-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold mb-1">🎓 Indicore</h1>
          <p className="text-sm opacity-90">PCS • UPSC • SSC Exam Prep AI</p>
          <div className="absolute right-6 top-1/2 transform -translate-y-1/2 flex gap-2">
            <button
              onClick={() => setIsExamUploadOpen(true)}
              className="bg-white bg-opacity-15 hover:bg-opacity-30 focus:ring-2 focus:ring-red-300/60 focus:outline-none p-2 rounded-lg transition-all duration-200 text-slate-100 hover:text-white"
              title="Upload Exam Paper for Evaluation"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
            <button
              onClick={() => setIsEssayEnhancementOpen(true)}
              className="bg-white bg-opacity-15 hover:bg-opacity-30 focus:ring-2 focus:ring-red-300/60 focus:outline-none p-2 rounded-lg transition-all duration-200 text-slate-100 hover:text-white"
              title="Essay & Answer Writing Enhancement"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={() => setIsVocabularyBuilderOpen(true)}
              className="bg-white bg-opacity-15 hover:bg-opacity-30 focus:ring-2 focus:ring-red-300/60 focus:outline-none p-2 rounded-lg transition-all duration-200 text-slate-100 hover:text-white"
              title="Bilingual Vocabulary Builder"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </button>
            <button
              onClick={() => setIsMockEvaluationOpen(true)}
              className="bg-white bg-opacity-15 hover:bg-opacity-30 focus:ring-2 focus:ring-red-300/60 focus:outline-none p-2 rounded-lg transition-all duration-200 text-slate-100 hover:text-white"
              title="Regional Language Mock Evaluation"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </button>
            <button
              onClick={downloadChatAsPDF}
              className="bg-white bg-opacity-15 hover:bg-opacity-30 focus:ring-2 focus:ring-red-300/60 focus:outline-none p-2 rounded-lg transition-all duration-200 text-slate-100 hover:text-white"
              title="Download chat as PDF"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
            <ThemeDropdown currentTheme={currentTheme} onThemeChange={handleThemeChange} />
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className="bg-white bg-opacity-15 hover:bg-opacity-30 focus:ring-2 focus:ring-red-300/60 focus:outline-none p-2 rounded-lg transition-all duration-200 text-slate-100 hover:text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>

            <div className="relative group">
              <button className="bg-white bg-opacity-25 hover:bg-opacity-40 p-2 rounded-lg transition-all duration-200">
                <img src={user.avatar || '/static/default-avatar.jpg'} alt={user.name} className="w-6 h-6 rounded-full" />
              </button>
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                <div className="p-3 border-b border-gray-200">
                  <p className="font-medium text-gray-800">{user.name}</p>
                  <p className="text-sm text-gray-600">{user.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-200"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Chat Messages */}
        <ChatMessages messages={messages} isLoading={isLoading} messagesEndRef={messagesEndRef} />

        {/* Chat Input */}
        <ChatInput
          onSendMessage={(msg) => handleSendMessage(msg, false, settings.language)}
          onVoiceClick={() => setIsVoiceDialogOpen(true)}
          disabled={isLoading}
        />

        {/* Sidebar */}
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

        <RenameChatModal
          isOpen={isRenameOpen}
          initialName={renameInitial}
          onCancel={() => setIsRenameOpen(false)}
          onConfirm={handleConfirmRename}
        />

        {/* Settings Panel */}
        <SettingsPanel
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          settings={settings}
          onUpdateSettings={updateSettings}
        />

        {/* Voice Dialog */}
        <VoiceDialog
          isOpen={isVoiceDialogOpen}
          onClose={() => setIsVoiceDialogOpen(false)}
          onSendMessage={(msg) => handleSendMessage(msg, true, settings.language)}
          language={settings.language}
        />

        {/* Exam Paper Upload */}
        <ExamPaperUpload
          isOpen={isExamUploadOpen}
          onClose={() => setIsExamUploadOpen(false)}
          onEvaluate={handleExamEvaluation}
        />

        {/* Essay Enhancement */}
        <EssayEnhancement
          isOpen={isEssayEnhancementOpen}
          onClose={() => setIsEssayEnhancementOpen(false)}
          onEnhance={handleEssayEnhancement}
        />

        {/* Vocabulary Builder */}
        <VocabularyBuilder
          isOpen={isVocabularyBuilderOpen}
          onClose={() => setIsVocabularyBuilderOpen(false)}
          onAddToChat={handleVocabularyAddition}
        />

        {/* Mock Evaluation */}
        <MockEvaluation
          isOpen={isMockEvaluationOpen}
          onClose={() => setIsMockEvaluationOpen(false)}
          onEvaluate={handleMockEvaluation}
        />

        
      </div>
    </div>
  );
}
