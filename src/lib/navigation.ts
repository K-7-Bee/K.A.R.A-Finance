// Every section from CLAUDE.md, tagged with the roadmap stage that builds it.
// Navigation shows only sections whose stage has shipped, so later-stage
// features are never reachable before they exist.

export const CURRENT_STAGE = 1;

export type NavSection = { href: string; label: string; stage: number };

export const NAV_SECTIONS: NavSection[] = [
  { href: "/overview", label: "Overview", stage: 1 },
  { href: "/transactions", label: "Transactions", stage: 1 },
  { href: "/accounts", label: "Accounts", stage: 1 },
  // Not in CLAUDE.md's section list; the MVP requires category management.
  { href: "/categories", label: "Categories", stage: 1 },
  { href: "/budgets", label: "Budgets", stage: 2 },
  { href: "/goals", label: "Goals", stage: 2 },
  { href: "/analytics", label: "Analytics", stage: 3 },
  { href: "/assistant", label: "AI Assistant", stage: 3 },
  { href: "/business", label: "Business", stage: 5 },
  { href: "/settings", label: "Settings", stage: 1 },
];

// CLAUDE.md mobile bar: Overview, Transactions, Goals, Analytics, More.
// Until Goals/Analytics ship, Accounts fills the gap.
const BAR_PREFERENCE = ["Overview", "Transactions", "Goals", "Analytics"];
const BAR_FALLBACK = ["Accounts"];
const BAR_SIZE = 4;

export function visibleNav(stage: number = CURRENT_STAGE) {
  const all = NAV_SECTIONS.filter((s) => s.stage <= stage);
  const byLabel = new Map(all.map((s) => [s.label, s]));

  const bar: NavSection[] = [];
  for (const label of [...BAR_PREFERENCE, ...BAR_FALLBACK]) {
    const section = byLabel.get(label);
    if (section && bar.length < BAR_SIZE) bar.push(section);
  }
  const more = all.filter((s) => !bar.includes(s));
  return { all, bar, more };
}

export const isActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);
