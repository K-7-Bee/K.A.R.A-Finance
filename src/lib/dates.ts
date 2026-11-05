// Timestamps are stored as timestamptz (UTC instants) and shown in the
// workspace's timezone.

/** The zone if Intl can format it, otherwise UTC, so a bad stored value never crashes a page. */
function usableTimeZone(timeZone: string): string {
  try {
    new Intl.DateTimeFormat("en", { timeZone });
    return timeZone;
  } catch {
    return "UTC";
  }
}

export function formatInTimeZone(
  iso: string | Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
  locale = "en-GB",
): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: usableTimeZone(timeZone) }).format(new Date(iso));
}

/** The calendar month containing `now` in `timeZone`, as inclusive YYYY-MM-DD dates. */
export function localMonthRange(timeZone: string, now: Date = new Date()): { from: string; to: string } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: usableTimeZone(timeZone), year: "numeric", month: "2-digit" }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, "0");
  return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(lastDay).padStart(2, "0")}` };
}
