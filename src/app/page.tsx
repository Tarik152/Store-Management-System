"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Banknote,
  Boxes,
  Clock3,
  Package,
  Receipt,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { RevenueChart } from "@/components/RevenueChart";
import { InsightsPanel } from "@/components/InsightsPanel";
import { Badge, Button, SectionTitle } from "@/components/ui";
import { cn, formatCents } from "@/lib/utils";
import type { StatsDTO } from "@/lib/types";

export default function OverviewPage() {
  const [stats, setStats] = useState<StatsDTO | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/stats", { cache: "no-store" });
      const data = await res.json();
      setStats(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const c = stats?.currency ?? "$";
  const t = stats?.totals;

  return (
    <div className="mx-auto max-w-[1280px]">
      <PageHeader
        title="Overview"
        subtitle="Your store at a glance — sales, stock and AI signals."
      >
        <Link href="/pos">
          <Button>
            Open register <ArrowRight size={15} />
          </Button>
        </Link>
      </PageHeader>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Revenue (sold for)"
          valueCents={t?.soldRevenueCents ?? 0}
          icon={Banknote}
          tone="mint"
          index={0}
          currency={c}
          hint={`${t?.productsSold ?? 0} items sold`}
        />
        <StatCard
          label="Profit"
          valueCents={t?.profitCents ?? 0}
          icon={TrendingUp}
          tone="sky"
          index={1}
          currency={c}
          hint={`${t?.marginPct ?? 0}% blended margin`}
        />
        <StatCard
          label="Coupons closed"
          rawValue={t?.couponsClosed ?? 0}
          icon={Receipt}
          tone="violet"
          index={2}
          hint="Completed register receipts"
        />
        <StatCard
          label="Stock value (cost)"
          valueCents={t?.stockCostCents ?? 0}
          icon={Wallet}
          tone="amber"
          index={3}
          currency={c}
          hint={`${t?.stockUnits ?? 0} units on shelf`}
        />
      </div>

      {/* Chart + AI */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.7fr_1fr]">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="panel p-5"
        >
          <SectionTitle
            title="Sales momentum"
            hint="Revenue vs profit — last 14 days"
            icon={<TrendingUp size={15} />}
          />
          {stats && stats.series.some((d) => d.revenue > 0) ? (
            <RevenueChart data={stats.series} currency={c} />
          ) : (
            <div className="grid h-[280px] place-items-center rounded-xl border border-dashed border-line-strong text-sm text-white/35">
              {loading
                ? "Loading…"
                : "No sales recorded yet — close your first coupon at the register."}
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22, duration: 0.5 }}
        >
          <InsightsPanel compact />
        </motion.div>
      </div>

      {/* Expiry radar + top products */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.5 }}
          className="panel p-5"
        >
          <SectionTitle
            title="Expiry radar"
            hint="Products inside your AI alert window"
            icon={<Clock3 size={15} />}
          />
          {!stats?.expiring.length ? (
            <div className="rounded-xl border border-dashed border-line-strong px-4 py-8 text-center text-sm text-white/35">
              Nothing approaching its due date.
            </div>
          ) : (
            <div className="space-y-2">
              {stats.expiring.slice(0, 5).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-xl border border-line bg-white/[0.02] px-3.5 py-2.5"
                >
                  <div>
                    <p className="text-sm font-medium text-white/90">{p.name}</p>
                    <p className="text-[11px] text-white/35">
                      {p.quantity} units · {formatCents(p.valueCents, c)} at cost
                    </p>
                  </div>
                  <Badge tone={p.status === "expired" ? "rose" : p.daysLeft <= 2 ? "amber" : "sky"}>
                    {p.status === "expired"
                      ? "Expired"
                      : p.daysLeft === 0
                        ? "Due today"
                        : `${p.daysLeft}d left`}
                  </Badge>
                </div>
              ))}
            </div>
          )}
          {stats && stats.expiring.length > 0 && (
            <Link href="/inventory">
              <button className="mt-3 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-line py-2 text-xs font-semibold text-white/60 transition-colors hover:bg-white/[0.04] hover:text-white">
                Manage in inventory <ArrowRight size={13} />
              </button>
            </Link>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.34, duration: 0.5 }}
          className="panel p-5"
        >
          <SectionTitle
            title="Top performers"
            hint="Highest lifetime profit"
            icon={<Package size={15} />}
          />
          {!stats?.topProducts.length ? (
            <div className="rounded-xl border border-dashed border-line-strong px-4 py-8 text-center text-sm text-white/35">
              Sell something and your champions will appear here.
            </div>
          ) : (
            <div className="space-y-2">
              {stats.topProducts.map((p, i) => {
                const max = stats.topProducts[0].profit || 1;
                return (
                  <div key={p.name} className="relative overflow-hidden rounded-xl border border-line bg-white/[0.02] px-3.5 py-2.5">
                    <div
                      className="absolute inset-y-0 left-0 bg-mint/[0.06]"
                      style={{ width: `${Math.max((p.profit / max) * 100, 4)}%` }}
                    />
                    <div className="relative flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="grid size-6 place-items-center rounded-md bg-white/[0.06] font-display text-[11px] font-bold text-white/50">
                          {i + 1}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-white/90">{p.name}</p>
                          <p className="text-[11px] text-white/35">{p.units} sold</p>
                        </div>
                      </div>
                      <p className={cn("tnum text-sm font-semibold", p.profit >= 0 ? "text-mint" : "text-danger")}>
                        {formatCents(p.profit, c)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* Stock pulse strip */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="panel mt-4 flex flex-wrap items-center justify-between gap-4 px-5 py-4"
      >
        <div className="flex items-center gap-2.5">
          <Boxes size={16} className="text-mint" />
          <p className="text-sm text-white/60">
            <span className="font-semibold text-white">{t?.productCount ?? 0}</span> articles ·
            potential retail value{" "}
            <span className="tnum font-semibold text-mint">
              {formatCents(t?.stockRetailCents ?? 0, c)}
            </span>{" "}
            · losses so far{" "}
            <span className="tnum font-semibold text-danger">
              {formatCents(t?.lossValueCents ?? 0, c)}
            </span>
          </p>
        </div>
        <Link href="/reports" className="text-xs font-semibold text-white/50 transition-colors hover:text-mint">
          Full report →
        </Link>
      </motion.div>
    </div>
  );
}
