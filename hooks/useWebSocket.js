import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useSession } from 'next-auth/react';

// WebSocket is optional - app falls back to SSE when unavailable
const WEBSOCKET_ENABLED = process.env.NEXT_PUBLIC_ENABLE_WEBSOCKET === 'true';

export function useWebSocket() {
  const { data: session } = useSession();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isDisabled, setIsDisabled] = useState(!WEBSOCKET_ENABLED);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 2; // Reduced to fail faster and use SSE
  const hasLoggedDisabled = useRef(false);

  useEffect(() => {
    // Skip WebSocket entirely if disabled or in development without explicit enable
    if (isDisabled || !WEBSOCKET_ENABLED) {
      if (!hasLoggedDisabled.current) {
        console.log('[WebSocket] Disabled - using SSE fallback for chat');
        hasLoggedDisabled.current = true;
      }
      return;
    }

    try {
      const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
      const socketUrl = isLocal ? window.location.origin : (process.env.NEXT_PUBLIC_SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : ''));

      if (!socketUrl || typeof window === 'undefined') {
        return;
      }

      const newSocket = io(socketUrl, {
        path: '/api/socket',
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 3000,
        reconnectionAttempts: maxReconnectAttempts,
        timeout: 5000,
        forceNew: false,
        upgrade: false,
        rememberUpgrade: true,
        autoConnect: true,
        multiplex: false
      });

      newSocket.on('connect', () => {
        console.log('[WebSocket] Connected');
        setIsConnected(true);
        reconnectAttempts.current = 0;
      });

      newSocket.on('disconnect', (reason) => {
        setIsConnected(false);
      });

      newSocket.on('connect_error', (error) => {
        setIsConnected(false);
        reconnectAttempts.current++;

        // After max attempts, disable WebSocket and use SSE
        if (reconnectAttempts.current >= maxReconnectAttempts) {
          console.log('[WebSocket] Connection failed, switching to SSE fallback');
          setIsDisabled(true);
          newSocket.close();
        }
      });

      setSocket(newSocket);

      return () => {
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        if (newSocket) newSocket.close();
      };
    } catch (err) {
      // Silent fail - SSE will be used
      setIsDisabled(true);
    }
  }, [isDisabled]);

  const sendMessage = useCallback((message, options = {}) => {
    if (!socket || !isConnected) {
      return { success: false, error: 'Socket not connected' };
    }

    return new Promise((resolve, reject) => {
      const { message: msg, chatId, model, provider, openAIModel, systemPrompt, language } = message;

      let fullResponse = '';
      let isComplete = false;

      const onChunk = (data) => {
        if (data.done) {
          isComplete = true;
          socket.off('chat:chunk', onChunk);
          socket.off('chat:error', onError);
          resolve({ success: true, response: fullResponse, complete: true });
        } else if (data.chunk) {
          // Process chunk immediately - no buffering
          fullResponse += data.chunk;
          // Call onChunk synchronously for immediate UI update
          if (options.onChunk) {
            options.onChunk(data.chunk, fullResponse);
          }
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
        provider: provider || 'openai',
        openAIModel,
        systemPrompt,
        language: language || 'en',
        sessionToken: session?.user?.email
      });

      setTimeout(() => {
        if (!isComplete) {
          socket.off('chat:chunk', onChunk);
          socket.off('chat:error', onError);
          if (fullResponse) {
            resolve({ success: true, response: fullResponse, complete: false });
          } else {
            reject(new Error('Timeout'));
          }
        }
      }, 90000);
    });
  }, [socket, isConnected, session]);

  return { socket, isConnected, sendMessage };
}

