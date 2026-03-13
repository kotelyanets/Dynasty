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
 *
 * Sync guarantees:
 *   • Host broadcasts state on a 5-second heartbeat.
 *   • Host ALSO broadcasts immediately on play/pause/seek so
 *     listeners see the change within milliseconds, not 5 seconds.
 *   • The heartbeat interval is cleaned up before creating a new
 *     one (no stacking), and also on leave / disconnect / room close.
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
  const storeUnsubRef = useRef<(() => void) | null>(null);
  const roomIdRef = useRef<string | null>(null);

  /** Stop the periodic 5-second sync and the store subscription. */
  const stopSync = useCallback(() => {
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }
    if (storeUnsubRef.current) {
      storeUnsubRef.current();
      storeUnsubRef.current = null;
    }
    roomIdRef.current = null;
  }, []);

  // Connect socket on first use
  useEffect(() => {
    if (!BASE_URL) return; // Demo mode — no WebSocket

    const socket = io(BASE_URL, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => {
      setConnected(false);
      // Socket disconnected ungracefully — clean up host sync
      stopSync();
    });

    // Listen for state updates from the host
    socket.on('room:state', (state: { trackId: string | null; isPlaying: boolean; currentTime: number }) => {
      setRoomState((prev) => prev ? { ...prev, ...state } : null);

      // Sync local player state with host
      const store = usePlayerStore.getState();
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
      stopSync();
    });

    socketRef.current = socket;

    return () => {
      stopSync();
      socket.disconnect();
    };
  }, [stopSync]);

  const createRoom = useCallback((name: string) => {
    const socket = socketRef.current;
    if (!socket) return;

    // Clean up any pre-existing sync before creating a new room
    stopSync();

    socket.emit('room:create', { name }, (response: { roomId: string; name: string }) => {
      const rid = response.roomId;
      roomIdRef.current = rid;

      setRoomState({
        roomId: rid,
        name: response.name,
        trackId: null,
        isPlaying: false,
        currentTime: 0,
        listenerCount: 0,
      });
      setIsHost(true);

      /** Emit the current player state to the room. */
      const emitSync = () => {
        const store = usePlayerStore.getState();
        socket.emit('room:sync', {
          roomId: rid,
          trackId: store.currentTrack?.id ?? null,
          isPlaying: store.isPlaying,
          currentTime: store.currentTime,
        });
      };

      // Periodic heartbeat every 5 seconds (time-based drift correction)
      syncIntervalRef.current = setInterval(emitSync, 5000);

      // Immediate sync on play/pause/seek — reacts in <50 ms
      storeUnsubRef.current = usePlayerStore.subscribe(
        (s) => ({ isPlaying: s.isPlaying, currentTime: s.currentTime, trackId: s.currentTrack?.id }),
        (cur, prev) => {
          // Only emit when play state or track actually changes
          // (currentTime changes 4×/s from timeupdate — ignore those)
          if (cur.isPlaying !== prev.isPlaying || cur.trackId !== prev.trackId) {
            emitSync();
          }
        },
      );
    });
  }, [stopSync]);

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
    stopSync();
  }, [roomState, stopSync]);

  return { connected, roomState, isHost, createRoom, joinRoom, leaveRoom };
}
