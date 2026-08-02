/** 简历联系方式（缺省留空，禁止编造） */
export type ResumeContact = {
  name?: string;
  phone?: string;
  email?: string;
  city?: string;
  linkedIn?: string;
};

export type CoreContactField = "name" | "phone" | "email";

const EMAIL_RE =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_RE =
  /(?<![0-9])(?:\+?86[-\s]?)?1[3-9]\d{9}(?![0-9])|(?<![0-9])0\d{2,3}[-\s]?\d{7,8}(?![0-9])/;
const LINKEDIN_RE =
  /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+\/?/i;

function clean(value: unknown, max = 80): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

/** 规范化模型/用户输入的 contact；无效邮箱电话丢弃 */
export function normalizeContact(raw: unknown): ResumeContact {
  if (!raw || typeof raw !== "object") return {};
  const row = raw as Record<string, unknown>;
  const contact: ResumeContact = {};

  const name = clean(row.name, 40);
  if (name) contact.name = name;

  const city = clean(row.city, 40);
  if (city) contact.city = city;

  let email = clean(row.email, 120);
  if (email) {
    const m = email.match(EMAIL_RE);
    email = m?.[0] ?? "";
    if (email) contact.email = email;
  }

  let phone = clean(row.phone, 40).replace(/[（）]/g, (ch) =>
    ch === "（" ? "(" : ")",
  );
  if (phone) {
    const m = phone.match(PHONE_RE);
    phone = m?.[0]?.replace(/\s+/g, "") ?? "";
    if (phone) contact.phone = phone;
  }

  let linkedIn = clean(row.linkedIn ?? row.linkedin, 160);
  if (linkedIn) {
    const m = linkedIn.match(LINKEDIN_RE);
    linkedIn = m?.[0] ?? "";
    if (linkedIn && !/^https?:\/\//i.test(linkedIn)) {
      linkedIn = `https://${linkedIn}`;
    }
    if (linkedIn) contact.linkedIn = linkedIn;
  }

  return contact;
}

/** 从简历原文用正则抽 email / phone / LinkedIn（不抽姓名，避免误伤） */
export function extractContactHeuristics(resumeText: string): ResumeContact {
  const text = resumeText.slice(0, 8_000);
  const contact: ResumeContact = {};

  const email = text.match(EMAIL_RE)?.[0];
  if (email) contact.email = email;

  const phone = text.match(PHONE_RE)?.[0]?.replace(/\s+/g, "");
  if (phone) contact.phone = phone;

  const linkedIn = text.match(LINKEDIN_RE)?.[0];
  if (linkedIn) {
    contact.linkedIn = /^https?:\/\//i.test(linkedIn)
      ? linkedIn
      : `https://${linkedIn}`;
  }

  return contact;
}

/** 非空字段合并：优先 primary */
export function mergeContact(
  primary: ResumeContact | null | undefined,
  secondary: ResumeContact | null | undefined,
): ResumeContact {
  const a = normalizeContact(primary ?? {});
  const b = normalizeContact(secondary ?? {});
  return {
    name: a.name || b.name,
    phone: a.phone || b.phone,
    email: a.email || b.email,
    city: a.city || b.city,
    linkedIn: a.linkedIn || b.linkedIn,
  };
}

export function missingCoreContactFields(
  contact: ResumeContact | null | undefined,
): CoreContactField[] {
  const c = normalizeContact(contact ?? {});
  const missing: CoreContactField[] = [];
  if (!c.name) missing.push("name");
  if (!c.phone) missing.push("phone");
  if (!c.email) missing.push("email");
  return missing;
}

export function isCoreContactComplete(
  contact: ResumeContact | null | undefined,
): boolean {
  return missingCoreContactFields(contact).length === 0;
}

export const CORE_CONTACT_LABELS: Record<CoreContactField, string> = {
  name: "姓名",
  phone: "电话",
  email: "邮箱",
};
