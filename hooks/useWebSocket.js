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
    try {
      // Prioritize localhost if we are running locally to avoid connecting to prod socket
      const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
      const socketUrl = isLocal ? window.location.origin : (process.env.NEXT_PUBLIC_SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : ''));

      console.log('[WebSocket Debug] Environment:', { isLocal, hostname: window?.location?.hostname, finalUrl: socketUrl });

      if (!socketUrl || typeof window === 'undefined') {
        return;
      }

      const newSocket = io(socketUrl, {
        path: '/api/socket',
        transports: ['websocket'], // Force websocket only for lowest latency
        reconnection: true,
        reconnectionDelay: 300, // Faster reconnection
        reconnectionDelayMax: 1500,
        reconnectionAttempts: maxReconnectAttempts,
        timeout: 8000, // Reduced timeout for faster failure detection
        forceNew: false, // Reuse connection when possible
        upgrade: false, // Skip polling upgrade - websocket only
        rememberUpgrade: true,
        // Optimize for low latency
        autoConnect: true,
        multiplex: false // Disable multiplexing for simpler, faster connections
      });

      newSocket.on('connect', () => {
        console.log('[WebSocket Debug] Connected successfully');
        setIsConnected(true);
        reconnectAttempts.current = 0;
      });

      newSocket.on('disconnect', (reason) => {
        console.log('[WebSocket Debug] Disconnected:', reason);
        setIsConnected(false);
      });

      newSocket.on('connect_error', (error) => {
        // Suppress massive error logs in console for polling failures
        if (reconnectAttempts.current < 3) {
          console.warn('[WebSocket Debug] Connection error:', error.message);
        }
        setIsConnected(false);
        reconnectAttempts.current++;
      });

      setSocket(newSocket);

      return () => {
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        if (newSocket) newSocket.close();
      };
    } catch (err) {
      console.error('[WebSocket Debug] Critical setup error:', err);
    }
  }, []);

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

