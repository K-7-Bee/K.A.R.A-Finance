// Client-side checks for instant feedback. Supabase Auth enforces the same
// rules (supabase/config.toml) and remains the source of truth.

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export const PASSWORD_MIN = 10;
const PASSWORD_MAX = 72; // bcrypt ignores bytes beyond 72

export function validateEmail(input: unknown): Result<string> {
  const value = typeof input === "string" ? input.trim() : "";
  if (value.length === 0) return { ok: false, error: "Enter your email address." };
  if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  return { ok: true, value };
}

export function validatePassword(input: unknown): Result<string> {
  const value = typeof input === "string" ? input : "";
  if (value.length < PASSWORD_MIN) return { ok: false, error: `Use at least ${PASSWORD_MIN} characters.` };
  if (new TextEncoder().encode(value).length > PASSWORD_MAX) {
    return { ok: false, error: `Use at most ${PASSWORD_MAX} characters.` };
  }
  if (!/[a-z]/.test(value)) return { ok: false, error: "Include a lowercase letter." };
  if (!/[A-Z]/.test(value)) return { ok: false, error: "Include an uppercase letter." };
  if (!/[0-9]/.test(value)) return { ok: false, error: "Include a number." };
  return { ok: true, value };
}

export const PASSWORD_HINT = `At least ${PASSWORD_MIN} characters, with an uppercase letter, a lowercase letter and a number.`;
