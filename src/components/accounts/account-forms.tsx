"use client";

import { useActionState, useState } from "react";
import {
  reconcileAccount,
  renameAccount,
  setAccountArchived,
  setOpeningBalance,
  type ActionState,
} from "@/app/(app)/accounts/actions";
import { describedBy, FieldError } from "@/components/ui/field-error";
import { FormMessage } from "@/components/ui/form";
import { dangerButton, inputClass, labelClass, primaryButton, secondaryButton } from "@/components/ui/styles";

const idle: ActionState = { status: "idle" };

function Messages({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return <FormMessage tone={state.status === "success" ? "success" : "error"}>{state.message}</FormMessage>;
}

export function OpeningBalanceForm({
  accountId, owed, amount, date,
}: { accountId: string; owed: boolean; amount: string; date: string }) {
  const [state, action, pending] = useActionState(setOpeningBalance, idle);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-3" noValidate>
      <Messages state={state} />
      <input type="hidden" name="accountId" value={accountId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="opening-amount" className={labelClass}>{owed ? "Amount owed at opening" : "Opening balance"}</label>
          <input id="opening-amount" name="amount" inputMode="decimal" defaultValue={amount} placeholder="0" autoComplete="off"
            className={`${inputClass} tabular-nums`} aria-invalid={e.amount ? true : undefined}
            aria-describedby={describedBy("opening-hint", e.amount && "opening-amount-error")} />
          <FieldError id="opening-amount-error" error={e.amount} />
        </div>
        <div className="space-y-1">
          <label htmlFor="opening-date" className={labelClass}>Opening date</label>
          <input id="opening-date" name="date" type="date" defaultValue={date} className={inputClass}
            aria-invalid={e.date ? true : undefined} aria-describedby={describedBy(e.date && "opening-date-error")} />
          <FieldError id="opening-date-error" error={e.date} />
        </div>
      </div>
      <p id="opening-hint" className="text-xs text-midnight/80">
        Changing this moves the current balance by the same amount, even after a reconciliation. Set to 0 to remove it.
      </p>
      <button type="submit" disabled={pending} className={primaryButton}>Save opening balance</button>
    </form>
  );
}

export function RenameForm({ accountId, name }: { accountId: string; name: string }) {
  const [state, action, pending] = useActionState(renameAccount, idle);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-3" noValidate>
      <Messages state={state} />
      <input type="hidden" name="accountId" value={accountId} />
      <div className="space-y-1">
        <label htmlFor="account-name" className={labelClass}>Account name</label>
        <div className="flex gap-2">
          <input id="account-name" name="name" defaultValue={name} required maxLength={100} className={inputClass}
            aria-invalid={e.name ? true : undefined} aria-describedby={describedBy(e.name && "account-name-error")} />
          <button type="submit" disabled={pending} className={secondaryButton}>Rename</button>
        </div>
        <FieldError id="account-name-error" error={e.name} />
      </div>
    </form>
  );
}

export function ArchiveControl({ accountId, archived }: { accountId: string; archived: boolean }) {
  const [state, action, pending] = useActionState(setAccountArchived, idle);
  const [confirming, setConfirming] = useState(false);

  if (archived) {
    return (
      <form action={action} className="space-y-3">
        {state.status === "error" && <Messages state={state} />}
        <input type="hidden" name="accountId" value={accountId} />
        <input type="hidden" name="archived" value="false" />
        <button type="submit" disabled={pending} className={secondaryButton}>Unarchive account</button>
      </form>
    );
  }

  if (!confirming) {
    return (
      <div className="space-y-2">
        {state.status === "error" && <Messages state={state} />}
        <p className="text-sm text-midnight/80">Archived accounts keep their history but are hidden from lists and totals.</p>
        <button type="button" onClick={() => setConfirming(true)} className={secondaryButton}>Archive account</button>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3" role="group" aria-label="Confirm archive">
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="archived" value="true" />
      <p className="text-sm text-midnight">Archive this account? You can unarchive it at any time.</p>
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={dangerButton}>Yes, archive</button>
        <button type="button" onClick={() => setConfirming(false)} className={secondaryButton}>Cancel</button>
      </div>
    </form>
  );
}

export function ReconcileForm({ accountId, owed, today }: { accountId: string; owed: boolean; today: string }) {
  const [state, action, pending] = useActionState(reconcileAccount, idle);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="max-w-md space-y-4" noValidate>
      <Messages state={state} />
      <input type="hidden" name="accountId" value={accountId} />
      <div className="space-y-1">
        <label htmlFor="actual" className={labelClass}>{owed ? "Amount you owe" : "Actual balance"}</label>
        <input id="actual" name="amount" inputMode="decimal" required autoComplete="off" className={`${inputClass} tabular-nums`}
          aria-invalid={e.amount ? true : undefined} aria-describedby={describedBy("actual-hint", e.amount && "actual-error")} />
        <p id="actual-hint" className="text-xs text-midnight/80">
          {owed ? "From your card statement, as a positive number." : "From your bank app or statement."}
        </p>
        <FieldError id="actual-error" error={e.amount} />
      </div>
      <div className="space-y-1">
        <label htmlFor="as-of" className={labelClass}>As of</label>
        <input id="as-of" name="asOf" type="date" defaultValue={today} required className={inputClass}
          aria-invalid={e.asOf ? true : undefined} aria-describedby={describedBy("as-of-hint", e.asOf && "as-of-error")} />
        <p id="as-of-hint" className="text-xs text-midnight/80">Includes everything up to the end of this day.</p>
        <FieldError id="as-of-error" error={e.asOf} />
      </div>
      <button type="submit" disabled={pending} className={primaryButton}>Reconcile</button>
    </form>
  );
}
