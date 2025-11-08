import { Server } from 'socket.io';

let io = null;

export default function handler(req, res) {
  if (!io) {
    const httpServer = res.socket?.server;
    if (!httpServer) {
      return res.status(500).json({ error: 'Socket.IO not available' });
    }

    io = new Server(httpServer, {
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
  }

  res.end();
}

export { io };


