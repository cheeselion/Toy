// Strict English letters + ASCII symbols only (no CJK, no spaces, no digits)
export const NICKNAME_PATTERN = /^[A-Za-z_.!@#$%^&*+=~?:;-]{2,32}$/;
const HAS_ENGLISH_LETTER = /[A-Za-z]/;

export type NicknameValidationResult =
  | {
      ok: true;
      nickname: string;
      key: string;
    }
  | {
      ok: false;
      message: string;
    };

export function encodeNicknameKey(rawNickname: string): string {
  const normalized = rawNickname.trim().toLowerCase();
  let hex = '';
  for (let i = 0; i < normalized.length; i += 1) {
    hex += normalized.charCodeAt(i).toString(16).padStart(2, '0');
  }
  return `nick_${hex}`;
}

export function validateNickname(raw: string): NicknameValidationResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, message: '请输入昵称。' };
  }
  if (trimmed.length < 2 || trimmed.length > 32) {
    return {
      ok: false,
      message: '昵称长度需在 2 到 32 个字符之间。',
    };
  }
  if (!NICKNAME_PATTERN.test(trimmed)) {
    return {
      ok: false,
      message:
        '昵称仅允许英文字母与常用符号组合（如 _ - . ! @），不支持中文、数字或空格。',
    };
  }
  if (!HAS_ENGLISH_LETTER.test(trimmed)) {
    return {
      ok: false,
      message: '昵称至少需包含 1 个英文字母，可搭配符号组合使用。',
    };
  }
  return {
    ok: true,
    nickname: trimmed,
    key: encodeNicknameKey(trimmed),
  };
}

export function looksLikeEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.trim());
}
