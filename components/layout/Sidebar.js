'use client';

import { useState, useMemo } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import ChatListItem from '../ChatListItem';

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
  onSearchChat,
  onArchiveChat
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
        className={`sidebar ${isOpen ? 'sidebar-open' : 'sidebar-closed'} z-50`}
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
                aria-label="Search chats"
                aria-expanded={showSearch}
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
                aria-label="Collapse sidebar"
                aria-pressed={isCollapsed}
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
                aria-label="Close sidebar"
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
                    <ChatListItem
                      key={chat._id}
                      chat={{
                        ...chat,
                        lastMessageContent: lastMsgText
                      }}
                      index={index}
                      isActive={isActive}
                      onSelect={() => onChatSelect(chat._id)}
                      onEdit={() => onEditChat?.(chat._id)}
                      onPin={() => onPinChat?.(chat._id)}
                      onDelete={() => onDeleteChat?.(chat._id)}
                      onArchive={() => onArchiveChat?.(chat._id)}
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


export default Sidebar;
