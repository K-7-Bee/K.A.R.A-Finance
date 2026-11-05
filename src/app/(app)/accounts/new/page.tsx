import type { Metadata } from "next";
import { AccountForm } from "@/components/accounts/account-form";
import { getCurrencies } from "@/lib/data/currencies";
import { localDateInput } from "@/lib/dates";
import { getPersonalWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "Add account · KARA Finance" };

export default async function NewAccountPage() {
  const { workspace } = await getPersonalWorkspace();
  const currencies = await getCurrencies();
  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold text-midnight">Add account</h1>
      <AccountForm
        currencies={currencies}
        baseCurrency={workspace.base_currency}
        today={localDateInput(new Date(), workspace.timezone)}
      />
    </section>
  );
}
