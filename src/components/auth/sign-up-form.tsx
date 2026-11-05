"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUp, type FormState } from "@/app/(auth)/actions";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";
import { PASSWORD_HINT } from "@/lib/validation/auth";

export function SignUpForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(signUp, { status: "idle" });

  if (state.status === "success") {
    return (
      <div className="space-y-3">
        <h1 className="text-lg font-semibold text-midnight">Check your email</h1>
        <p className="text-sm text-midnight/80">
          We sent a confirmation link to the address you entered. Open it to finish creating your account.
        </p>
        <Link href="/sign-in" className="text-sm text-[#1d6fc4] underline-offset-2 hover:underline">Back to sign in</Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      <h1 className="text-lg font-semibold text-midnight">Create your account</h1>
      {state.message && <FormMessage tone="error">{state.message}</FormMessage>}
      <Field id="email" name="email" type="email" label="Email" autoComplete="email" required error={state.fieldErrors?.email} />
      <Field id="password" name="password" type="password" label="Password" autoComplete="new-password" required hint={PASSWORD_HINT} error={state.fieldErrors?.password} />
      <SubmitButton pending={pending}>Create account</SubmitButton>
      <p className="text-sm text-midnight/80">
        Already have an account? <Link href="/sign-in" className="text-[#1d6fc4] underline-offset-2 hover:underline">Sign in</Link>
      </p>
    </form>
  );
}
