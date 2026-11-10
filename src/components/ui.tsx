import type {
  ButtonHTMLAttributes,
  ComponentProps,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import Link from "next/link";
import {
  Archive,
  ArrowRight,
  BadgeCheck,
  Bell,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  CircleHelp,
  Clock3,
  FileText,
  Hourglass,
  Inbox,
  Info,
  LoaderCircle,
  Package,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Truck,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { cx } from "@/lib/cx";
import { AnimatedNumber } from "@/components/motion";

export { cx };

/* -------------------------------------------------------------------------- */
/*  Buttons                                                                   */
/* -------------------------------------------------------------------------- */

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "soft";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "btn-shine border border-transparent bg-accent text-accent-fg shadow-[0_10px_24px_-14px_var(--ring)] hover:bg-accent-hover",
  secondary:
    "border border-border bg-surface text-foreground hover:border-accent/40 hover:bg-surface-2",
  danger:
    "border border-danger/35 bg-danger-soft/60 text-danger hover:border-danger hover:bg-danger hover:text-white",
  ghost: "border border-transparent bg-transparent text-muted hover:bg-surface-2 hover:text-foreground",
  soft: "border border-transparent bg-accent-soft text-accent hover:bg-accent/15",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "min-h-9 gap-1.5 rounded-lg px-3 text-xs",
  md: "min-h-11 gap-2 rounded-xl px-4 text-sm",
  lg: "min-h-12 gap-2.5 rounded-xl px-5 text-[0.95rem]",
  icon: "size-10 rounded-xl p-0",
};

export function buttonStyles({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}): string {
  return cx(
    "inline-flex items-center justify-center font-medium transition-[background,color,border-color,transform,box-shadow] duration-200 active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    className,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button {...props} className={buttonStyles({ variant, size, className })}>
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <Link href={href} {...props} className={buttonStyles({ variant, size, className })}>
      {children}
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/*  Surfaces                                                                  */
/* -------------------------------------------------------------------------- */

export function Card({
  children,
  className,
  tone = "default",
  hover = false,
  padding = "md",
}: {
  children: ReactNode;
  className?: string;
  tone?: "default" | "warm" | "moss" | "danger";
  hover?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}) {
  const tones = {
    default: "",
    warm: "border-warn-border bg-warn-bg",
    moss: "border-moss/25 bg-moss-soft/55",
    danger: "border-danger/25 bg-danger-soft/35",
  } as const;
  const paddings = {
    none: "",
    sm: "p-3 sm:p-4",
    md: "p-4 sm:p-5",
    lg: "p-5 sm:p-7",
  } as const;

  return (
    <div className={cx("card", tones[tone], paddings[padding], hover && "card-hover", className)}>
      {children}
    </div>
  );
}

export function IconTile({
  children,
  tone = "neutral",
  size = "md",
  className,
}: {
  children: ReactNode;
  tone?: "accent" | "warm" | "sky" | "moss" | "lilac" | "danger" | "neutral";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const tones = {
    accent: "border-accent/20 bg-accent-soft text-accent",
    warm: "border-warn-border bg-warn-bg text-warn",
    sky: "border-sky/20 bg-sky-soft text-sky",
    moss: "border-moss/20 bg-moss-soft text-moss",
    lilac: "border-lilac/20 bg-lilac-soft text-lilac",
    danger: "border-danger/20 bg-danger-soft text-danger",
    neutral: "border-border bg-surface-2 text-muted",
  } as const;
  const sizes = {
    sm: "size-8 rounded-lg [&_svg]:size-4",
    md: "size-10 rounded-xl [&_svg]:size-[1.15rem]",
    lg: "size-12 rounded-2xl [&_svg]:size-5",
  } as const;

  return <span className={cx("icon-tile", tones[tone], sizes[size], className)}>{children}</span>;
}

/* -------------------------------------------------------------------------- */
/*  Forms                                                                     */
/* -------------------------------------------------------------------------- */

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="flex items-center gap-1 text-[0.8rem] font-medium text-foreground-soft">
        {label}
        {required ? (
          <span className="text-accent" aria-hidden="true">
            *
          </span>
        ) : null}
        {required ? <span className="sr-only"> (required)</span> : null}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${htmlFor}-hint`} className="text-[0.72rem] leading-relaxed text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="flex items-start gap-1 text-[0.72rem] font-medium text-danger">
          <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

const CONTROL =
  "field-input min-h-11 disabled:cursor-not-allowed disabled:opacity-60 read-only:text-muted";

export function Input({
  className,
  leadingIcon,
  trailingIcon,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}) {
  const input = (
    <input
      {...props}
      className={cx(CONTROL, leadingIcon ? "pl-10" : false, trailingIcon ? "pr-10" : false, className)}
    />
  );

  if (!leadingIcon && !trailingIcon) return input;

  return (
    <span className="relative block w-full">
      {leadingIcon ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted [&_svg]:size-4"
        >
          {leadingIcon}
        </span>
      ) : null}
      {input}
      {trailingIcon ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted [&_svg]:size-4"
        >
          {trailingIcon}
        </span>
      ) : null}
    </span>
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="relative block w-full">
      <select {...props} className={cx(CONTROL, "appearance-none pr-10", className)}>
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted"
      />
    </span>
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(CONTROL, "min-h-24 resize-y py-2.5", className)} />;
}

/* -------------------------------------------------------------------------- */
/*  Status & feedback                                                         */
/* -------------------------------------------------------------------------- */

type Tone = "accent" | "sky" | "amber" | "moss" | "lilac" | "danger" | "neutral";

const TONE_STYLES: Record<Tone, string> = {
  accent: "border-accent/25 bg-accent-soft text-accent",
  sky: "border-sky/25 bg-sky-soft text-sky",
  amber: "border-warn-border bg-warn-bg text-warn",
  moss: "border-moss/25 bg-moss-soft text-moss",
  lilac: "border-lilac/25 bg-lilac-soft text-lilac",
  danger: "border-danger/25 bg-danger-soft text-danger",
  neutral: "border-border bg-surface-2 text-muted",
};

const STATUS_META: Record<string, { tone: Tone; icon: LucideIcon }> = {
  OPEN: { tone: "sky", icon: Package },
  RETURN_STARTED: { tone: "amber", icon: RotateCcw },
  RETURNED: { tone: "lilac", icon: Truck },
  REFUND_PENDING: { tone: "amber", icon: Hourglass },
  REFUND_RECEIVED: { tone: "moss", icon: BadgeCheck },
  KEPT: { tone: "neutral", icon: Archive },
  EXPIRED: { tone: "danger", icon: TriangleAlert },
};

/** Status badge. Always pairs a colour with an icon and a text label. */
export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  label: string;
  className?: string;
}) {
  const meta = STATUS_META[status] ?? { tone: "neutral" as Tone, icon: Info };
  const Icon = meta.icon;

  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold",
        TONE_STYLES[meta.tone],
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3.5" strokeWidth={2.1} />
      {label}
    </span>
  );
}

export function Badge({
  children,
  tone = "neutral",
  icon,
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold",
        TONE_STYLES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function Notice({
  children,
  tone = "info",
  title,
  className,
}: {
  children: ReactNode;
  tone?: "info" | "warn" | "error" | "success";
  title?: string;
  className?: string;
}) {
  const config = {
    info: { icon: Info, style: "border-sky/25 bg-sky-soft/65 text-foreground" },
    warn: { icon: TriangleAlert, style: "border-warn-border bg-warn-bg text-foreground" },
    error: { icon: CircleAlert, style: "border-danger/30 bg-danger-soft/45 text-foreground" },
    success: { icon: CheckCircle2, style: "border-moss/25 bg-moss-soft/55 text-foreground" },
  } as const;
  const { icon: Icon, style } = config[tone];
  const iconTone =
    tone === "error" ? "text-danger" : tone === "warn" ? "text-warn" : tone === "success" ? "text-moss" : "text-sky";

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cx("flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm", style, className)}
    >
      <Icon aria-hidden="true" className={cx("mt-0.5 size-4 shrink-0", iconTone)} />
      <div className="min-w-0 leading-relaxed">
        {title ? <p className="font-semibold text-foreground">{title}</p> : null}
        {children}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
  icon,
  className,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-2xl border border-dashed border-border-strong/70 bg-surface-2/35 p-6 text-center sm:p-8",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-8 -top-8 size-28 rounded-full bg-accent/10 blur-2xl"
      />
      <IconTile tone="accent" size="lg" className="mx-auto">
        {icon ?? <Inbox />}
      </IconTile>
      <p className="mt-3 text-sm font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-muted">{body}</p>
      {action ? <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Headers & metrics                                                         */
/* -------------------------------------------------------------------------- */

export function PageHeader({
  title,
  subtitle,
  action,
  eyebrow,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  eyebrow?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cx(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        "animate-fade-up",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="eyebrow mb-2.5">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-display text-[2rem] font-semibold leading-[1.05] tracking-[-0.035em] text-foreground sm:text-[2.6rem]">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </header>
  );
}

export function SectionHeading({
  id,
  title,
  hint,
  icon,
  count,
  action,
  className,
}: {
  id?: string;
  title: string;
  hint?: string;
  icon?: ReactNode;
  count?: number;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="flex min-w-0 items-center gap-3">
        {icon ? <IconTile tone="neutral" size="sm">{icon}</IconTile> : null}
        <div className="min-w-0">
          <h2 id={id} className="flex scroll-mt-24 items-center gap-2 text-[0.95rem] font-semibold text-foreground">
            {title}
            {typeof count === "number" ? (
              <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[0.68rem] font-semibold tabular-nums text-muted">
                {count}
              </span>
            ) : null}
          </h2>
          {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

const STAT_TONES = {
  accent: {
    tile: "accent" as const,
    wash: "from-accent/16",
    value: "text-foreground",
  },
  warn: {
    tile: "warm" as const,
    wash: "from-warn/16",
    value: "text-foreground",
  },
  sky: {
    tile: "sky" as const,
    wash: "from-sky/16",
    value: "text-foreground",
  },
  moss: {
    tile: "moss" as const,
    wash: "from-moss/16",
    value: "text-foreground",
  },
} as const;

export function StatCard({
  label,
  value,
  detail,
  icon,
  tone = "accent",
  href,
  index = 0,
  className,
}: {
  label: string;
  value: number;
  detail?: string;
  icon: ReactNode;
  tone?: keyof typeof STAT_TONES;
  href?: string;
  index?: number;
  className?: string;
}) {
  const styles = STAT_TONES[tone];

  const content = (
    <>
      <span
        aria-hidden="true"
        className={cx(
          "pointer-events-none absolute -right-10 -top-12 size-36 rounded-full bg-gradient-to-br to-transparent blur-2xl transition-transform duration-500 group-hover:scale-125",
          styles.wash,
        )}
      />
      <div className="relative flex items-start justify-between gap-3">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.13em] text-muted">{label}</p>
        <IconTile tone={styles.tile} size="sm">
          {icon}
        </IconTile>
      </div>
      <p className={cx("relative mt-3 font-display text-[2.4rem] font-semibold leading-none tracking-[-0.04em] tabular-nums", styles.value)}>
        <AnimatedNumber value={value} />
      </p>
      {detail ? <p className="relative mt-1.5 text-xs leading-relaxed text-muted">{detail}</p> : null}
    </>
  );

  const base = cx(
    "card card-hover group relative block overflow-hidden p-4 sm:p-5",
    "animate-pop",
    className,
  );
  const style = { animationDelay: `${index * 70}ms` };

  if (href) {
    return (
      <Link href={href} className={base} style={style}>
        {content}
      </Link>
    );
  }
  return (
    <div className={base} style={style}>
      {content}
    </div>
  );
}

export function ProgressBar({
  value,
  tone = "accent",
  label,
  className,
}: {
  value: number;
  tone?: "accent" | "warn" | "moss" | "danger" | "sky";
  label?: string;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const colors = {
    accent: "bg-accent",
    warn: "bg-warn",
    moss: "bg-moss",
    danger: "bg-danger",
    sky: "bg-sky",
  } as const;

  return (
    <div
      className={cx("h-1.5 overflow-hidden rounded-full bg-surface-3", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      aria-label={label}
    >
      <div
        className={cx("h-full origin-left rounded-full animate-[grow-x_900ms_cubic-bezier(.16,1,.3,1)_both]", colors[tone])}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Brand                                                                     */
/* -------------------------------------------------------------------------- */

export function Logo({
  href,
  className,
  markOnly = false,
  size = "md",
  tone = "default",
}: {
  href?: string;
  className?: string;
  markOnly?: boolean;
  size?: "sm" | "md" | "lg";
  tone?: "default" | "light";
}) {
  const markSize = { sm: "size-8 rounded-[0.65rem]", md: "size-9 rounded-[0.8rem]", lg: "size-11 rounded-[0.95rem]" }[size];
  const textSize = { sm: "text-[0.95rem]", md: "text-[1.08rem]", lg: "text-xl" }[size];
  const iconSize = { sm: "size-4", md: "size-[1.15rem]", lg: "size-5" }[size];

  const content = (
    <>
      <span
        aria-hidden="true"
        className={cx(
          "relative grid shrink-0 place-items-center overflow-hidden bg-[linear-gradient(140deg,var(--accent),var(--accent-2))] text-accent-fg shadow-[0_10px_24px_-12px_var(--ring)] ring-1 ring-white/25",
          markSize,
        )}
      >
        <span className="absolute inset-0 bg-[radial-gradient(circle_at_28%_18%,rgba(255,255,255,.45),transparent_42%)]" />
        <RotateCcw className={cx("relative", iconSize)} strokeWidth={2.35} />
      </span>
      {!markOnly ? (
        <span
          className={cx(
            "font-display font-semibold leading-none tracking-[-0.035em]",
            tone === "light" ? "text-[#f5eee3]" : "text-foreground",
            textSize,
          )}
        >
          Return
          <span className={tone === "light" ? "text-[#f5eee3]/55" : "text-muted"}>Tracker</span>
        </span>
      ) : null}
    </>
  );

  const classes = cx("inline-flex items-center gap-2.5", className);
  if (href) {
    return (
      <Link href={href} className={classes} aria-label="Return Tracker home">
        {content}
      </Link>
    );
  }
  return <span className={classes}>{content}</span>;
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  return (
    <span
      aria-hidden="true"
      className={cx(
        "grid size-9 shrink-0 place-items-center rounded-full border border-accent/20 bg-[linear-gradient(145deg,var(--accent-soft),var(--surface-2))] text-xs font-bold text-accent shadow-inner",
        className,
      )}
    >
      {initial}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Small helpers                                                             */
/* -------------------------------------------------------------------------- */

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle aria-hidden="true" className={cx("size-4 animate-spin", className)} />;
}

export function ArrowLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cx(
        "inline-flex items-center gap-1.5 text-sm font-semibold text-accent transition hover:gap-2.5",
        className,
      )}
    >
      {children}
      <ArrowRight aria-hidden="true" className="size-4" />
    </Link>
  );
}

/** Small icon set re-exported so screens can import icons from one place. */
export {
  Archive,
  ArrowRight,
  BadgeCheck,
  Bell,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  CircleHelp,
  Clock3,
  FileText,
  Hourglass,
  Inbox,
  Info,
  Package,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Truck,
  Wallet,
  X,
};
