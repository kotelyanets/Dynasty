/**
 * ListeningParty.tsx — Listening Party (SharePlay) UI
 * ─────────────────────────────────────────────────────────────
 * A minimal bottom-sheet style UI for creating/joining listening
 * rooms where playback is synchronized across participants.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, Users, Copy, X, Check } from 'lucide-react';
import { useListeningParty } from '@/hooks/useListeningParty';

interface ListeningPartyProps {
  onClose: () => void;
}

export function ListeningParty({ onClose }: ListeningPartyProps) {
  const { connected, roomState, isHost, createRoom, joinRoom, leaveRoom } = useListeningParty();
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    if (!roomState) return;
    navigator.clipboard.writeText(roomState.roomId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <motion.div
        className="relative w-full max-w-lg rounded-t-3xl bg-[#1c1c1e] p-6 pb-10"
        initial={{ y: 300 }}
        animate={{ y: 0 }}
        exit={{ y: 300 }}
        transition={{ type: 'spring', damping: 25 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#fc3c44]/20 flex items-center justify-center">
              <Radio size={20} className="text-[#fc3c44]" />
            </div>
            <div>
              <h2 className="text-[18px] font-bold text-white">Listening Party</h2>
              <p className="text-[13px] text-white/50">
                {connected ? 'Connected' : 'Connecting...'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 active:text-white/70">
            <X size={24} />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {!roomState ? (
            <motion.div
              key="lobby"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Create Room */}
              <button
                onClick={() => createRoom('My Listening Party')}
                disabled={!connected}
                className="w-full py-3.5 rounded-2xl bg-[#fc3c44] text-white font-semibold text-[16px] active:scale-[0.97] transition-transform disabled:opacity-40"
              >
                Start a Party
              </button>

              {/* Join Room */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Enter room code..."
                  maxLength={6}
                  className="flex-1 bg-white/[0.08] rounded-xl px-4 py-3 text-white text-[15px] placeholder:text-white/30 outline-none focus:bg-white/[0.12] transition-colors text-center tracking-[0.3em] font-mono"
                />
                <button
                  onClick={() => joinCode.trim() && joinRoom(joinCode.trim())}
                  disabled={!connected || !joinCode.trim()}
                  className="px-5 py-3 rounded-xl bg-white/[0.1] text-white font-medium text-[15px] disabled:opacity-30 active:bg-white/[0.15] transition-colors"
                >
                  Join
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="room"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-5"
            >
              {/* Room info */}
              <div className="bg-white/[0.06] rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-white/50 text-[13px]">Room Code</span>
                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-1.5 text-[#fc3c44] text-[13px] font-medium active:opacity-70"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="text-[28px] font-mono font-bold text-white tracking-[0.4em] text-center">
                  {roomState.roomId}
                </p>
              </div>

              {/* Status */}
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-white/50" />
                  <span className="text-white/60 text-[14px]">
                    {roomState.listenerCount} listener{roomState.listenerCount !== 1 ? 's' : ''}
                  </span>
                </div>
                <span className={`text-[13px] font-medium px-3 py-1 rounded-full ${
                  isHost
                    ? 'bg-[#fc3c44]/20 text-[#fc3c44]'
                    : 'bg-white/[0.08] text-white/60'
                }`}>
                  {isHost ? 'Host' : 'Listening'}
                </span>
              </div>

              {/* Leave button */}
              <button
                onClick={() => { leaveRoom(); }}
                className="w-full py-3 rounded-2xl bg-white/[0.08] text-[#fc3c44] font-semibold text-[15px] active:bg-white/[0.12] transition-colors"
              >
                Leave Party
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
