import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useSession } from 'next-auth/react';

export function useWebSocket() {
  const { data: session } = useSession();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || '';
    
    if (!socketUrl) {
      return;
    }

    const newSocket = io(socketUrl, {
      path: '/api/socket',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: maxReconnectAttempts,
      timeout: 20000,
      forceNew: true
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      reconnectAttempts.current = 0;
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      setIsConnected(false);
      reconnectAttempts.current++;
    });

    setSocket(newSocket);

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      newSocket.close();
    };
  }, []);

  const sendMessage = useCallback((message, options = {}) => {
    if (!socket || !isConnected) {
      return { success: false, error: 'Socket not connected' };
    }

    return new Promise((resolve, reject) => {
      const { message: msg, chatId, model, systemPrompt, language } = message;
      
      let fullResponse = '';
      let isComplete = false;

      const onChunk = (data) => {
        if (data.done) {
          isComplete = true;
          socket.off('chat:chunk', onChunk);
          socket.off('chat:error', onError);
          resolve({ response: fullResponse, complete: true });
        } else {
          fullResponse += data.chunk;
          options.onChunk?.(data.chunk, fullResponse);
        }
      };

      const onError = (error) => {
        socket.off('chat:chunk', onChunk);
        socket.off('chat:error', onError);
        reject(new Error(error.error || 'WebSocket error'));
      };

      socket.on('chat:chunk', onChunk);
      socket.on('chat:error', onError);

      socket.emit('chat:message', {
        message: msg,
        chatId,
        model: model || 'sonar-pro',
        systemPrompt,
        language: language || 'en',
        sessionToken: session?.user?.email
      });

      setTimeout(() => {
        if (!isComplete) {
          socket.off('chat:chunk', onChunk);
          socket.off('chat:error', onError);
          if (fullResponse) {
            resolve({ response: fullResponse, complete: false });
          } else {
            reject(new Error('Timeout'));
          }
        }
      }, 90000);
    });
  }, [socket, isConnected, session]);

  return { socket, isConnected, sendMessage };
}

