import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-3 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-midnight/10">
        <h1 className="text-lg font-semibold text-midnight">This link didn&apos;t work</h1>
        <p className="text-sm text-midnight/80">
          It may have expired or already been used. Request a new one and try again.
        </p>
        <div className="flex gap-4 text-sm">
          <Link href="/sign-in" className="text-[#1d6fc4] underline-offset-2 hover:underline">Sign in</Link>
          <Link href="/forgot-password" className="text-[#1d6fc4] underline-offset-2 hover:underline">Reset password</Link>
        </div>
      </div>
    </main>
  );
}
