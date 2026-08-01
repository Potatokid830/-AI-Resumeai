"use client";

import { motion } from "framer-motion";

type MatchScoreProps = {
  score: number;
  subtitle: string;
};

export default function MatchScore({ score, subtitle }: MatchScoreProps) {
  const size = 72;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, score));
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-zinc-950/45 px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl sm:px-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={stroke}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="url(#matchGradient)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.15, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          />
          <defs>
            <linearGradient id="matchGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(253,230,138,0.95)" />
              <stop offset="100%" stopColor="rgba(250,250,250,0.9)" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-[family-name:var(--font-display)] text-[15px] font-semibold tracking-tight text-zinc-50">
            {clamped}%
          </span>
        </div>
      </div>

      <div className="min-w-0">
        <p className="text-[15px] font-medium tracking-tight text-zinc-100">
          {clamped}% 匹配度
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-zinc-500">
          {subtitle}
        </p>
      </div>
    </div>
  );
}
