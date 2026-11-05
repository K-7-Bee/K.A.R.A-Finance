import type { Metadata } from "next";

export const metadata: Metadata = { title: "Overview · KARA Finance" };

export default function OverviewPage() {
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold text-midnight">Overview</h1>
      <p className="text-midnight/80">Your balances and this month&apos;s income and spending will appear here once you add accounts and transactions.</p>
    </section>
  );
}
