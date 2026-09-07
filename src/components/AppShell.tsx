"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard,
  Package,
  PackagePlus,
  ScanBarcode,
  Receipt,
  TrendingUp,
  PackageX,
  Settings,
  Bell,
  Sparkles,
  Store,
  X,
  AlertTriangle,
  Info,
  CheckCircle2,
  Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { InsightDTO } from "@/lib/types";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/buys", label: "Buys", icon: PackagePlus },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/pos", label: "Point of Sale", icon: ScanBarcode },
  { href: "/coupons", label: "Coupons", icon: Receipt },
  { href: "/reports", label: "Reports", icon: TrendingUp },
  { href: "/losses", label: "Losses", icon: PackageX },
  { href: "/settings", label: "Settings", icon: Settings },
];

const severityStyle: Record<InsightDTO["severity"], { icon: any; cls: string }> = {
  critical: { icon: Flame, cls: "text-danger" },
  warning: { icon: AlertTriangle, cls: "text-amber-glow" },
  info: { icon: Info, cls: "text-sky-300" },
  success: { icon: CheckCircle2, cls: "text-mint" },
};

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [insights, setInsights] = useState<InsightDTO[]>([]);
  const [summary, setSummary] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/insights", { cache: "no-store" });
      const data = await res.json();
      setInsights(data.insights ?? []);
      setSummary(data.summary ?? "");
    } catch {
      /* silent */
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const urgent = insights.filter(
    (i) => i.severity === "critical" || i.severity === "warning"
  ).length;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative grid size-10 cursor-pointer place-items-center rounded-xl border transition-colors",
          open
            ? "border-mint/40 bg-mint-soft text-mint"
            : "border-line bg-white/[0.03] text-white/70 hover:bg-white/[0.06] hover:text-white"
        )}
        aria-label="AI notifications"
      >
        <Bell size={17} />
        {urgent > 0 && (
          <span className="absolute -right-1 -top-1 grid min-w-[18px] place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white shadow-[0_0_12px_rgba(251,113,133,0.6)]">
            {urgent}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-12 z-50 w-[380px] overflow-hidden rounded-2xl border border-line-strong bg-panel/95 shadow-2xl shadow-black/60 backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-mint" />
                <span className="font-display text-sm font-semibold">AI Watchtower</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="cursor-pointer rounded-md p-1 text-white/40 hover:bg-white/[0.06] hover:text-white"
              >
                <X size={15} />
              </button>
            </div>
            {summary && (
              <p className="border-b border-line bg-white/[0.02] px-4 py-2.5 text-xs leading-relaxed text-white/55">
                {summary}
              </p>
            )}
            <div className="max-h-[420px] overflow-y-auto">
              {insights.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-white/40">
                  Scanning your store… no signals yet.
                </p>
              )}
              {insights.map((ins) => {
                const S = severityStyle[ins.severity];
                const Icon = S.icon;
                return (
                  <div
                    key={ins.id}
                    className="border-b border-line/60 px-4 py-3 last:border-0 hover:bg-white/[0.025]"
                  >
                    <div className="flex items-start gap-2.5">
                      <Icon size={15} className={cn("mt-0.5 shrink-0", S.cls)} />
                      <div>
                        <p className="text-[13px] font-semibold text-white/90">{ins.title}</p>
                        <p className="mt-1 text-xs leading-relaxed text-white/50">
                          {ins.message}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="relative z-10 flex min-h-screen">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 flex w-[240px] flex-col border-r border-line bg-void/80 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-5 pb-6 pt-6">
          <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-mint to-lime-600 text-[#0b0c07] shadow-[0_8px_24px_-6px_rgba(163,230,53,0.5)]">
            <Store size={19} strokeWidth={2.4} />
          </div>
          <div>
            <p className="font-display text-[17px] font-bold leading-none tracking-tight">
              StorePulse
            </p>
            <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-mint/80">
              AI Management
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-colors",
                  active ? "text-white" : "text-white/45 hover:bg-white/[0.04] hover:text-white/80"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-xl border border-mint/25 bg-mint-soft"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                  />
                )}
                <Icon
                  size={17}
                  className={cn("relative z-10", active && "text-mint")}
                  strokeWidth={active ? 2.3 : 2}
                />
                <span className="relative z-10">{item.label}</span>
                {active && (
                  <span className="relative z-10 ml-auto size-1.5 rounded-full bg-mint" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mx-3 mb-5 rounded-2xl border border-line bg-gradient-to-br from-white/[0.04] to-transparent p-4">
          <div className="flex items-center gap-2">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-mint opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-mint" />
            </span>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
              AI watchtower
            </p>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-white/40">
            Monitoring expiry dates & stock health around the clock.
          </p>
        </div>
      </aside>

      {/* Main */}
      <div className="ml-[240px] flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-end gap-3 border-b border-line bg-void/70 px-8 py-3.5 backdrop-blur-xl">
          <NotificationBell />
        </header>
        <main className="flex-1 px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
