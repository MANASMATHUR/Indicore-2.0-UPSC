'use client';

import { useState, useMemo } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Badge from '../ui/Badge';

const Sidebar = ({ 
  isOpen, 
  onClose, 
  chats, 
  currentChatId, 
  onChatSelect, 
  onNewChat,
  onDeleteChat,
  onEditChat,
  onPinChat,
  onSearchChat
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const filteredChats = useMemo(() => {
    if (!chats || chats.length === 0) return [];
    if (!searchQuery.trim()) return chats;
    
    return chats.filter(chat => {
      const chatName = chat.name || `Chat ${chats.indexOf(chat) + 1}`;
      const lastMessage = chat.lastMessageContent || '';
      return chatName.toLowerCase().includes(searchQuery.toLowerCase()) ||
lastMessage.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [chats, searchQuery]);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    onSearchChat?.(value);
  };


  
  return (
    <>
      {/* Backdrop */}
      <div 
        className={`sidebar-backdrop ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Sidebar */}
      <div 
        className={`sidebar ${isOpen ? 'translate-x-0' : '-translate-x-full'} z-50`}
      >
        {/* Header */}
        <div className="p-3 sm:p-4 border-b border-gray-200 bg-gray-50 dark:border-slate-600 dark:bg-slate-700">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <h2 className="text-sm sm:text-base font-semibold text-gray-800 dark:text-gray-100">Your Chats</h2>
            <div className="flex gap-1 sm:gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSearch(!showSearch)}
                title="Search chats"
                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 hover:bg-red-200 dark:hover:bg-red-800 p-1 sm:p-2"
              >
                <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsCollapsed(!isCollapsed)}
                title="Collapse sidebar"
                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 hover:bg-red-200 dark:hover:bg-red-800 p-1 sm:p-2"
              >
                <svg 
                  className={`w-3 h-3 sm:w-4 sm:h-4 transition-transform duration-200 ${isCollapsed ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                title="Close sidebar"
                className="text-white bg-red-600 hover:bg-red-700 rounded-lg p-1 sm:p-2"
              >
                <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Button>
            </div>
          </div>
          
          {/* Search Bar */}
          {showSearch && (
            <Input
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full text-sm"
            />
          )}
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          {(!chats || chats.length === 0) ? (
            <div className="p-3 sm:p-4 text-center text-red-600 dark:text-red-400">
              <p className="text-xs sm:text-sm">No chats yet</p>
              <p className="text-xs mt-1">Start a new conversation!</p>
            </div>
          ) : (
            <div className="p-1 sm:p-2">
              {searchQuery.trim() && filteredChats.length === 0 ? (
                <div className="p-4 text-center text-red-500">
                  <p className="text-sm">No chats found</p>
                  <p className="text-xs mt-1">Try a different search term</p>
                </div>
              ) : (
                filteredChats.map((chat, index) => {
                  const lastMsgText = chat.lastMessageContent || 'No messages yet';
                  const isActive = currentChatId === chat._id;

                  return (
                    <ChatItem
                      key={chat._id}
                      chat={chat}
                      index={index}
                      isActive={isActive}
                      lastMessage={lastMsgText}
                      onSelect={() => onChatSelect(chat._id)}
                      onEdit={() => onEditChat?.(chat._id)}
                      onPin={() => onPinChat?.(chat._id)}
                      onDelete={() => onDeleteChat?.(chat._id)}
                    />
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* New Chat Button */}
        <div className="p-3 sm:p-4 border-t border-gray-200 bg-gray-50 dark:border-slate-600 dark:bg-slate-700">
          <Button
            onClick={onNewChat}
            className="w-full bg-blue-600 text-white hover:bg-blue-700 flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm font-medium py-2 sm:py-3 rounded-lg"
          >
            <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Chat
          </Button>
        </div>
      </div>
    </>
  );
};

const ChatItem = ({ 
  chat, 
  index, 
  isActive, 
  lastMessage, 
  onSelect, 
  onEdit, 
  onPin, 
  onDelete 
}) => {
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      className={`chat-item group ${isActive ? 'active' : ''}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0" onClick={onSelect}>
          <div className="flex items-center gap-2">
            {chat.pinned && (
              <svg className="w-3 h-3 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2L3 7v11h4v-6h6v6h4V7l-7-5z" />
              </svg>
            )}
            <p className="text-sm font-medium break-words">
              {chat.name || `Chat ${index + 1}`}
            </p>
          </div>
          <p className="text-xs opacity-75 break-words">
            {lastMessage.length > 50 
              ? lastMessage.substring(0, 50) + '...' 
              : lastMessage
            }
          </p>
        </div>
        
        <div className={`flex items-center gap-1 transition-opacity duration-200 ${showActions ? 'opacity-100' : 'opacity-0'}`}>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            title="Edit chat"
            className="p-1 text-red-500 hover:text-red-700 dark:hover:text-red-300"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); onPin(); }}
            title={chat.pinned ? "Unpin chat" : "Pin chat"}
            className="p-1 text-red-500 hover:text-red-700 dark:hover:text-red-300"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="Delete chat"
            className="p-1 text-red-500 hover:text-red-600 dark:hover:text-red-400"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m-7 0a2 2 0 012-2h4a2 2 0 012 2m-8 0h8" />
            </svg>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
