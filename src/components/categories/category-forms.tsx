"use client";

import { useActionState } from "react";
import { addCategory, renameCategory, setCategoryArchived, type CategoryState } from "@/app/(app)/categories/actions";
import { errorText, inputClass, primaryButton, secondaryButton } from "@/components/ui/styles";

const idle: CategoryState = { status: "idle" };

export function AddCategoryForm({ kind }: { kind: "income" | "expense" }) {
  const [state, action, pending] = useActionState(addCategory, idle);
  const id = `new-${kind}`;
  const errorId = `${id}-error`;
  return (
    <form action={action} className="space-y-1" noValidate>
      <input type="hidden" name="kind" value={kind} />
      <label htmlFor={id} className="block text-sm font-medium text-midnight">New {kind} category</label>
      <div className="flex gap-2">
        <input id={id} name="name" required maxLength={100} className={inputClass}
          aria-invalid={state.status === "error" ? true : undefined} aria-describedby={state.status === "error" ? errorId : undefined} />
        <button type="submit" disabled={pending} className={primaryButton}>Add</button>
      </div>
      {state.status === "error" && <p id={errorId} aria-live="polite" className={errorText}>{state.message}</p>}
    </form>
  );
}

export function CategoryRow({ id, name }: { id: string; name: string }) {
  const [renameState, renameAction, renaming] = useActionState(renameCategory, idle);
  const [archiveState, archiveAction, archiving] = useActionState(setCategoryArchived, idle);
  const inputId = `cat-${id}`;
  const error = renameState.status === "error" ? renameState.message : archiveState.status === "error" ? archiveState.message : undefined;
  return (
    <li className="space-y-1 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <form action={renameAction} className="flex min-w-0 flex-1 gap-2">
          <input type="hidden" name="id" value={id} />
          <label htmlFor={inputId} className="sr-only">Name for {name}</label>
          <input id={inputId} name="name" defaultValue={name} required maxLength={100} className={`${inputClass} min-w-0`}
            aria-invalid={error ? true : undefined} aria-describedby={error ? `${inputId}-error` : undefined} />
          <button type="submit" disabled={renaming} className={secondaryButton}>Save</button>
        </form>
        <form action={archiveAction}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="archived" value="true" />
          <button type="submit" disabled={archiving} className={secondaryButton}>Archive</button>
        </form>
      </div>
      {error && <p id={`${inputId}-error`} aria-live="polite" className={errorText}>{error}</p>}
    </li>
  );
}

export function ArchivedCategoryRow({ id, name, kind }: { id: string; name: string; kind: string }) {
  const [state, action, pending] = useActionState(setCategoryArchived, idle);
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2">
      <span className="text-midnight/80">
        {name} <span className="text-xs">({kind}, archived)</span>
      </span>
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="archived" value="false" />
        <button type="submit" disabled={pending} className={secondaryButton}>Unarchive</button>
      </form>
      {state.status === "error" && <p aria-live="polite" className={`${errorText} w-full`}>{state.message}</p>}
    </li>
  );
}
