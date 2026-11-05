"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, type FormState } from "@/app/(auth)/actions";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(requestPasswordReset, { status: "idle" });

  if (state.status === "success") {
    return (
      <div className="space-y-3">
        <h1 className="text-lg font-semibold text-midnight">Check your email</h1>
        <p className="text-sm text-midnight/80">
          If an account exists for that address, we&apos;ve sent a link to reset the password. It expires in one hour.
        </p>
        <Link href="/sign-in" className="text-sm text-[#1d6fc4] underline-offset-2 hover:underline">Back to sign in</Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      <h1 className="text-lg font-semibold text-midnight">Reset your password</h1>
      <p className="text-sm text-midnight/80">Enter your email and we&apos;ll send you a link to choose a new password.</p>
      {state.message && <FormMessage tone="error">{state.message}</FormMessage>}
      <Field id="email" name="email" type="email" label="Email" autoComplete="email" required error={state.fieldErrors?.email} />
      <SubmitButton pending={pending}>Send reset link</SubmitButton>
      <Link href="/sign-in" className="block text-sm text-[#1d6fc4] underline-offset-2 hover:underline">Back to sign in</Link>
    </form>
  );
}
