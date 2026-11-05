"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, type FormState } from "@/app/(auth)/actions";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";

export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, { status: "idle" });
  return (
    <form action={action} className="space-y-4" noValidate>
      <h1 className="text-lg font-semibold text-midnight">Sign in</h1>
      {state.message && <FormMessage tone="error">{state.message}</FormMessage>}
      <input type="hidden" name="next" value={next} />
      <Field id="email" name="email" type="email" label="Email" autoComplete="email" required error={state.fieldErrors?.email} />
      <Field id="password" name="password" type="password" label="Password" autoComplete="current-password" required error={state.fieldErrors?.password} />
      <SubmitButton pending={pending}>Sign in</SubmitButton>
      <div className="flex justify-between text-sm">
        <Link href="/forgot-password" className="text-[#1d6fc4] underline-offset-2 hover:underline">Forgot password?</Link>
        <Link href="/sign-up" className="text-[#1d6fc4] underline-offset-2 hover:underline">Create an account</Link>
      </div>
    </form>
  );
}
