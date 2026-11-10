"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Download,
  LayoutDashboard,
  Plus,
  Settings2,
  type LucideIcon,
} from "lucide-react";
import { cx } from "@/components/ui";

/**
 * App shell navigation.
 *
 * Desktop: a quiet sidebar list with an animated active pill.
 * Mobile: a thumb-reachable, glassy bottom bar with a raised "add" action.
 * The active item always carries `aria-current="page"` and a text label.
 */

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  special?: boolean;
}

const ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/purchases/new", label: "Add", icon: Plus, special: true },
  { href: "/settings", label: "Settings", icon: Settings2 },
  { href: "/export", label: "Export", icon: Download },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNav({ variant = "sidebar" }: { variant?: "sidebar" | "mobile" }) {
  const pathname = usePathname() ?? "";

  if (variant === "mobile") {
    return (
      <nav
        aria-label="Main"
        className="glass-bar fixed inset-x-0 bottom-0 z-40 border-t border-border/80 pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <ul className="mx-auto flex w-full max-w-lg items-end justify-around px-3">
          {ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;

            if (item.special) {
              return (
                <li key={item.href} className="-mt-5">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    aria-label="Add purchase"
                    className="group flex flex-col items-center gap-1"
                  >
                    <span
                      className={cx(
                        "grid size-12 place-items-center rounded-2xl border border-white/20 bg-[linear-gradient(145deg,var(--accent),var(--accent-2))] text-accent-fg shadow-[0_12px_28px_-12px_var(--ring)] transition-transform duration-200 group-hover:-translate-y-0.5 group-active:scale-95",
                        active && "ring-2 ring-accent/40 ring-offset-2 ring-offset-background",
                      )}
                    >
                      <Icon className="size-5" strokeWidth={2.4} aria-hidden="true" />
                    </span>
                    <span className={cx("text-[0.62rem] font-semibold", active ? "text-accent" : "text-muted")}>
                      Add
                    </span>
                  </Link>
                </li>
              );
            }

            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "relative flex min-h-[3.6rem] flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[0.62rem] font-semibold transition",
                    active ? "text-accent" : "text-muted hover:text-foreground",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cx(
                      "absolute top-0 h-0.5 w-6 rounded-full bg-accent transition-opacity",
                      active ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <Icon
                    className={cx("size-[1.35rem] transition-transform", active && "-translate-y-px")}
                    strokeWidth={active ? 2.2 : 1.9}
                    aria-hidden="true"
                  />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  return (
    <nav aria-label="Main">
      <ul className="flex flex-col gap-1">
        {ITEMS.filter((item) => !item.special).map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "group relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-[background,color,transform] duration-200",
                  active
                    ? "bg-accent-soft text-accent"
                    : "text-muted hover:translate-x-0.5 hover:bg-surface-2 hover:text-foreground",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cx(
                    "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-accent transition-all duration-200",
                    active ? "scale-y-100 opacity-100" : "scale-y-0 opacity-0",
                  )}
                />
                <Icon
                  className="size-[1.15rem] transition-transform duration-200 group-hover:scale-105"
                  strokeWidth={active ? 2.2 : 1.9}
                  aria-hidden="true"
                />
                <span>{item.label}</span>
                {active ? (
                  <span className="ml-auto size-1.5 rounded-full bg-accent" aria-hidden="true" />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
