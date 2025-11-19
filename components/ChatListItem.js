'use client';

import { useState, useRef, useEffect } from 'react';
import { Badge } from './ui/Badge';

export default function ChatListItem({ chat, isActive, index, onSelect, onEdit, onPin, onDelete, onArchive }) {
  const lastMsgText = chat.lastMessageContent || 'No messages yet';
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const itemRef = useRef(null);
  const SWIPE_THRESHOLD = 50;

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setIsSwiping(true);
  };

  const handleTouchMove = (e) => {
    if (!isSwiping) return;
    
    const deltaX = e.touches[0].clientX - touchStartX.current;
    const deltaY = Math.abs(e.touches[0].clientY - touchStartY.current);
    
    // Only allow horizontal swipe
    if (deltaY > 30) {
      setIsSwiping(false);
      setSwipeOffset(0);
      return;
    }
    
    // Limit swipe distance
    const maxSwipe = 120;
    setSwipeOffset(Math.max(-maxSwipe, Math.min(maxSwipe, deltaX)));
  };

  const handleTouchEnd = () => {
    if (!isSwiping) return;
    setIsSwiping(false);
    
    if (Math.abs(swipeOffset) > SWIPE_THRESHOLD) {
      if (swipeOffset < 0) {
        // Swipe left - delete
        if (onDelete) {
          onDelete();
        }
      } else {
        // Swipe right - pin/archive
        if (onPin && !chat.pinned) {
          onPin();
        } else if (onArchive) {
          onArchive();
        }
      }
    }
    
    setSwipeOffset(0);
  };

  useEffect(() => {
    if (!isSwiping && swipeOffset !== 0) {
      const timer = setTimeout(() => setSwipeOffset(0), 300);
      return () => clearTimeout(timer);
    }
  }, [isSwiping, swipeOffset]);

  return (
    <div
      ref={itemRef}
      className={`chat-item group ${isActive ? 'active' : ''} relative overflow-hidden`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: `translateX(${swipeOffset}px)`,
        transition: isSwiping ? 'none' : 'transform 0.3s ease-out'
      }}
    >
      {/* Swipe Actions Background */}
      <div className="absolute inset-0 flex items-center justify-between pointer-events-none">
        {swipeOffset < -SWIPE_THRESHOLD && (
          <div className="flex items-center justify-end w-full bg-red-500 text-white px-4">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span className="ml-2 text-sm font-medium">Delete</span>
          </div>
        )}
        {swipeOffset > SWIPE_THRESHOLD && (
          <div className="flex items-center justify-start w-full bg-yellow-500 text-white px-4">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            <span className="ml-2 text-sm font-medium">{chat.pinned ? 'Unpin' : 'Pin'}</span>
          </div>
        )}
      </div>
      
      <div className="relative bg-white dark:bg-slate-800">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0" onClick={onSelect}>
            <div className="flex items-center gap-2">
            {chat.pinned && (
              <Badge variant="outline" className="text-[10px] px-1 py-0 text-yellow-700 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-200 border-yellow-200 dark:border-yellow-700">
                Pinned
              </Badge>
            )}
            {chat.archived && (
              <Badge variant="outline" className="text-[10px] px-1 py-0 text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-600">
                Archived
              </Badge>
            )}
            {chat.folder && (
              <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
                {chat.folder}
              </Badge>
            )}
              <p className="text-sm font-medium truncate">
                {chat.name || `Chat ${index + 1}`}
              </p>
            </div>
            <p className="text-xs opacity-75 truncate">
              {lastMsgText.length > 50 ? lastMsgText.substring(0, 50) + '...' : lastMsgText}
            </p>
            {chat.tags && chat.tags.length > 0 && (
              <div className="flex gap-1 mt-1 flex-wrap">
                {chat.tags.slice(0, 3).map((tag, idx) => (
                  <Badge key={`${tag}-${idx}`} variant="outline" className="text-[10px] px-1 py-0 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              className="p-1 rounded hover:bg-blue-50 text-blue-500"
              title="Edit chat"
              onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              className="p-1 rounded hover:bg-blue-50 text-blue-500"
              title={chat.pinned ? 'Unpin chat' : 'Pin chat'}
              onClick={(e) => { e.stopPropagation(); onPin?.(); }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </button>
            {onArchive && (
              <button
                className="p-1 rounded hover:bg-blue-50 text-blue-500"
                title={chat.archived ? 'Unarchive chat' : 'Archive chat'}
                onClick={(e) => { e.stopPropagation(); onArchive?.(); }}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              </button>
            )}
            <button
              className="p-1 rounded hover:bg-blue-50 text-blue-500"
              title="Delete chat"
              onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m-7 0a2 2 0 012-2h4a2 2 0 012 2m-8 0h8" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
