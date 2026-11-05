// Timezones the app can both store (Postgres checks pg_timezone_names) and
// format (Intl). Postgres also knows names like "Factory" that Intl rejects,
// so the app checks against Intl before saving.

export function timeZoneOptions(): string[] {
  const zones = Intl.supportedValuesOf("timeZone");
  return zones.includes("UTC") ? zones : ["UTC", ...zones];
}

export function isSupportedTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || tz.length === 0 || tz.length > 64) return false;
  if (!timeZoneOptions().includes(tz)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
