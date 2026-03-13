/**
 * listeningParty.ts — Listening Party (SharePlay) WebSocket Service
 * ─────────────────────────────────────────────────────────────
 * Synchronized playback rooms using Socket.io.
 *
 * Architecture:
 *   • Each room has a single host and N listeners.
 *   • Host state (trackId, currentTime, isPlaying) is broadcast
 *     to all clients in the room every 5 seconds.
 *   • Pause/play/seek on the host immediately propagates.
 *   • Rooms are auto-cleaned when the host disconnects.
 */

import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';

interface RoomState {
  id: string;
  name: string;
  hostId: string;
  trackId: string | null;
  isPlaying: boolean;
  currentTime: number;
  listeners: Set<string>;
  updatedAt: number;
}

const rooms = new Map<string, RoomState>();

let io: Server | null = null;

export function initListeningParty(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: true,
      methods: ['GET', 'POST'],
    },
    path: '/socket.io',
  });

  io.on('connection', (socket: Socket) => {
    console.log(`[ListeningParty] Client connected: ${socket.id}`);

    // ── Create a room ──────────────────────────────────────
    socket.on('room:create', (data: { name: string }, callback) => {
      const roomId = generateRoomId();
      const room: RoomState = {
        id: roomId,
        name: data.name || 'Listening Party',
        hostId: socket.id,
        trackId: null,
        isPlaying: false,
        currentTime: 0,
        listeners: new Set(),
        updatedAt: Date.now(),
      };
      rooms.set(roomId, room);
      socket.join(roomId);

      if (typeof callback === 'function') {
        callback({ roomId, name: room.name });
      }
      console.log(`[ListeningParty] Room created: ${roomId} by ${socket.id}`);
    });

    // ── Join a room ────────────────────────────────────────
    socket.on('room:join', (data: { roomId: string }, callback) => {
      const room = rooms.get(data.roomId);
      if (!room) {
        if (typeof callback === 'function') {
          callback({ error: 'Room not found' });
        }
        return;
      }

      room.listeners.add(socket.id);
      socket.join(data.roomId);

      // Send current state to the new listener
      if (typeof callback === 'function') {
        callback({
          roomId: room.id,
          name: room.name,
          trackId: room.trackId,
          isPlaying: room.isPlaying,
          currentTime: room.currentTime,
          listenerCount: room.listeners.size,
        });
      }

      // Notify room of new listener
      io?.to(data.roomId).emit('room:listener-joined', {
        listenerCount: room.listeners.size,
      });
    });

    // ── Host updates state ─────────────────────────────────
    socket.on('room:sync', (data: {
      roomId: string;
      trackId: string | null;
      isPlaying: boolean;
      currentTime: number;
    }) => {
      const room = rooms.get(data.roomId);
      if (!room || room.hostId !== socket.id) return;

      room.trackId = data.trackId;
      room.isPlaying = data.isPlaying;
      room.currentTime = data.currentTime;
      room.updatedAt = Date.now();

      // Broadcast to all listeners (not the host)
      socket.to(data.roomId).emit('room:state', {
        trackId: room.trackId,
        isPlaying: room.isPlaying,
        currentTime: room.currentTime,
      });
    });

    // ── Leave a room ───────────────────────────────────────
    socket.on('room:leave', (data: { roomId: string }) => {
      const room = rooms.get(data.roomId);
      if (!room) return;

      room.listeners.delete(socket.id);
      socket.leave(data.roomId);

      if (room.hostId === socket.id) {
        // Host left — close the room
        io?.to(data.roomId).emit('room:closed');
        rooms.delete(data.roomId);
      } else {
        io?.to(data.roomId).emit('room:listener-left', {
          listenerCount: room.listeners.size,
        });
      }
    });

    // ── Disconnect cleanup ─────────────────────────────────
    socket.on('disconnect', () => {
      for (const [roomId, room] of rooms.entries()) {
        if (room.hostId === socket.id) {
          io?.to(roomId).emit('room:closed');
          rooms.delete(roomId);
        } else {
          room.listeners.delete(socket.id);
        }
      }
    });
  });

  // Periodic cleanup of stale rooms (no activity for 30 minutes)
  setInterval(() => {
    const now = Date.now();
    for (const [roomId, room] of rooms.entries()) {
      if (now - room.updatedAt > 30 * 60 * 1000) {
        io?.to(roomId).emit('room:closed');
        rooms.delete(roomId);
      }
    }
  }, 60_000);

  return io;
}

export function getIO(): Server | null {
  return io;
}

function generateRoomId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}
