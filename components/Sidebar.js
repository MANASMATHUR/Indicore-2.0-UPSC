'use client';

import { useState } from 'react';

export default function Sidebar({ 
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
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <div className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
        {/* Header */}
        <div className="p-4 border-b border-red-200 dark:border-red-800">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-red-900 dark:text-red-100">Your Chats</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowSearch(!showSearch)}
                className="p-1 hover:bg-red-200 dark:hover:bg-red-800 rounded transition-colors duration-200 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
                title="Search chats"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-1 hover:bg-red-200 dark:hover:bg-red-800 rounded transition-colors duration-200 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
                title="Collapse sidebar"
              >
                <svg 
                  className={`w-4 h-4 transition-transform duration-200 ${isCollapsed ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={onClose}
                className="p-1 hover:bg-red-200 dark:hover:bg-red-800 rounded transition-colors duration-200 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
                title="Close sidebar"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          
          {/* Search Bar */}
          {showSearch && (
            <div className="relative">
              <input
                type="text"
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  onSearchChat?.(e.target.value);
                }}
                className="w-full px-3 py-2 pl-8 text-sm border border-red-300 dark:border-red-600 bg-white dark:bg-red-800 text-red-900 dark:text-red-100 placeholder:text-red-500 dark:placeholder:text-red-400 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
              <svg className="absolute left-2 top-2.5 w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          )}
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          {(!chats || chats.length === 0) ? (
            <div className="p-4 text-center text-red-600 dark:text-red-400">
              <p className="text-sm">No chats yet</p>
              <p className="text-xs mt-1">Start a new conversation!</p>
            </div>
          ) : (
            <div className="p-2">
              {(() => {
                const filteredChats = chats.filter(chat => {
                  if (!searchQuery.trim()) return true;
                  const chatName = chat.name || `Chat ${chats.indexOf(chat) + 1}`;
                  const lastMessage = chat.lastMessageContent || '';
                  return chatName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         lastMessage.toLowerCase().includes(searchQuery.toLowerCase());
                });

                if (searchQuery.trim() && filteredChats.length === 0) {
                  return (
                  <div className="p-4 text-center text-red-500">
                      <p className="text-sm">No chats found</p>
                      <p className="text-xs mt-1">Try a different search term</p>
                    </div>
                  );
                }

              return filteredChats.map((chat, index) => {
                const lastMsgText = chat.lastMessageContent || 'No messages yet';

                return (
                  <div
                    key={chat._id}
                  className={`chat-item group ${currentChatId === chat._id ? 'active' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0" onClick={() => onChatSelect(chat._id)}>
                        <div className="flex items-center gap-2">
                          {chat.pinned && (
                            <svg className="w-3 h-3 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 2L3 7v11h4v-6h6v6h4V7l-7-5z" />
                            </svg>
                          )}
                          <p className="text-sm font-medium truncate">
                            {chat.name || `Chat ${index + 1}`}
                          </p>
                        </div>
                        <p className="text-xs opacity-75 truncate">
                          {lastMsgText.length > 50 
                            ? lastMsgText.substring(0, 50) + '...' 
                            : lastMsgText
                          }
                        </p>
                      </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button
                        className="p-1 rounded hover:bg-red-200 dark:hover:bg-red-800 text-red-500 hover:text-red-700 dark:hover:text-red-300"
                          title="Edit chat"
                          onClick={(e) => { e.stopPropagation(); onEditChat?.(chat._id); }}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                        className="p-1 rounded hover:bg-red-200 dark:hover:bg-red-800 text-red-500 hover:text-red-700 dark:hover:text-red-300"
                          title={chat.pinned ? "Unpin chat" : "Pin chat"}
                          onClick={(e) => { e.stopPropagation(); onPinChat?.(chat._id); }}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                          </svg>
                        </button>
                        <button
                        className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 hover:text-red-600 dark:hover:text-red-400"
                          title="Delete chat"
                          onClick={(e) => { e.stopPropagation(); onDeleteChat?.(chat._id); }}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m-7 0a2 2 0 012-2h4a2 2 0 012 2m-8 0h8" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
                });
              })()}
            </div>
          )}
        </div>

        {/* New Chat Button */}
        <div className="p-4 border-t border-red-200 dark:border-red-800">
          <button
            onClick={onNewChat}
            className="w-full bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 transition-colors duration-200 flex items-center justify-center gap-2 font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Chat
          </button>
        </div>
      </div>
    </>
  );
}
