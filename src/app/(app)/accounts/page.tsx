import type { Metadata } from "next";

export const metadata: Metadata = { title: "Accounts · KARA Finance" };

export default function AccountsPage() {
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold text-midnight">Accounts</h1>
      <p className="text-midnight/80">Creating accounts, opening balances and reconciliation arrive in the next update.</p>
    </section>
  );
}
