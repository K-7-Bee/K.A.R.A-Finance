import type { Metadata } from "next";

export const metadata: Metadata = { title: "Transactions · KARA Finance" };

export default function TransactionsPage() {
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold text-midnight">Transactions</h1>
      <p className="text-midnight/80">Adding, editing and searching transactions arrives in the next update.</p>
    </section>
  );
}
