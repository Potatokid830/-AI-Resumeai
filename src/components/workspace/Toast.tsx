"use client";

import { AnimatePresence, motion } from "framer-motion";

type ToastProps = {
  message: string | null;
  /** 较长文案时用更宽的提示条 */
  variant?: "default" | "alert";
};

export default function Toast({ message, variant = "default" }: ToastProps) {
  const isAlert = variant === "alert";

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className={`pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 border border-white/10 bg-zinc-900/95 text-zinc-100 shadow-[0_12px_40px_-16px_rgba(0,0,0,0.8)] backdrop-blur-xl ${
            isAlert
              ? "max-w-[min(92vw,420px)] rounded-2xl px-4 py-3 text-[12.5px] leading-relaxed"
              : "rounded-full px-4 py-2 text-[13px]"
          }`}
          role="status"
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
