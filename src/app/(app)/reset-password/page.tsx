import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = { title: "Change password · KARA Finance" };

export default function ResetPasswordPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold text-midnight">Change password</h1>
      <ResetPasswordForm />
    </section>
  );
}
