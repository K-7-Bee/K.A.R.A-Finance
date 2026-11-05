"use client";

import { useActionState } from "react";
import { updatePassword, type FormState } from "@/app/(auth)/actions";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";
import { PASSWORD_HINT } from "@/lib/validation/auth";

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(updatePassword, { status: "idle" });
  return (
    <form action={action} className="max-w-sm space-y-4" noValidate>
      {state.status === "success" && <FormMessage tone="success">Password updated. Use it next time you sign in.</FormMessage>}
      {state.message && <FormMessage tone="error">{state.message}</FormMessage>}
      <Field id="password" name="password" type="password" label="New password" autoComplete="new-password" required hint={PASSWORD_HINT} error={state.fieldErrors?.password} />
      <SubmitButton pending={pending}>Save new password</SubmitButton>
    </form>
  );
}
