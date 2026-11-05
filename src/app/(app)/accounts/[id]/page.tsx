import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArchiveControl, OpeningBalanceForm, RenameForm } from "@/components/accounts/account-forms";
import { Balance } from "@/components/accounts/balance";
import { cardClass, linkClass, secondaryButton } from "@/components/ui/styles";
import { accountTypeLabel, fromSignedOpening, isLiability } from "@/lib/accounts";
import { getAccount } from "@/lib/data/accounts";
import { getCurrencies } from "@/lib/data/currencies";
import { localDateInput } from "@/lib/dates";
import { formatAmountInput } from "@/lib/display";
import { getPersonalWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "Account · KARA Finance" };

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { workspace } = await getPersonalWorkspace();
  const account = await getAccount(id);
  if (!account || account.workspaceId !== workspace.id) notFound();

  const currencies = await getCurrencies();
  const minorUnit = currencies.find((c) => c.code === account.currency)?.minorUnit ?? 0;
  const owed = isLiability(account.type);
  const openingAmount = account.opening
    ? formatAmountInput(fromSignedOpening(account.type, account.opening.amount), minorUnit)
    : "";
  const openingDate = localDateInput(account.opening?.occurredAt ?? new Date(), workspace.timezone);

  return (
    <section className="space-y-6">
      <Link href="/accounts" className={`text-sm ${linkClass}`}>← Accounts</Link>

      <header className={`${cardClass} flex flex-wrap items-end justify-between gap-3`}>
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-semibold text-midnight">{account.name}</h1>
          <p className="text-sm text-midnight/80">{accountTypeLabel(account.type)} · {account.currency}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-midnight/80">Current balance</p>
          <Balance testId="account-balance" minor={account.balance} currency={account.currency} minorUnit={minorUnit}
            type={account.type} className="text-3xl font-semibold" />
        </div>
      </header>

      {account.isArchived ? (
        <div role="note" className={`${cardClass} space-y-3`}>
          <p className="font-medium text-midnight">This account is archived</p>
          <p className="text-sm text-midnight/80">Unarchive it to edit the opening balance or reconcile.</p>
          <ArchiveControl accountId={account.id} archived />
        </div>
      ) : (
        <>
          <div className={`${cardClass} space-y-3`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-midnight">Reconcile</h2>
              <Link href={`/accounts/${account.id}/reconcile`} className={secondaryButton}>Reconcile</Link>
            </div>
            <p className="text-sm text-midnight/80">Compare with your bank or card statement and correct any difference.</p>
          </div>

          <div className={`${cardClass} space-y-3`}>
            <h2 className="font-semibold text-midnight">Starting point</h2>
            <OpeningBalanceForm accountId={account.id} owed={owed} amount={openingAmount} date={openingDate} />
          </div>
        </>
      )}

      <div className={`${cardClass} space-y-4`}>
        <h2 className="font-semibold text-midnight">Account settings</h2>
        <RenameForm key={account.name} accountId={account.id} name={account.name} />
        {!account.isArchived && <ArchiveControl accountId={account.id} archived={false} />}
      </div>
    </section>
  );
}
