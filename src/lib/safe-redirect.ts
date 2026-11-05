const FALLBACK = "/overview";
const BASE = "http://kara.invalid";

/**
 * Return `next` only if it is a same-origin relative path; otherwise the
 * Overview. Used for every post-auth redirect so a crafted `?next=` link can
 * never send a user to another site (open redirect).
 */
export function safeNext(next: string | null | undefined): string {
  if (typeof next !== "string" || next.length === 0 || next.length > 2048) return FALLBACK;
  // Must start with exactly one forward slash; no backslashes, whitespace or control characters.
  if (!next.startsWith("/") || next.startsWith("//")) return FALLBACK;
  if (/[\\\s\u0000-\u001f\u007f]/.test(next)) return FALLBACK;

  let decoded: string;
  try {
    decoded = decodeURIComponent(next);
  } catch {
    return FALLBACK;
  }
  if (decoded.startsWith("//") || decoded.includes("\\")) return FALLBACK;

  let result: string;
  try {
    const url = new URL(next, BASE);
    if (url.origin !== BASE) return FALLBACK;
    result = `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return FALLBACK;
  }

  // URL parsing folds "." and ".." segments, so "/.//evil.com" becomes
  // "//evil.com" (protocol-relative: another site). Check the final value too.
  let resultDecoded: string;
  try {
    resultDecoded = decodeURIComponent(result);
  } catch {
    return FALLBACK;
  }
  for (const candidate of [result, resultDecoded]) {
    if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) return FALLBACK;
  }
  return result;
}
