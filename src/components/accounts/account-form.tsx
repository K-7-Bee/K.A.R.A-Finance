"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createAccount, type ActionState } from "@/app/(app)/accounts/actions";
import { describedBy, FieldError } from "@/components/ui/field-error";
import { FormMessage } from "@/components/ui/form";
import { inputClass, labelClass, linkClass, primaryButton } from "@/components/ui/styles";
import { ACCOUNT_TYPES } from "@/lib/accounts";

export function AccountForm({
  currencies,
  baseCurrency,
  today,
}: {
  currencies: { code: string }[];
  baseCurrency: string;
  today: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createAccount, { status: "idle" });
  const [type, setType] = useState("bank");
  const e = state.fieldErrors ?? {};
  const owed = type === "credit_card";

  return (
    <form action={action} className="max-w-md space-y-4" noValidate>
      {state.message && <FormMessage tone="error">{state.message}</FormMessage>}

      <div className="space-y-1">
        <label htmlFor="name" className={labelClass}>Name</label>
        <input id="name" name="name" required maxLength={100} placeholder="e.g. KB Bank checking" className={inputClass}
          aria-invalid={e.name ? true : undefined} aria-describedby={describedBy(e.name && "name-error")} />
        <FieldError id="name-error" error={e.name} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="type" className={labelClass}>Type</label>
          <select id="type" name="type" value={type} onChange={(ev) => setType(ev.target.value)} className={inputClass}
            aria-invalid={e.type ? true : undefined} aria-describedby={describedBy(e.type && "type-error")}>
            {ACCOUNT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <FieldError id="type-error" error={e.type} />
        </div>
        <div className="space-y-1">
          <label htmlFor="currency" className={labelClass}>Currency</label>
          <select id="currency" name="currency" defaultValue={baseCurrency} className={inputClass}
            aria-invalid={e.currency ? true : undefined} aria-describedby={describedBy(e.currency && "currency-error")}>
            {currencies.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
          </select>
          <FieldError id="currency-error" error={e.currency} />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="amount" className={labelClass}>{owed ? "Amount you owe now" : "Current balance"}</label>
        <input id="amount" name="amount" inputMode="decimal" autoComplete="off" placeholder="0" className={`${inputClass} tabular-nums`}
          aria-invalid={e.amount ? true : undefined} aria-describedby={describedBy("amount-hint", e.amount && "amount-error")} />
        <p id="amount-hint" className="text-xs text-midnight/80">
          {owed ? "Enter what you owe as a positive number." : "Leave empty to start at zero. Use a minus sign for an overdraft."}
        </p>
        <FieldError id="amount-error" error={e.amount} />
      </div>

      <div className="space-y-1">
        <label htmlFor="date" className={labelClass}>Opening date</label>
        <input id="date" name="date" type="date" defaultValue={today} className={inputClass}
          aria-invalid={e.date ? true : undefined} aria-describedby={describedBy(e.date && "date-error")} />
        <FieldError id="date-error" error={e.date} />
      </div>

      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending} className={primaryButton}>Create account</button>
        <Link href="/accounts" className={`text-sm ${linkClass}`}>Cancel</Link>
      </div>
    </form>
  );
}
