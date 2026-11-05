"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { isActive, type NavSection } from "@/lib/navigation";

const focusRing = "focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-midnight";

export function Sidebar({
  sections,
  workspaceName,
  email,
  signOut,
}: {
  sections: NavSection[];
  workspaceName: string;
  email: string;
  signOut: ReactNode;
}) {
  const pathname = usePathname();
  return (
    <aside className="hidden w-60 shrink-0 flex-col bg-midnight text-white lg:flex">
      <div className="px-5 py-6">
        <p className="text-lg font-semibold tracking-tight">KARA Finance</p>
        <p className="mt-1 truncate text-sm text-white/80" title={workspaceName}>{workspaceName}</p>
      </div>
      <nav aria-label="Main" className="flex-1 px-3">
        <ul className="space-y-1">
          {sections.map((s) => {
            const active = isActive(pathname, s.href);
            return (
              <li key={s.href}>
                <Link
                  href={s.href}
                  aria-current={active ? "page" : undefined}
                  className={`block rounded-lg px-3 py-2 text-sm ${focusRing} ${
                    active ? "bg-white/15 font-semibold text-white" : "text-white/85 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {s.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-white/15 px-5 py-4 text-sm">
        <p className="truncate text-white/80" title={email}>{email}</p>
        <div className="mt-2">{signOut}</div>
      </div>
    </aside>
  );
}

export const sidebarSignOutClass = `rounded text-sm font-medium text-white underline-offset-2 hover:underline ${focusRing}`;
