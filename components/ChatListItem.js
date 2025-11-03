'use client';

export default function ChatListItem({ chat, isActive, index, onSelect, onEdit, onPin, onDelete }) {
  const lastMsgText = chat.lastMessageContent || 'No messages yet';
  return (
    <div
      className={`chat-item group ${isActive ? 'active' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0" onClick={onSelect}>
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
            {lastMsgText.length > 50 ? lastMsgText.substring(0, 50) + '...' : lastMsgText}
          </p>
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
  );
}


