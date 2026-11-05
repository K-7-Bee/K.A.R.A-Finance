import type { Metadata } from "next";
import { SignInForm } from "@/components/auth/sign-in-form";
import { safeNext } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Sign in · KARA Finance" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <SignInForm next={safeNext(next)} />;
}
