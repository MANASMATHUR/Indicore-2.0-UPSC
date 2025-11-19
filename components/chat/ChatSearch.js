'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useToast } from '../ui/ToastProvider';

export default function ChatSearch({ messages = [], onSearchResultClick, isOpen, onClose, searchQuery: externalSearchQuery, onSearchQueryChange }) {
  const [searchQuery, setSearchQuery] = useState(externalSearchQuery || '');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  const [matches, setMatches] = useState([]);
  const inputRef = useRef(null);
  const { showToast } = useToast();

  // Sync with external search query
  useEffect(() => {
    if (externalSearchQuery !== undefined) {
      setSearchQuery(externalSearchQuery);
    }
  }, [externalSearchQuery]);

  const handleSearchChange = (value) => {
    setSearchQuery(value);
    if (onSearchQueryChange) {
      onSearchQueryChange(value);
    }
  };

  const searchResults = useMemo(() => {
    if (!searchQuery || !searchQuery.trim()) {
      setMatches([]);
      setCurrentMatchIndex(-1);
      return [];
    }

    const query = searchQuery.toLowerCase().trim();
    const results = [];

    messages.forEach((message, messageIndex) => {
      const text = (message.text || message.content || '').toLowerCase();
      if (text.includes(query)) {
        const messageText = message.text || message.content || '';
        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        const matchesInMessage = [...messageText.matchAll(regex)];
        
        matchesInMessage.forEach((match) => {
          results.push({
            messageIndex,
            matchIndex: match.index,
            message,
            text: messageText,
            preview: getPreview(messageText, match.index, query.length)
          });
        });
      }
    });

    setMatches(results);
    setCurrentMatchIndex(results.length > 0 ? 0 : -1);
    return results;
  }, [searchQuery, messages]);

  function getPreview(text, matchIndex, queryLength) {
    const start = Math.max(0, matchIndex - 50);
    const end = Math.min(text.length, matchIndex + queryLength + 50);
    let preview = text.substring(start, end);
    
    if (start > 0) preview = '...' + preview;
    if (end < text.length) preview = preview + '...';
    
    return preview;
  }

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (currentMatchIndex >= 0 && matches.length > 0) {
      scrollToMatch(matches[currentMatchIndex]);
    }
  }, [currentMatchIndex, matches]);

  const scrollToMatch = (match) => {
    if (!match) return;
    
    const messageElement = document.querySelector(`[data-message-index="${match.messageIndex}"]`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      messageElement.classList.add('highlight-match');
      setTimeout(() => {
        messageElement.classList.remove('highlight-match');
      }, 2000);
      
      if (onSearchResultClick) {
        onSearchResultClick(match.messageIndex);
      }
    }
  };

  const handleNext = () => {
    if (matches.length === 0) return;
    setCurrentMatchIndex((prev) => (prev + 1) % matches.length);
  };

  const handlePrevious = () => {
    if (matches.length === 0) return;
    setCurrentMatchIndex((prev) => (prev - 1 + matches.length) % matches.length);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      handleSearchChange('');
      onClose();
    } else if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      handlePrevious();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleNext();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      handleNext();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      handlePrevious();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed top-16 left-0 right-0 z-50 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 shadow-lg">
      <div className="max-w-4xl mx-auto px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search in chat messages... (Press Enter for next, Shift+Enter for previous, Esc to close)"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>
          
          {searchQuery.trim() && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span>
                {matches.length > 0 
                  ? `${currentMatchIndex + 1} of ${matches.length}`
                  : 'No matches'
                }
              </span>
              <button
                onClick={handlePrevious}
                disabled={matches.length === 0}
                className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Previous (Shift+Enter or ↑)"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>
              <button
                onClick={handleNext}
                disabled={matches.length === 0}
                className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Next (Enter or ↓)"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          )}
          
          <button
            onClick={() => {
              handleSearchChange('');
              onClose();
            }}
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-slate-700"
            title="Close (Esc)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

