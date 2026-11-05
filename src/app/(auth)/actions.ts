"use server";

import { redirect } from "next/navigation";
import { safeNext } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";
import { validateEmail, validatePassword } from "@/lib/validation/auth";

export type FormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Partial<Record<"email" | "password", string>>;
};

// One message for wrong password and unknown email, so the form never reveals
// whether an account exists.
const INVALID_CREDENTIALS = "Email or password is incorrect.";
const GENERIC_ERROR = "Something went wrong. Please try again.";
const RATE_LIMITED = "Too many attempts. Wait a minute and try again.";

function isRateLimit(code: string | undefined) {
  return code === "over_request_rate_limit" || code === "over_email_send_rate_limit";
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = validateEmail(formData.get("email"));
  const password = formData.get("password");
  if (!email.ok) return { status: "error", fieldErrors: { email: email.error } };
  if (typeof password !== "string" || password.length === 0) {
    return { status: "error", fieldErrors: { password: "Enter your password." } };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: email.value, password });
  if (error) {
    if (error.code === "email_not_confirmed") {
      return { status: "error", message: "Please confirm your email first. Check your inbox for the link." };
    }
    if (isRateLimit(error.code)) return { status: "error", message: RATE_LIMITED };
    if (error.code === "invalid_credentials") return { status: "error", message: INVALID_CREDENTIALS };
    return { status: "error", message: GENERIC_ERROR };
  }

  redirect(safeNext(formData.get("next") as string | null));
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = validateEmail(formData.get("email"));
  const password = validatePassword(formData.get("password"));
  if (!email.ok || !password.ok) {
    return {
      status: "error",
      fieldErrors: {
        email: email.ok ? undefined : email.error,
        password: password.ok ? undefined : password.error,
      },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email: email.value, password: password.value });
  if (error) {
    // Supabase reports an already-confirmed address. Answer exactly as for a
    // new sign-up so the form never reveals whether an account exists.
    if (error.code === "user_already_exists") return { status: "success" };
    if (error.code === "weak_password") return { status: "error", fieldErrors: { password: error.message } };
    if (isRateLimit(error.code)) return { status: "error", message: RATE_LIMITED };
    return { status: "error", message: GENERIC_ERROR };
  }
  return { status: "success" };
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = validateEmail(formData.get("email"));
  if (!email.ok) return { status: "error", fieldErrors: { email: email.error } };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.value);
  if (error && isRateLimit(error.code)) return { status: "error", message: RATE_LIMITED };
  // Log other failures (e.g. email delivery down) without telling the visitor
  // anything that would reveal whether the account exists.
  if (error) console.error("password reset request failed", { code: error.code, status: error.status });
  // Same answer whether or not the account exists.
  return { status: "success" };
}

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const password = validatePassword(formData.get("password"));
  if (!password.ok) return { status: "error", fieldErrors: { password: password.error } };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=%2Freset-password");

  const { error } = await supabase.auth.updateUser({ password: password.value });
  if (error) {
    if (error.code === "same_password") {
      return { status: "error", fieldErrors: { password: "Choose a password you haven't used here before." } };
    }
    if (error.code === "weak_password") return { status: "error", fieldErrors: { password: error.message } };
    if (error.code === "reauthentication_needed") {
      return { status: "error", message: "For your security, use the reset link from your email to change your password." };
    }
    if (isRateLimit(error.code)) return { status: "error", message: RATE_LIMITED };
    return { status: "error", message: GENERIC_ERROR };
  }
  return { status: "success" };
}

export async function signOut() {
  const supabase = await createClient();
  // Local cookies are cleared either way; log if the server-side revoke failed.
  const { error } = await supabase.auth.signOut();
  if (error) console.error("sign-out failed", { code: error.code, status: error.status });
  redirect("/sign-in");
}
