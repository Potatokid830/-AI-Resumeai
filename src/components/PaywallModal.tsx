"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ShieldCheck, Sparkles, X } from "lucide-react";
import { redeemCode } from "@/lib/usage";

const PERKS = [
  "解锁高配额简历智能重组（VIP 每日最高 20 次）",
  "解锁针对性 Gap 分析与补救策略",
  "解锁高频面试防御话术预判",
  "支持一键导出无水印高清 A4 PDF",
] as const;

type PaywallModalProps = {
  open: boolean;
  onClose: () => void;
  onGetCode: () => void;
  onRedeemSuccess: (type: "onetime" | "vip") => void;
};

export default function PaywallModal({
  open,
  onClose,
  onGetCode,
  onRedeemSuccess,
}: PaywallModalProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCode("");
    setError(null);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  const handleRedeem = () => {
    const result = redeemCode(code);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setError(null);
    onRedeemSuccess(result.type);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <button
            type="button"
            aria-label="关闭付费墙"
            className="absolute inset-0 bg-zinc-950/70 backdrop-blur-xl"
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="paywall-title"
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="relative max-h-[min(92vh,760px)] w-full max-w-md overflow-y-auto rounded-[28px] border border-white/12 bg-zinc-900/90 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -top-24 left-1/2 h-56 w-72 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.16)_0%,transparent_70%)]"
            />

            <button
              type="button"
              onClick={onClose}
              aria-label="关闭"
              className="absolute top-4 right-4 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-200"
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>

            <div className="relative px-6 pt-8 pb-5 sm:px-8 sm:pb-6">
              <div className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] tracking-tight text-zinc-400">
                <Sparkles className="h-3 w-3 text-zinc-300" strokeWidth={1.75} />
                ResumeAI Pro
              </div>

              <h2
                id="paywall-title"
                className="font-[family-name:var(--font-display)] text-[1.55rem] leading-tight font-semibold tracking-tight text-zinc-50 sm:text-[1.65rem]"
              >
                你的专属 AI 面试官已就绪
              </h2>
              <p className="mt-3 text-[13.5px] leading-relaxed text-zinc-400 sm:text-[14px]">
                你已体验 1 次免费终版生成。可用单次卡续航，或解锁月卡高配额，精准对齐大厂
                JD，拿下心仪 Offer。
              </p>

              <ul className="mt-5 space-y-2.5 sm:mt-6 sm:space-y-3">
                {PERKS.map((perk) => (
                  <li
                    key={perk}
                    className="flex items-start gap-2.5 text-[13px] leading-snug text-zinc-200 sm:text-[13.5px]"
                  >
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/25">
                      <Check className="h-3 w-3" strokeWidth={2.25} />
                    </span>
                    {perk}
                  </li>
                ))}
              </ul>

              <div className="mt-6 flex items-end gap-2.5 sm:mt-7">
                <span className="text-sm text-zinc-500 line-through decoration-zinc-600">
                  ¥99
                </span>
                <span className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-zinc-50">
                  ¥29
                </span>
                <span className="mb-1 text-sm text-zinc-500">/ 月</span>
              </div>

              <motion.button
                type="button"
                onClick={onGetCode}
                animate={{
                  boxShadow: [
                    "0 0 0 0 rgba(255,255,255,0.0), 0 12px 36px -12px rgba(255,255,255,0.28)",
                    "0 0 0 8px rgba(255,255,255,0.06), 0 16px 44px -12px rgba(255,255,255,0.38)",
                    "0 0 0 0 rgba(255,255,255,0.0), 0 12px 36px -12px rgba(255,255,255,0.28)",
                  ],
                }}
                transition={{
                  duration: 2.4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-zinc-50 px-5 py-3.5 text-[15px] font-medium tracking-tight text-zinc-950 transition-colors hover:bg-white"
              >
                获取激活码
              </motion.button>

              <div className="mt-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-white/[0.08]" />
                <span className="text-[11px] tracking-[0.14em] text-zinc-600 uppercase">
                  已有激活码
                </span>
                <div className="h-px flex-1 bg-white/[0.08]" />
              </div>

              <div className="mt-4 space-y-3">
                <p className="text-center text-[12.5px] leading-relaxed text-zinc-500">
                  没有激活码？{" "}
                  <button
                    type="button"
                    onClick={onGetCode}
                    className="font-medium text-zinc-200 underline decoration-zinc-500/70 underline-offset-[3px] transition-colors hover:text-white hover:decoration-zinc-200"
                  >
                    点击此处获取专属特权
                  </button>
                </p>

                <input
                  type="text"
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value.toUpperCase());
                    if (error) setError(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleRedeem();
                    }
                  }}
                  placeholder="请输入激活码，如 ONETIME-99 / VIP-299"
                  spellCheck={false}
                  autoComplete="off"
                  className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[14px] tracking-[0.08em] text-zinc-100 placeholder:tracking-normal placeholder:text-zinc-600 outline-none transition-[border-color,box-shadow,background-color] duration-300 hover:border-white/15 focus:border-white/25 focus:bg-white/[0.05] focus:shadow-[0_0_0_3px_rgba(255,255,255,0.08),0_0_28px_-8px_rgba(255,255,255,0.2)]"
                />

                {error && (
                  <p className="text-[12px] text-rose-300/95" role="alert">
                    {error}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleRedeem}
                  className="inline-flex w-full items-center justify-center rounded-full border border-white/15 bg-white/[0.06] px-5 py-3 text-[14px] font-medium tracking-tight text-zinc-100 transition-colors hover:border-white/25 hover:bg-white/[0.1]"
                >
                  立即解锁
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="mt-3 w-full py-2 text-center text-[12px] text-zinc-500 transition-colors hover:text-zinc-300"
              >
                稍后再说
              </button>

              <div className="mt-4 rounded-xl border border-zinc-700/80 bg-zinc-800/50 px-3.5 py-3 sm:px-4">
                <div className="flex gap-2.5">
                  <ShieldCheck
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  <p className="text-[11px] leading-relaxed text-zinc-500 sm:text-[11.5px]">
                    <span className="font-medium text-zinc-400">温馨提示：</span>
                    您的解锁状态将安全保存在当前浏览器中。若更换设备或清理缓存导致权限丢失，只需在此重新输入原激活码即可无缝恢复，请妥善保存。
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
