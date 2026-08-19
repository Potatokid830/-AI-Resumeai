/** 已消耗的终版生成次数（非 VIP） */
export const USAGE_STORAGE_KEY = "resume_ai_usage_count";
/** 单次卡累计赠送的额外次数 */
export const EXTRA_CREDITS_STORAGE_KEY = "resume_ai_extra_credits";
/** 旧版 VIP 布尔标记（兼容读取） */
export const VIP_STORAGE_KEY = "resume_ai_is_vip";
/** 新版 VIP 月卡状态（含每日软上限） */
export const VIP_STATE_STORAGE_KEY = "resume_ai_vip_state";
/** 兼容字段：is_vip_monthly */
export const VIP_MONTHLY_FLAG_KEY = "is_vip_monthly";
/** 内容解锁（单次卡 ONETIME-99 兑换后可解除结果区打码） */
export const CONTENT_UNLOCK_KEY = "resume_ai_content_unlocked";

export const FREE_USAGE_LIMIT = 1;
export const VIP_DAILY_LIMIT = 20;

export const ONETIME_CODE = "ONETIME-99";
export const VIP_CODE = "VIP-299";

/** 兼容旧测试码 → 视为 VIP 月卡 */
const LEGACY_VIP_CODES = ["RESUME-666", "OFFER-888"] as const;

/**
 * 开发者旁路：跳过次数门禁 / 打码 / VIP 日上限，且不扣费。
 * - 默认：本地 `next dev`（NODE_ENV=development）自动开启
 * - 显式关闭（测付费墙）：`.env.local` 设 `NEXT_PUBLIC_DEV_BYPASS_PAYWALL=false`
 * - 生产预览强制开：设 `NEXT_PUBLIC_DEV_BYPASS_PAYWALL=true`（切勿带到正式环境）
 */
export function isDevBypassEnabled(): boolean {
  const flag = process.env.NEXT_PUBLIC_DEV_BYPASS_PAYWALL?.trim().toLowerCase();
  if (flag === "false" || flag === "0" || flag === "off") return false;
  if (flag === "true" || flag === "1" || flag === "on") return true;
  return process.env.NODE_ENV === "development";
}

export type VipState = {
  vipCode: string;
  date: string; // YYYY-MM-DD
  dailyUsageCount: number;
};

export type AccessGate =
  | { allowed: true }
  | { allowed: false; reason: "paywall" | "vip_daily_cap" };

export type RedeemResult =
  | { ok: true; type: "onetime" | "vip" }
  | { ok: false; error: string };

function todayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getUsageCount(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(USAGE_STORAGE_KEY);
  const parsed = Number.parseInt(raw ?? "0", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function getExtraCredits(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(EXTRA_CREDITS_STORAGE_KEY);
  const parsed = Number.parseInt(raw ?? "0", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function setExtraCredits(value: number) {
  window.localStorage.setItem(
    EXTRA_CREDITS_STORAGE_KEY,
    String(Math.max(0, value)),
  );
}

/** 非 VIP 可用终版次数上限 = 免费 1 次 + 单次卡累计 */
export function getAvailableFinalCredits(): number {
  return FREE_USAGE_LIMIT + getExtraCredits();
}

export function incrementUsageCount(): number {
  const next = getUsageCount() + 1;
  window.localStorage.setItem(USAGE_STORAGE_KEY, String(next));
  return next;
}

function readVipStateRaw(): VipState | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(VIP_STATE_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<VipState>;
    if (
      typeof parsed.vipCode === "string" &&
      typeof parsed.date === "string" &&
      typeof parsed.dailyUsageCount === "number"
    ) {
      return {
        vipCode: parsed.vipCode,
        date: parsed.date,
        dailyUsageCount: Math.max(0, parsed.dailyUsageCount),
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeVipState(state: VipState) {
  window.localStorage.setItem(VIP_STATE_STORAGE_KEY, JSON.stringify(state));
  window.localStorage.setItem(VIP_MONTHLY_FLAG_KEY, "true");
  window.localStorage.setItem(VIP_STORAGE_KEY, "true");
}

/** 读取 VIP 状态；跨日自动重置 dailyUsageCount */
export function getVipState(): VipState | null {
  const legacyFlag =
    typeof window !== "undefined" &&
    (window.localStorage.getItem(VIP_MONTHLY_FLAG_KEY) === "true" ||
      window.localStorage.getItem(VIP_STORAGE_KEY) === "true");

  let state = readVipStateRaw();

  if (!state && legacyFlag) {
    state = {
      vipCode: VIP_CODE,
      date: todayKey(),
      dailyUsageCount: 0,
    };
    writeVipState(state);
  }

  if (!state) return null;

  const today = todayKey();
  if (state.date !== today) {
    state = { ...state, date: today, dailyUsageCount: 0 };
    writeVipState(state);
  }

  return state;
}

export function isVip(): boolean {
  if (isDevBypassEnabled()) return true;
  return getVipState() !== null;
}

/** 解锁结果区完整 STAR / 洞察（VIP 或已兑换单次卡） */
export function unlockFullContent() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CONTENT_UNLOCK_KEY, "true");
}

export function isContentUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  if (isDevBypassEnabled()) return true;
  if (isVip()) return true;
  return window.localStorage.getItem(CONTENT_UNLOCK_KEY) === "true";
}

export function activateVip(vipCode: string = VIP_CODE) {
  writeVipState({
    vipCode,
    date: todayKey(),
    dailyUsageCount: getVipState()?.dailyUsageCount ?? 0,
  });
}

/** @deprecated 请使用 activateVip；保留给旧调用方 */
export function setVip(enabled = true) {
  if (enabled) {
    activateVip(VIP_CODE);
  } else {
    window.localStorage.removeItem(VIP_STATE_STORAGE_KEY);
    window.localStorage.removeItem(VIP_MONTHLY_FLAG_KEY);
    window.localStorage.setItem(VIP_STORAGE_KEY, "false");
  }
}

export function normalizeRedeemCode(code: string) {
  return code.trim().toUpperCase();
}

export function isValidRedeemCode(code: string) {
  const normalized = normalizeRedeemCode(code);
  if (normalized === ONETIME_CODE || normalized === VIP_CODE) return true;
  return (LEGACY_VIP_CODES as readonly string[]).includes(normalized);
}

export function redeemCode(code: string): RedeemResult {
  const normalized = normalizeRedeemCode(code);
  if (!normalized) {
    return { ok: false, error: "请输入激活码" };
  }

  if (normalized === ONETIME_CODE) {
    setExtraCredits(getExtraCredits() + 1);
    unlockFullContent(); // 单次卡：+1 次生成，并一键解锁当前结果全文
    return { ok: true, type: "onetime" };
  }

  if (
    normalized === VIP_CODE ||
    (LEGACY_VIP_CODES as readonly string[]).includes(normalized)
  ) {
    activateVip(normalized === VIP_CODE ? VIP_CODE : normalized);
    unlockFullContent();
    return { ok: true, type: "vip" };
  }

  return { ok: false, error: "激活码无效，请检查或重新获取" };
}

/**
 * 鉴权门禁（不扣费）：
 * - VIP：校验当日 soft cap（20 次/天）
 * - 非 VIP：免费 1 次 + 单次卡额外次数，用尽则 paywall
 */
export function checkGenerationAccess(): AccessGate {
  if (isDevBypassEnabled()) {
    return { allowed: true };
  }

  const vip = getVipState();
  if (vip) {
    if (vip.dailyUsageCount >= VIP_DAILY_LIMIT) {
      return { allowed: false, reason: "vip_daily_cap" };
    }
    return { allowed: true };
  }

  if (getUsageCount() >= getAvailableFinalCredits()) {
    return { allowed: false, reason: "paywall" };
  }

  return { allowed: true };
}

/** 非 VIP 且已用尽可用次数时需要拦截 */
export function shouldShowPaywall(): boolean {
  const gate = checkGenerationAccess();
  return !gate.allowed && gate.reason === "paywall";
}

/**
 * 【扣费节点】仅在首轮终版简历成功返回后调用。
 * 同会话「深化优化」绝不调用本函数。
 */
export function consumeFinalGeneration(): void {
  // 开发旁路不写用量，避免调试把免费额度 / VIP 日上限耗尽
  if (isDevBypassEnabled()) return;

  const vip = getVipState();
  if (vip) {
    writeVipState({
      ...vip,
      date: todayKey(),
      dailyUsageCount: vip.dailyUsageCount + 1,
    });
    return;
  }
  incrementUsageCount();
}

export const VIP_DAILY_CAP_MESSAGE =
  "触发安全限制：您的专属 VIP 激活码今日生成次数已达上限 (20次)。为保障账号安全与大模型算力，请明日再试，或避免将激活码借予他人。";
