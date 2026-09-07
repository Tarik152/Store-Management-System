"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function SectionTitle({
  title,
  hint,
  icon,
}: {
  title: string;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      {icon && (
        <span className="grid size-8 place-items-center rounded-lg border border-line bg-white/[0.03] text-mint">
          {icon}
        </span>
      )}
      <div>
        <h2 className="font-display text-[15px] font-semibold tracking-tight text-white">
          {title}
        </h2>
        {hint && <p className="text-xs text-white/40">{hint}</p>}
      </div>
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "mint" | "amber" | "rose" | "sky";
  className?: string;
}) {
  const tones = {
    neutral: "bg-white/[0.06] text-white/65 border-white/[0.08]",
    mint: "bg-mint-soft text-mint border-mint/25",
    amber: "bg-amber-400/10 text-amber-glow border-amber-400/25",
    rose: "bg-danger/10 text-danger border-danger/25",
    sky: "bg-sky-400/10 text-sky-300 border-sky-400/25",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">
      {children}
    </label>
  );
}

export function Button({
  children,
  variant = "primary",
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "outline";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 disabled:opacity-40 disabled:pointer-events-none cursor-pointer";
  const variants = {
    primary:
      "bg-mint text-[#0b0c07] hover:bg-lime-300 hover:shadow-[0_8px_30px_-6px_rgba(163,230,53,0.55)] active:scale-[0.98]",
    ghost: "text-white/70 hover:text-white hover:bg-white/[0.06]",
    danger: "bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25",
    outline:
      "border border-line-strong text-white/85 hover:bg-white/[0.05] hover:border-white/25",
  } as const;
  return (
    <button className={cn(base, variants[variant], className)} {...rest}>
      {children}
    </button>
  );
}
