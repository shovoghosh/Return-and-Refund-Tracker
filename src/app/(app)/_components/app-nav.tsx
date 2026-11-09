"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

/**
 * The app shell navigation. Rendered once by the authenticated (app) layout.
 *
 * Mobile-first: on a narrow phone it is a fixed, thumb-reachable bottom bar with
 * full-height tap targets; from `sm` up it becomes a normal inline nav row. The
 * active link is marked with `aria-current="page"` and a weight change, never by
 * colour alone.
 */

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-6 sm:size-5"
    >
      {children}
    </svg>
  );
}

const ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <Icon>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </Icon>
    ),
  },
  {
    href: "/notifications",
    label: "Notifications",
    icon: (
      <Icon>
        <path d="M18 8a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7" />
        <path d="M10.5 20a2 2 0 0 0 3 0" />
      </Icon>
    ),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: (
      <Icon>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
      </Icon>
    ),
  },
];

export function AppNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] sm:static sm:z-auto sm:rounded-xl sm:border sm:pb-0"
    >
      <ul className="mx-auto flex w-full max-w-5xl sm:max-w-none">
        {ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="flex-1 sm:flex-none">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs",
                  "sm:min-h-11 sm:flex-row sm:gap-2 sm:px-4 sm:text-sm",
                  active
                    ? "font-semibold text-accent"
                    : "font-medium text-muted hover:text-foreground",
                )}
              >
                <span aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}