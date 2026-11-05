// Turn database errors into messages that are safe to show. Raw Postgres text
// (constraint names, SQL, paths) is never returned to the browser; only the
// messages our own posting functions raise (SQLSTATE 22023) pass through.

export const GENERIC_MESSAGE = "Something went wrong. Please try again.";

type DbError = { code?: string | null; message?: string | null } | null | undefined;

function sentence(text: string): string {
  const t = text.trim();
  const capitalised = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?]$/.test(capitalised) ? capitalised : `${capitalised}.`;
}

export function toUserMessage(error: DbError, overrides: { duplicate?: string } = {}): string {
  if (!error) return GENERIC_MESSAGE;
  switch (error.code) {
    case "42501": // permission denied, or "workspace not found" from our functions
    case "22P02": // malformed id
    case "PGRST116": // no row
      return "Not found.";
    case "22023": {
      const msg = error.message ?? "";
      return msg.length > 0 && msg.length <= 200 ? sentence(msg) : GENERIC_MESSAGE;
    }
    case "23505":
      return overrides.duplicate ?? "That name is already in use.";
    case "23514":
      return "That value isn't allowed.";
    default:
      return GENERIC_MESSAGE;
  }
}

/** Server-side log line with the code only (no user data or SQL). */
export function logDbError(context: string, error: DbError) {
  console.error(`${context} failed`, { code: error?.code ?? "unknown" });
}
