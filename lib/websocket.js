import { Server } from 'socket.io';

let io = null;

export function initializeWebSocket(server) {
  if (io) return io;

  io = new Server(server, {
    path: '/api/socket',
    transports: ['websocket', 'polling'],
    cors: {
      origin: process.env.NEXT_PUBLIC_URL || '*',
      methods: ['GET', 'POST']
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  io.on('connection', (socket) => {
    socket.on('disconnect', () => {
    });
  });

  return io;
}

export function getIO() {
  return io;
}

