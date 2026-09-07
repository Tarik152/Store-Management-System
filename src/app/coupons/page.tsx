"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Banknote, ChevronDown, Pencil, Receipt, ShoppingBag, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { CouponEditModal } from "@/components/CouponEditModal";
import { Badge, SectionTitle } from "@/components/ui";
import { cn, formatCents } from "@/lib/utils";
import type { ProductDTO, SaleDTO } from "@/lib/types";

export default function CouponsPage() {
  const [sales, setSales] = useState<SaleDTO[]>([]);
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [editSale, setEditSale] = useState<SaleDTO | null>(null);

  const load = useCallback(async () => {
    try {
      const [res, pRes] = await Promise.all([
        fetch("/api/sales", { cache: "no-store" }),
        fetch("/api/products", { cache: "no-store" }),
      ]);
      const data = await res.json();
      const pData = await pRes.json();
      setSales(data.sales ?? []);
      setProducts(pData.products ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    const revenue = sales.reduce((a, s) => a + s.totalCents, 0);
    const profit = sales.reduce((a, s) => a + (s.totalCents - s.totalCostCents), 0);
    return {
      count: sales.length,
      revenue,
      profit,
      avg: sales.length ? Math.round(revenue / sales.length) : 0,
    };
  }, [sales]);

  return (
    <div className="mx-auto max-w-[1280px]">
      <PageHeader
        title="Coupons"
        subtitle="Every closed register receipt, with items and margins."
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Coupons closed" rawValue={totals.count} icon={Receipt} tone="violet" index={0} hint="All-time completed sales" />
        <StatCard label="Total revenue" valueCents={totals.revenue} icon={Banknote} tone="mint" index={1} />
        <StatCard label="Total profit" valueCents={totals.profit} icon={TrendingUp} tone="sky" index={2} />
        <StatCard label="Average basket" valueCents={totals.avg} icon={ShoppingBag} tone="amber" index={3} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.15 }}
        className="panel mt-4 p-5"
      >
        <SectionTitle title="Closed coupons" hint="Most recent first" icon={<Receipt size={15} />} />

        <div className="space-y-2">
          {loading && <p className="py-10 text-center text-sm text-white/35">Loading…</p>}
          {!loading && sales.length === 0 && (
            <div className="rounded-xl border border-dashed border-line-strong px-4 py-12 text-center text-sm text-white/35">
              No coupons closed yet. Open the register and close your first sale.
            </div>
          )}
          {sales.map((s, i) => {
            const profit = s.totalCents - s.totalCostCents;
            const isOpen = expanded === s.id;
            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.4) }}
                className="overflow-hidden rounded-xl border border-line bg-white/[0.02]"
              >
                <button
                  onClick={() => setExpanded(isOpen ? null : s.id)}
                  className="flex w-full cursor-pointer items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-mint/25 bg-mint-soft font-[family-name:var(--font-mono)] text-[11px] font-bold text-mint">
                    #{s.couponNumber}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white/90">
                      {s.itemCount} item{s.itemCount === 1 ? "" : "s"}
                    </p>
                    <p className="text-xs text-white/35">
                      {new Date(s.closedAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <Badge tone={profit >= 0 ? "mint" : "rose"}>
                    {profit >= 0 ? "+" : ""}
                    {formatCents(profit)} profit
                  </Badge>
                  <span className="tnum w-24 text-right text-sm font-bold text-white/90">
                    {formatCents(s.totalCents)}
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditSale(s);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && setEditSale(s)}
                    title="Modify this coupon"
                    className="cursor-pointer rounded-lg border border-line p-1.5 text-white/40 transition-colors hover:border-amber-400/40 hover:bg-amber-400/10 hover:text-amber-glow"
                  >
                    <Pencil size={13} />
                  </span>
                  <ChevronDown
                    size={15}
                    className={cn("text-white/30 transition-transform", isOpen && "rotate-180")}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <div className="border-t border-line/60 bg-black/20 px-4 py-3">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-white/30">
                              <th className="pb-2 font-semibold">Item</th>
                              <th className="pb-2 text-right font-semibold">Qty</th>
                              <th className="pb-2 text-right font-semibold">Unit</th>
                              <th className="pb-2 text-right font-semibold">Cost</th>
                              <th className="pb-2 text-right font-semibold">Line total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(s.items ?? []).map((it) => (
                              <tr key={it.id} className="border-t border-line/40">
                                <td className="py-2 text-white/80">{it.productName}</td>
                                <td className="tnum py-2 text-right text-white/50">{it.quantity}</td>
                                <td className="tnum py-2 text-right text-white/50">
                                  {formatCents(it.unitSellCents)}
                                </td>
                                <td className="tnum py-2 text-right text-white/50">
                                  {formatCents(it.unitBuyCents)}
                                </td>
                                <td className="tnum py-2 text-right font-medium text-white/85">
                                  {formatCents(it.unitSellCents * it.quantity)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {s.amountReceivedCents != null && (
                          <div className="mt-2 flex justify-end gap-5 border-t border-line/40 pt-2 text-[11px] text-white/40">
                            <span>
                              Paid:{" "}
                              <span className="tnum font-semibold text-white/75">
                                {formatCents(s.amountReceivedCents)}
                              </span>
                            </span>
                            <span>
                              Change returned:{" "}
                              <span className="tnum font-semibold text-mint">
                                {formatCents(s.changeCents ?? 0)}
                              </span>
                            </span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      <CouponEditModal
        open={!!editSale}
        sale={editSale}
        products={products}
        onClose={() => setEditSale(null)}
        onSaved={load}
      />
    </div>
  );
}
