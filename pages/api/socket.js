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
      transports: ['websocket', 'polling'], // Prefer websocket for lower latency
      cors: {
        origin: process.env.NEXT_PUBLIC_URL || '*',
        methods: ['GET', 'POST']
      },
      pingTimeout: 60000,
      pingInterval: 25000,
      upgrade: true, // Auto-upgrade from polling to websocket
      rememberUpgrade: true,
      allowEIO3: true // Backward compatibility
    });

    io.on('connection', (socket) => {
      socket.on('disconnect', () => {
      });
    });
  }

  res.end();
}

export { io };


