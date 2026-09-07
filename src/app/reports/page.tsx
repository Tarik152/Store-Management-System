"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Banknote,
  CircleDollarSign,
  Coins,
  Package,
  PiggyBank,
  Receipt,
  Skull,
  TrendingDown,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { RevenueChart } from "@/components/RevenueChart";
import { SectionTitle } from "@/components/ui";
import { cn, formatCents } from "@/lib/utils";
import type { StatsDTO } from "@/lib/types";

export default function ReportsPage() {
  const [stats, setStats] = useState<StatsDTO | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/stats", { cache: "no-store" });
      setStats(await res.json());
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
        title="Reports"
        subtitle="What you sold, what it cost you, what you earned."
      />

      {/* The core P&L strip the owner asked for */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Products sold"
          rawValue={t?.productsSold ?? 0}
          icon={Package}
          tone="violet"
          index={0}
          hint={`across ${t?.couponsClosed ?? 0} coupons`}
        />
        <StatCard
          label="What they cost you"
          valueCents={t?.soldCostCents ?? 0}
          icon={Coins}
          tone="amber"
          index={1}
          currency={c}
          hint="Purchase value of goods sold"
        />
        <StatCard
          label="What you sold them for"
          valueCents={t?.soldRevenueCents ?? 0}
          icon={Banknote}
          tone="mint"
          index={2}
          currency={c}
          hint="Total revenue at the register"
        />
        <StatCard
          label="Profit"
          valueCents={t?.profitCents ?? 0}
          icon={(t?.profitCents ?? 0) >= 0 ? TrendingUp : TrendingDown}
          tone={(t?.profitCents ?? 0) >= 0 ? "sky" : "rose"}
          index={3}
          currency={c}
          hint={`${t?.marginPct ?? 0}% margin on revenue`}
        />
      </div>

      {/* Profit visual */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.12 }}
        className="panel mt-4 p-5"
      >
        <SectionTitle
          title="Revenue & profit curve"
          hint="Daily, last 14 days"
          icon={<TrendingUp size={15} />}
        />
        {stats && stats.series.some((d) => d.revenue > 0 || d.profit !== 0) ? (
          <RevenueChart data={stats.series} currency={c} />
        ) : (
          <div className="grid h-[280px] place-items-center rounded-xl border border-dashed border-line-strong text-sm text-white/35">
            {loading ? "Loading…" : "Close coupons to build your curve."}
          </div>
        )}
      </motion.div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Top products */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.18 }}
          className="panel p-5"
        >
          <SectionTitle title="Profit champions" hint="Ranked by lifetime gross profit" icon={<Trophy size={15} />} />
          {!stats?.topProducts.length ? (
            <div className="rounded-xl border border-dashed border-line-strong px-4 py-10 text-center text-sm text-white/35">
              No sales data yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-[0.12em] text-white/35">
                  <th className="pb-2.5 font-semibold">Product</th>
                  <th className="pb-2.5 text-right font-semibold">Units</th>
                  <th className="pb-2.5 text-right font-semibold">Revenue</th>
                  <th className="pb-2.5 text-right font-semibold">Profit</th>
                </tr>
              </thead>
              <tbody>
                {stats.topProducts.map((p, i) => (
                  <tr key={p.name} className="border-b border-line/50 last:border-0">
                    <td className="py-2.5">
                      <span className="mr-2 inline-grid size-5 place-items-center rounded-md bg-white/[0.06] text-[10px] font-bold text-white/50">
                        {i + 1}
                      </span>
                      <span className="font-medium text-white/90">{p.name}</span>
                    </td>
                    <td className="tnum py-2.5 text-right text-white/50">{p.units}</td>
                    <td className="tnum py-2.5 text-right text-white/70">
                      {formatCents(p.revenue, c)}
                    </td>
                    <td className={cn("tnum py-2.5 text-right font-semibold", p.profit >= 0 ? "text-mint" : "text-danger")}>
                      {formatCents(p.profit, c)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </motion.div>

        {/* Loss impact + inventory standing */}
        <div className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.24 }}
            className="panel p-5"
          >
            <SectionTitle title="Loss impact" hint="Write-offs eat directly into profit" icon={<Skull size={15} />} />
            <div className="flex items-end justify-between">
              <div>
                <p className="tnum font-display text-[28px] font-bold tracking-tight text-danger">
                  -{formatCents(t?.lossValueCents ?? 0, c)}
                </p>
                <p className="mt-1 text-xs text-white/40">
                  {t?.lossUnits ?? 0} units across {t?.lossEvents ?? 0} events
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-[0.12em] text-white/35">
                  Net after losses
                </p>
                <p
                  className={cn(
                    "tnum font-display text-[20px] font-bold",
                    (t?.profitCents ?? 0) - (t?.lossValueCents ?? 0) >= 0
                      ? "text-mint"
                      : "text-danger"
                  )}
                >
                  {formatCents((t?.profitCents ?? 0) - (t?.lossValueCents ?? 0), c)}
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.3 }}
            className="panel p-5"
          >
            <SectionTitle
              title="Purchases & inventory"
              hint="Capital spent and parked on your shelves"
              icon={<PiggyBank size={15} />}
            />
            <div className="mb-3 flex items-center justify-between rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-3.5 py-2.5">
              <span className="text-xs text-white/50">
                Spent on {t?.purchaseCount ?? 0} purchase coupon
                {(t?.purchaseCount ?? 0) === 1 ? "" : "s"} ({t?.purchaseUnits ?? 0} units)
              </span>
              <span className="tnum font-display text-lg font-bold text-amber-glow">
                {formatCents(t?.purchaseSpendCents ?? 0, c)}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-line bg-white/[0.02] p-3.5">
                <p className="text-[10px] uppercase tracking-[0.12em] text-white/35">Units</p>
                <p className="tnum mt-1 font-display text-lg font-bold">{t?.stockUnits ?? 0}</p>
              </div>
              <div className="rounded-xl border border-line bg-white/[0.02] p-3.5">
                <p className="text-[10px] uppercase tracking-[0.12em] text-white/35">At cost</p>
                <p className="tnum mt-1 font-display text-lg font-bold text-amber-glow">
                  {formatCents(t?.stockCostCents ?? 0, c)}
                </p>
              </div>
              <div className="rounded-xl border border-line bg-white/[0.02] p-3.5">
                <p className="text-[10px] uppercase tracking-[0.12em] text-white/35">At retail</p>
                <p className="tnum mt-1 font-display text-lg font-bold text-mint">
                  {formatCents(t?.stockRetailCents ?? 0, c)}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-white/40">
              Selling everything on hand at list price would add{" "}
              <span className="tnum font-semibold text-mint">
                {formatCents((t?.stockRetailCents ?? 0) - (t?.stockCostCents ?? 0), c)}
              </span>{" "}
              more gross profit.
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
