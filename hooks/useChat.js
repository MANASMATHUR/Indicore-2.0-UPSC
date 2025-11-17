'use client';

import { useState, useCallback } from 'react';

export function useChat(userEmail) {
  const [chats, setChats] = useState([]);
  const [currentChat, setCurrentChat] = useState(null);
  const [messages, setMessages] = useState([]);

  const loadChats = useCallback(async () => {
    try {
      const response = await fetch(`/api/chat?email=${encodeURIComponent(userEmail)}`);
      if (response.ok) {
        const payload = await response.json();
        const list = Array.isArray(payload?.chats) ? payload.chats : Array.isArray(payload) ? payload : [];

        const enriched = list.map(chat => {
          const lastMsg = chat.messages?.[chat.messages.length - 1];
          return {
            ...chat,
            lastMessageContent: lastMsg?.text || 'No messages yet',
            lastMessageAt: lastMsg?.timestamp || chat.createdAt
          };
        });

        setChats(enriched);
      }
    } catch (error) {
    }
  }, [userEmail]);

  const createNewChat = useCallback(async () => {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail }),
      });

      if (response.ok) {
        const payload = await response.json();
        const newChat = payload?.chat || payload;

        setChats(prev => [newChat, ...prev]);
        setCurrentChat(newChat);
        setMessages([]);

        return newChat;
      }
    } catch (error) {
    }
  }, [userEmail]);

  const loadChat = useCallback(async (chatId) => {
    try {
      const response = await fetch(`/api/chat/${chatId}`);
      if (response.ok) {
        const payload = await response.json();
        const chat = payload?.chat || payload;
        setCurrentChat(chat);
        setMessages(chat.messages || []);
      }
    } catch (error) {
    }
  }, []);

  // Send a message
  const sendMessage = useCallback(async (chatId, content, language = 'en') => {
    if (!content?.trim()) return; // skip empty messages

    try {
      const response = await fetch(`/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          chatId
            ? { chatId, message: content, language }
            : { message: content, language }
        ),
      });

      if (response.ok) {
        const payload = await response.json();
        const updatedChat = payload?.chat || payload;

        // Update messages and current chat
        setCurrentChat(updatedChat);
        setMessages(updatedChat.messages || []);

        // Update chats list for sidebar
        setChats(prev => {
          const exists = prev.some(c => c._id === updatedChat._id);
          const latestLast = updatedChat.messages?.[updatedChat.messages.length - 1];
          const normalized = {
            ...updatedChat,
            lastMessageContent: latestLast?.text || 'No messages yet',
            lastMessageAt: latestLast?.timestamp || updatedChat.createdAt
          };
          if (!exists) return [normalized, ...prev];
          return prev.map(c => (c._id === updatedChat._id ? normalized : c));
        });

        return updatedChat;
      }
    } catch (error) {
    }
  }, []);

  // Add AI assistant message to a chat
  const addAIMessage = useCallback(async (chatId, content, language = 'en') => {
    if (!chatId || !content?.trim()) return;
    try {
      const response = await fetch(`/api/chat/${chatId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, language }),
      });
      if (response.ok) {
        const payload = await response.json();
        const updatedChat = payload?.chat || payload;
        setCurrentChat(updatedChat);
        setMessages(updatedChat.messages || []);
        setChats(prev =>
          prev.map(c => (c._id === chatId ? {
            ...updatedChat,
            lastMessageContent: updatedChat.messages?.[updatedChat.messages.length - 1]?.text || 'No messages yet',
            lastMessageAt: updatedChat.messages?.[updatedChat.messages.length - 1]?.timestamp || updatedChat.createdAt
          } : c))
        );
        return updatedChat;
      }
    } catch (error) {
    }
  }, []);

  // Delete a chat (soft delete server-side)
  const deleteChat = useCallback(async (chatId) => {
    if (!chatId) return;
    try {
      const response = await fetch(`/api/chat/${chatId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        setChats(prev => prev.filter(c => c._id !== chatId));
        if (currentChat?._id === chatId) {
          setCurrentChat(null);
          setMessages([]);
        }
        return true;
      }
    } catch (error) {
    }
    return false;
  }, [currentChat]);

  return {
    chats,
    currentChat,
    messages,
    setMessages,
    // Expose setter to sync current chat metadata (e.g., rename)
    setCurrentChat,
    // Expose setChats so callers (e.g., ChatInterface) can optimistically update chat list
    setChats,
    loadChats,
    createNewChat,
    loadChat,
    sendMessage,
    addAIMessage,
    deleteChat
  };
}
