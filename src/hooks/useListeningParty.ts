/**
 * useListeningParty.ts — Listening Party (SharePlay) Hook
 * ─────────────────────────────────────────────────────────────
 * Manages a synchronized listening room using Socket.io.
 *
 * Usage:
 *   const { createRoom, joinRoom, leaveRoom, roomState, isHost }
 *     = useListeningParty();
 *
 *   // Host creates a room, then shares the roomId with friends
 *   // Friends join with the roomId
 *   // Playback is synced via WebSockets every 5 seconds
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { usePlayerStore } from '@/store/playerStore';

const BASE_URL: string =
  (typeof import.meta !== 'undefined' &&
    (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL) ||
  '';

export interface RoomState {
  roomId: string;
  name: string;
  trackId: string | null;
  isPlaying: boolean;
  currentTime: number;
  listenerCount: number;
}

interface UseListeningPartyResult {
  connected: boolean;
  roomState: RoomState | null;
  isHost: boolean;
  createRoom: (name: string) => void;
  joinRoom: (roomId: string) => void;
  leaveRoom: () => void;
}

export function useListeningParty(): UseListeningPartyResult {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [isHost, setIsHost] = useState(false);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Connect socket on first use
  useEffect(() => {
    if (!BASE_URL) return; // Demo mode — no WebSocket

    const socket = io(BASE_URL, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    // Listen for state updates from the host
    socket.on('room:state', (state: { trackId: string | null; isPlaying: boolean; currentTime: number }) => {
      setRoomState((prev) => prev ? { ...prev, ...state } : null);

      // Sync local player state with host
      const store = usePlayerStore.getState();
      if (state.trackId && state.trackId !== store.currentTrack?.id) {
        // Track changed — load it
        // The track needs to be fetched from the API
        // For now just sync play/pause and time
      }
      if (state.isPlaying && !store.isPlaying) {
        store.play();
      } else if (!state.isPlaying && store.isPlaying) {
        store.pause();
      }
      if (Math.abs(state.currentTime - store.currentTime) > 2) {
        store.seek(state.currentTime);
      }
    });

    socket.on('room:listener-joined', (data: { listenerCount: number }) => {
      setRoomState((prev) => prev ? { ...prev, listenerCount: data.listenerCount } : null);
    });

    socket.on('room:listener-left', (data: { listenerCount: number }) => {
      setRoomState((prev) => prev ? { ...prev, listenerCount: data.listenerCount } : null);
    });

    socket.on('room:closed', () => {
      setRoomState(null);
      setIsHost(false);
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    });

    socketRef.current = socket;

    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
      socket.disconnect();
    };
  }, []);

  const createRoom = useCallback((name: string) => {
    const socket = socketRef.current;
    if (!socket) return;

    socket.emit('room:create', { name }, (response: { roomId: string; name: string }) => {
      setRoomState({
        roomId: response.roomId,
        name: response.name,
        trackId: null,
        isPlaying: false,
        currentTime: 0,
        listenerCount: 0,
      });
      setIsHost(true);

      // Start syncing host state every 5 seconds
      syncIntervalRef.current = setInterval(() => {
        const store = usePlayerStore.getState();
        socket.emit('room:sync', {
          roomId: response.roomId,
          trackId: store.currentTrack?.id ?? null,
          isPlaying: store.isPlaying,
          currentTime: store.currentTime,
        });
      }, 5000);
    });
  }, []);

  const joinRoom = useCallback((roomId: string) => {
    const socket = socketRef.current;
    if (!socket) return;

    socket.emit('room:join', { roomId }, (response: RoomState | { error: string }) => {
      if ('error' in response) {
        console.error('[ListeningParty]', response.error);
        return;
      }
      setRoomState(response);
      setIsHost(false);
    });
  }, []);

  const leaveRoom = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || !roomState) return;

    socket.emit('room:leave', { roomId: roomState.roomId });
    setRoomState(null);
    setIsHost(false);
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }
  }, [roomState]);

  return { connected, roomState, isHost, createRoom, joinRoom, leaveRoom };
}
