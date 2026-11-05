// Small shared form pieces. Labels are real <label>s; errors are announced.
import type { InputHTMLAttributes, ReactNode } from "react";

export function Field({
  label,
  hint,
  error,
  id,
  ...input
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string; id: string }) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-midnight">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="block w-full rounded-lg border border-midnight/20 bg-white px-3 py-2 text-midnight placeholder:text-midnight/40 focus:border-blue focus:outline-none focus:ring-2 focus:ring-blue/40 aria-invalid:border-coral"
        {...input}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-midnight/80">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} aria-live="polite" className="text-sm text-[#b3264d]">
          {error}
        </p>
      )}
    </div>
  );
}

export function FormMessage({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  // role="alert" for errors (assertive); status for success (polite).
  return tone === "error" ? (
    <p role="alert" className="rounded-lg border border-coral/50 bg-coral/10 px-3 py-2 text-sm text-[#8a1c3b]">
      {children}
    </p>
  ) : (
    <p role="status" className="rounded-lg border border-mint/60 bg-mint/10 px-3 py-2 text-sm text-[#14634e]">
      {children}
    </p>
  );
}

export function SubmitButton({ children, pending }: { children: ReactNode; pending?: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-midnight px-4 py-2.5 font-medium text-white hover:bg-midnight/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue focus-visible:ring-offset-2 disabled:opacity-60"
    >
      {children}
    </button>
  );
}
