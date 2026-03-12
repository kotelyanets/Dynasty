/**
 * BottomSheet.tsx
 * ─────────────────────────────────────────────────────────────
 * Apple Music–style bottom sheet with blurred backdrop.
 *
 * Slides up from the bottom with a spring animation and
 * dismisses on backdrop tap or swipe-down.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Optional title shown at the top of the sheet */
  title?: string;
}

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const sheetVariants = {
  hidden: { y: '100%' },
  visible: {
    y: 0,
    transition: { type: 'spring' as const, damping: 30, stiffness: 350, mass: 0.8 },
  },
  exit: {
    y: '100%',
    transition: { type: 'spring' as const, damping: 34, stiffness: 400 },
  },
};

export function BottomSheet({ open, onClose, children, title }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  // Lock body scroll when open
  useEffect(() => {
    if (!open) return;
    const handler = (e: TouchEvent) => {
      // Allow scrolling inside the sheet itself
      if (sheetRef.current?.contains(e.target as Node)) return;
      e.preventDefault();
    };
    document.addEventListener('touchmove', handler, { passive: false });
    return () => document.removeEventListener('touchmove', handler);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end">
          {/* Blurred backdrop */}
          <motion.div
            className="absolute inset-0"
            style={{
              background: 'rgba(0, 0, 0, 0.45)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            }}
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            ref={sheetRef}
            className="relative rounded-t-[28px] overflow-hidden max-h-[70vh]"
            style={{
              background: 'rgba(30, 30, 32, 0.97)',
              backdropFilter: 'blur(40px) saturate(180%)',
              WebkitBackdropFilter: 'blur(40px) saturate(180%)',
              paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)',
            }}
            variants={sheetVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Pill handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-white/25" />
            </div>

            {/* Title */}
            {title && (
              <div className="px-5 pt-1 pb-3">
                <p className="text-base font-bold text-white">{title}</p>
              </div>
            )}

            {/* Content */}
            <div className="overflow-y-auto max-h-[60vh] scrollbar-hide">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
