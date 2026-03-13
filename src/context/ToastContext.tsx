/**
 * ToastContext.tsx
 * ─────────────────────────────────────────────────────────────
 * Apple-style toast notifications (large glassmorphism overlay).
 *
 * Usage:
 *   const { showToast } = useToast();
 *   showToast({ icon: 'success', title: 'Added to Library' });
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { Check, Heart, Plus, Download, Trash2, Music } from 'lucide-react';

// ─────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────

type ToastIcon = 'success' | 'heart' | 'plus' | 'download' | 'remove' | 'music';

interface ToastPayload {
  icon?: ToastIcon;
  title: string;
  duration?: number; // ms, default 1200
}

interface ToastContextType {
  showToast: (payload: ToastPayload) => void;
}

const ToastContext = createContext<ToastContextType>(null as unknown as ToastContextType);

// ─────────────────────────────────────────────────────────────
//  Icon map
// ─────────────────────────────────────────────────────────────

const iconMap: Record<ToastIcon, typeof Check> = {
  success:  Check,
  heart:    Heart,
  plus:     Plus,
  download: Download,
  remove:   Trash2,
  music:    Music,
};

// ─────────────────────────────────────────────────────────────
//  Provider + Overlay
// ─────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(ToastPayload & { id: number }) | null>(null);
  const [visible, setVisible] = useState(false);

  const showToast = useCallback((payload: ToastPayload) => {
    setToast({ ...payload, id: Date.now() });
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const dur = toast.duration ?? 1200;
    const timer = setTimeout(() => setVisible(false), dur);
    const cleanup = setTimeout(() => setToast(null), dur + 400);
    return () => {
      clearTimeout(timer);
      clearTimeout(cleanup);
    };
  }, [toast]);

  const Icon = toast ? iconMap[toast.icon ?? 'success'] : Check;

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* ── Toast overlay (Apple-style centered glass square) ── */}
      {toast && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
          style={{
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.3s ease-in-out',
          }}
        >
          <div
            className="flex flex-col items-center justify-center gap-3 rounded-[20px] px-8 py-7 min-w-[140px] min-h-[140px]"
            style={{
              background: 'rgba(80, 80, 80, 0.35)',
              backdropFilter: 'blur(40px)',
              WebkitBackdropFilter: 'blur(40px)',
              transform: visible ? 'scale(1)' : 'scale(0.8)',
              transition: 'transform 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
            }}
          >
            <Icon
              size={52}
              strokeWidth={2.5}
              className="text-white"
              fill={toast.icon === 'heart' ? 'white' : 'none'}
            />
            <p className="text-[15px] font-semibold text-white text-center leading-snug max-w-[160px]">
              {toast.title}
            </p>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────
//  Hook
// ─────────────────────────────────────────────────────────────

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
