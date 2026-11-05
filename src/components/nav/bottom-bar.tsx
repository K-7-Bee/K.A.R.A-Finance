"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { isActive, type NavSection } from "@/lib/navigation";

const focusRing = "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue focus-visible:ring-inset";

export function BottomBar({ bar, more, signOut }: { bar: NavSection[]; more: NavSection[]; signOut: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const moreActive = more.some((s) => isActive(pathname, s.href));

  // Close on navigation and on Escape; move focus into the panel when it opens.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const itemClass = (active: boolean) =>
    `flex h-14 flex-1 items-center justify-center px-1 text-center text-xs ${focusRing} ${
      active ? "font-semibold text-midnight" : "text-midnight/75"
    }`;

  return (
    <div className="lg:hidden">
      {open && (
        <div
          id={panelId}
          ref={panelRef}
          className="fixed inset-x-0 bottom-14 z-20 border-t border-midnight/10 bg-white px-4 py-3 shadow-lg"
        >
          <ul className="space-y-1">
            {more.map((s) => (
              <li key={s.href}>
                <Link
                  href={s.href}
                  aria-current={isActive(pathname, s.href) ? "page" : undefined}
                  className={`block rounded-lg px-3 py-2 text-sm text-midnight hover:bg-cloud ${focusRing}`}
                >
                  {s.label}
                </Link>
              </li>
            ))}
            <li className="border-t border-midnight/10 pt-2">{signOut}</li>
          </ul>
        </div>
      )}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-midnight/10 bg-white">
        <ul className="flex">
          {bar.map((s) => {
            const active = isActive(pathname, s.href);
            return (
              <li key={s.href} className="flex flex-1">
                <Link href={s.href} aria-current={active ? "page" : undefined} className={itemClass(active)}>
                  <span className={active ? "border-b-2 border-midnight pb-0.5" : "pb-0.5"}>{s.label}</span>
                </Link>
              </li>
            );
          })}
          <li className="flex flex-1">
            <button
              ref={buttonRef}
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => setOpen((o) => !o)}
              className={itemClass(moreActive || open)}
            >
              <span className={moreActive ? "border-b-2 border-midnight pb-0.5" : "pb-0.5"}>More</span>
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}

export const moreSignOutClass = `w-full rounded-lg px-3 py-2 text-left text-sm text-midnight hover:bg-cloud ${focusRing}`;
