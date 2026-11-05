import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReconcileForm } from "@/components/accounts/account-forms";
import { Balance } from "@/components/accounts/balance";
import { cardClass, linkClass } from "@/components/ui/styles";
import { isLiability } from "@/lib/accounts";
import { getAccount } from "@/lib/data/accounts";
import { getCurrencies } from "@/lib/data/currencies";
import { localDateInput } from "@/lib/dates";
import { getPersonalWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "Reconcile · KARA Finance" };

export default async function ReconcilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { workspace } = await getPersonalWorkspace();
  const account = await getAccount(id);
  if (!account || account.workspaceId !== workspace.id) notFound();
  const minorUnit = (await getCurrencies()).find((c) => c.code === account.currency)?.minorUnit ?? 0;

  return (
    <section className="space-y-6">
      <Link href={`/accounts/${account.id}`} className={`text-sm ${linkClass}`}>← {account.name}</Link>
      <h1 className="text-2xl font-semibold text-midnight">Reconcile {account.name}</h1>

      {account.isArchived ? (
        <p role="note" className={`${cardClass} text-midnight`}>
          This account is archived. Unarchive it to reconcile.
        </p>
      ) : (
        <>
          <p className={`${cardClass} text-midnight`}>
            Balance in KARA:{" "}
            <Balance minor={account.balance} currency={account.currency} minorUnit={minorUnit} type={account.type} className="font-semibold" />
          </p>
          <ReconcileForm accountId={account.id} owed={isLiability(account.type)} today={localDateInput(new Date(), workspace.timezone)} />
        </>
      )}
    </section>
  );
}
