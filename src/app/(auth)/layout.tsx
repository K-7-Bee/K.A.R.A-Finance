export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <p className="mb-6 text-xl font-semibold tracking-tight text-midnight">KARA Finance</p>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm ring-1 ring-midnight/10">{children}</div>
    </main>
  );
}
