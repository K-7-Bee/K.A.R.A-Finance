import type { Metadata } from "next";
import Link from "next/link";
import { Balance } from "@/components/accounts/balance";
import { cardClass, linkClass, negativeText, primaryButton } from "@/components/ui/styles";
import { accountTypeLabel } from "@/lib/accounts";
import { listAccounts } from "@/lib/data/accounts";
import { getCurrencies } from "@/lib/data/currencies";
import { netByCurrency } from "@/lib/display";
import { formatMoney } from "@/lib/money";
import { getPersonalWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "Accounts · KARA Finance" };

export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ archived?: string }> }) {
  const showArchived = (await searchParams).archived === "1";
  const { workspace } = await getPersonalWorkspace();
  const [accounts, currencies] = await Promise.all([
    listAccounts(workspace.id, { includeArchived: true }),
    getCurrencies(),
  ]);
  const minorUnit = (code: string) => currencies.find((c) => c.code === code)?.minorUnit ?? 0;
  const visible = showArchived ? accounts : accounts.filter((a) => !a.isArchived);
  const totals = netByCurrency(accounts);
  const hasArchived = accounts.some((a) => a.isArchived);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-midnight">Accounts</h1>
        <Link href="/accounts/new" className={primaryButton}>Add account</Link>
      </div>

      {accounts.length === 0 ? (
        <div className={`${cardClass} text-center`}>
          <p className="font-medium text-midnight">No accounts yet</p>
          <p className="mt-1 text-sm text-midnight/80">Add your bank accounts, cash and cards to see what you have.</p>
        </div>
      ) : (
        <>
          {totals.length > 0 && (
            <dl className={`${cardClass} grid gap-3 sm:grid-cols-2`}>
              {totals.map((t) => (
                <div key={t.currency} data-testid={`total-${t.currency}`}>
                  <dt className="text-sm text-midnight/80">Net total ({t.currency})</dt>
                  <dd className={`text-2xl font-semibold tabular-nums ${t.net < 0 ? negativeText : "text-midnight"}`}>
                    {formatMoney(t.net, t.currency, minorUnit(t.currency))}
                  </dd>
                </div>
              ))}
              <p className="text-xs text-midnight/80 sm:col-span-2">Includes money owed on cards. Archived accounts are left out.</p>
            </dl>
          )}

          <ul className="space-y-2">
            {visible.map((a) => (
              <li key={a.id} className={`${cardClass} flex flex-wrap items-center justify-between gap-2 ${a.isArchived ? "opacity-75" : ""}`}>
                <div className="min-w-0">
                  <Link href={`/accounts/${a.id}`} className={`font-medium ${linkClass}`}>{a.name}</Link>
                  <p className="text-sm text-midnight/80">
                    {accountTypeLabel(a.type)} · {a.currency}
                    {a.isArchived && <span className="ml-2 rounded bg-cloud px-1.5 py-0.5 text-xs font-medium text-midnight">Archived</span>}
                  </p>
                </div>
                <Balance minor={a.balance} currency={a.currency} minorUnit={minorUnit(a.currency)} type={a.type} className="text-lg font-semibold" />
              </li>
            ))}
          </ul>

          {hasArchived && (
            <Link href={showArchived ? "/accounts" : "/accounts?archived=1"} className={`text-sm ${linkClass}`}>
              {showArchived ? "Hide archived" : "Show archived"}
            </Link>
          )}
        </>
      )}
    </section>
  );
}
