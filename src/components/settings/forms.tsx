"use client";

import { useActionState } from "react";
import { updateProfile, updateWorkspace, type SettingsState } from "@/app/(app)/settings/actions";
import { FormMessage } from "@/components/ui/form";

const inputClass =
  "block w-full rounded-lg border border-midnight/20 bg-white px-3 py-2 text-midnight focus:border-blue focus:outline-none focus:ring-2 focus:ring-blue/40 aria-invalid:border-coral";
const buttonClass =
  "rounded-lg bg-midnight px-4 py-2 text-sm font-medium text-white hover:bg-midnight/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue focus-visible:ring-offset-2 disabled:opacity-60";
const cardClass = "space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-midnight/10";

function FieldError({ id, error }: { id: string; error?: string }) {
  return error ? <p id={id} aria-live="polite" className="text-sm text-[#b3264d]">{error}</p> : null;
}

function Messages({ state }: { state: SettingsState }) {
  if (state.status === "success" && state.message) return <FormMessage tone="success">{state.message}</FormMessage>;
  if (state.status === "error" && state.message) return <FormMessage tone="error">{state.message}</FormMessage>;
  return null;
}

export function ProfileForm({ displayName, email }: { displayName: string; email: string }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(updateProfile, { status: "idle" });
  const err = state.fieldErrors?.displayName;
  return (
    <form action={action} className={cardClass}>
      <h2 className="font-semibold text-midnight">Profile</h2>
      <Messages state={state} />
      <div className="space-y-1">
        <label htmlFor="email" className="block text-sm font-medium text-midnight">Email</label>
        <input id="email" value={email} readOnly className={`${inputClass} bg-cloud`} />
      </div>
      <div className="space-y-1">
        <label htmlFor="displayName" className="block text-sm font-medium text-midnight">Display name</label>
        <input id="displayName" name="displayName" defaultValue={displayName} maxLength={100} autoComplete="name"
          aria-invalid={err ? true : undefined} aria-describedby={err ? "displayName-error" : undefined} className={inputClass} />
        <FieldError id="displayName-error" error={err} />
      </div>
      <button type="submit" disabled={pending} className={buttonClass}>Save profile</button>
    </form>
  );
}

export function WorkspaceForm({
  name,
  timezone,
  baseCurrency,
  timezones,
}: {
  name: string;
  timezone: string;
  baseCurrency: string;
  timezones: string[];
}) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(updateWorkspace, { status: "idle" });
  const nameErr = state.fieldErrors?.workspaceName;
  const tzErr = state.fieldErrors?.timezone;
  return (
    <form action={action} className={cardClass}>
      <h2 className="font-semibold text-midnight">Workspace</h2>
      <Messages state={state} />
      <div className="space-y-1">
        <label htmlFor="workspaceName" className="block text-sm font-medium text-midnight">Workspace name</label>
        <input id="workspaceName" name="workspaceName" defaultValue={name} required maxLength={100}
          aria-invalid={nameErr ? true : undefined} aria-describedby={nameErr ? "workspaceName-error" : undefined} className={inputClass} />
        <FieldError id="workspaceName-error" error={nameErr} />
      </div>
      <div className="space-y-1">
        <label htmlFor="timezone" className="block text-sm font-medium text-midnight">Timezone</label>
        <select id="timezone" name="timezone" defaultValue={timezone}
          aria-invalid={tzErr ? true : undefined} aria-describedby={`timezone-hint${tzErr ? " timezone-error" : ""}`} className={inputClass}>
          {timezones.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
        </select>
        <p id="timezone-hint" className="text-xs text-midnight/80">Dates and monthly totals use this timezone.</p>
        <FieldError id="timezone-error" error={tzErr} />
      </div>
      <div className="space-y-1">
        <label htmlFor="baseCurrency" className="block text-sm font-medium text-midnight">Base currency</label>
        <input id="baseCurrency" value={baseCurrency} readOnly aria-describedby="baseCurrency-hint" className={`${inputClass} bg-cloud`} />
        <p id="baseCurrency-hint" className="text-xs text-midnight/80">Can&apos;t be changed after setup.</p>
      </div>
      <button type="submit" disabled={pending} className={buttonClass}>Save workspace</button>
    </form>
  );
}
