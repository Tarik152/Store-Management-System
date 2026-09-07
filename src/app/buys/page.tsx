"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Coins,
  PackagePlus,
  ShoppingBasket,
  Sparkles,
  Trash2,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { BuyLineForm } from "@/components/BuyLineForm";
import { Badge, Button, FieldLabel, SectionTitle } from "@/components/ui";
import { cn, formatCents } from "@/lib/utils";
import type { DraftBuyLine, ProductDTO, PurchaseDTO } from "@/lib/types";

function todayLocalISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export default function BuysPage() {
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [purchases, setPurchases] = useState<PurchaseDTO[]>([]);
  const [currency, setCurrency] = useState("$");
  const [draft, setDraft] = useState<DraftBuyLine[]>([]);
  const [supplier, setSupplier] = useState("");
  const [note, setNote] = useState("");
  const [buyDate, setBuyDate] = useState(todayLocalISO());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [lastSaved, setLastSaved] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [pRes, buysRes, sRes] = await Promise.all([
        fetch("/api/products", { cache: "no-store" }),
        fetch("/api/purchases", { cache: "no-store" }),
        fetch("/api/settings", { cache: "no-store" }),
      ]);
      const pData = await pRes.json();
      const buysData = await buysRes.json();
      const sData = await sRes.json();
      setProducts(pData.products ?? []);
      setPurchases(buysData.purchases ?? []);
      if (sData.settings?.currency) setCurrency(sData.settings.currency);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const draftTotal = draft.reduce((a, l) => a + l.buyPriceCents * l.quantity, 0);
  const draftUnits = draft.reduce((a, l) => a + l.quantity, 0);

  const addLine = (line: DraftBuyLine) => {
    setDraft((prev) => {
      if (prev.some((l) => l.barcode === line.barcode)) {
        toast.error("That barcode is already on this coupon — remove it first");
        return prev;
      }
      return [...prev, line];
    });
    toast.success(`${line.name} added to the coupon`);
  };

  const save = async () => {
    if (draft.length === 0) return toast.error("Add at least one line first");
    setSaving(true);
    try {
      const res = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier,
          note,
          purchasedAt: new Date(`${buyDate}T12:00:00`).toISOString(),
          lines: draft.map((l) => ({
            productId: l.productId,
            name: l.name,
            barcode: l.barcode,
            quantity: l.quantity,
            buyPriceCents: l.buyPriceCents,
            sellPriceCents: l.sellPriceCents,
            expiryDate: l.expiryDate,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save the purchase");

      const created = data.purchase.itemCount ?? draftUnits;
      setLastSaved(data.purchase.purchaseNumber);
      toast.success(`Purchase #${data.purchase.purchaseNumber} recorded`, {
        description: `${created} units entered stock · ${formatCents(draftTotal, currency)} spent`,
      });
      setDraft([]);
      setSupplier("");
      setNote("");
      await load();
      setTimeout(() => setLastSaved(null), 6000);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const cancelPurchase = async (p: PurchaseDTO) => {
    if (
      !confirm(
        `Cancel purchase #${p.purchaseNumber}? The ${p.itemCount} received unit(s) will be pulled back out of stock.`
      )
    )
      return;
    const res = await fetch(`/api/purchases/${p.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error ?? "Failed to cancel");
    toast.success(`Purchase #${p.purchaseNumber} cancelled`);
    load();
  };

  // ---- group history by calendar day -------------------------------------
  const grouped = useMemo(() => {
    const map = new Map<string, PurchaseDTO[]>();
    for (const p of purchases) {
      const key = new Date(p.purchasedAt).toLocaleDateString("en-CA");
      const arr = map.get(key) ?? [];
      arr.push(p);
      map.set(key, arr);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [purchases]);

  const totals = useMemo(() => {
    const todayKey = new Date().toLocaleDateString("en-CA");
    const today = purchases.filter(
      (p) => new Date(p.purchasedAt).toLocaleDateString("en-CA") === todayKey
    );
    return {
      spend: purchases.reduce((a, p) => a + p.totalCostCents, 0),
      units: purchases.reduce((a, p) => a + p.itemCount, 0),
      coupons: purchases.length,
      todaySpend: today.reduce((a, p) => a + p.totalCostCents, 0),
    };
  }, [purchases]);

  return (
    <div className="mx-auto max-w-[1280px]">
      <PageHeader
        title="Buys"
        subtitle="Everything you purchase enters the store here — new articles and restocks."
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Total spent" valueCents={totals.spend} icon={Coins} tone="amber" index={0} currency={currency} hint="All purchase coupons" />
        <StatCard label="Spent today" valueCents={totals.todaySpend} icon={CalendarDays} tone="sky" index={1} currency={currency} />
        <StatCard label="Units received" rawValue={totals.units} icon={PackagePlus} tone="mint" index={2} />
        <StatCard label="Purchase coupons" rawValue={totals.coupons} icon={ShoppingBasket} tone="violet" index={3} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
        {/* ------------------------------------------------ entry form */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
          className="panel h-fit p-5"
        >
          <SectionTitle
            title="Enter a purchase"
            hint="Add each article you bought, then save the coupon"
            icon={<PackagePlus size={15} />}
          />
          <BuyLineForm products={products} currency={currency} onAdd={addLine} />
        </motion.div>

        {/* ------------------------------------------------ draft coupon */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.16 }}
          className="panel flex h-fit flex-col p-5"
        >
          <SectionTitle
            title="Purchase coupon"
            hint={draft.length ? `${draftUnits} units on this coupon` : "No lines yet"}
            icon={<ShoppingBasket size={15} />}
          />

          <div className="mb-3 grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Supplier</FieldLabel>
              <div className="relative">
                <Truck size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  className="field pl-9"
                  placeholder="e.g. Metro Wholesale"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                />
              </div>
            </div>
            <div>
              <FieldLabel>Purchase date</FieldLabel>
              <input
                className="field"
                type="date"
                value={buyDate}
                onChange={(e) => setBuyDate(e.target.value)}
              />
            </div>
          </div>

          <div className="min-h-[150px] flex-1 space-y-2">
            <AnimatePresence initial={false}>
              {draft.map((l) => (
                <motion.div
                  key={l.key}
                  layout
                  initial={{ opacity: 0, x: 14 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -14 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-2.5 rounded-xl border border-line bg-white/[0.02] px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-[13px] font-medium text-white/90">
                      {l.name}
                      {l.isNew && <Badge tone="mint">new</Badge>}
                    </p>
                    <p className="tnum text-[11px] text-white/35">
                      {l.quantity} × {formatCents(l.buyPriceCents, currency)} · sells at{" "}
                      {formatCents(l.sellPriceCents, currency)}
                      {l.expiryDate ? ` · due ${l.expiryDate}` : ""}
                    </p>
                  </div>
                  <p className="tnum text-sm font-semibold text-amber-glow">
                    {formatCents(l.buyPriceCents * l.quantity, currency)}
                  </p>
                  <button
                    onClick={() => setDraft((prev) => prev.filter((x) => x.key !== l.key))}
                    className="cursor-pointer rounded-md p-1.5 text-white/30 hover:bg-danger/15 hover:text-danger"
                  >
                    <Trash2 size={13} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>

            {draft.length === 0 && (
              <div className="grid h-[150px] place-items-center rounded-xl border border-dashed border-line-strong px-4 text-center text-sm text-white/30">
                Fill the form on the left and add your first line
              </div>
            )}
          </div>

          <div className="mt-3">
            <FieldLabel>Note (optional)</FieldLabel>
            <input
              className="field"
              placeholder="e.g. Invoice 4471, paid by transfer"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="mt-4 border-t border-line pt-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-white/50">Total cost</span>
              <span className="tnum font-display text-[26px] font-bold tracking-tight text-amber-glow">
                {formatCents(draftTotal, currency)}
              </span>
            </div>
            <Button onClick={save} disabled={draft.length === 0 || saving} className="w-full py-3">
              <PackagePlus size={16} />
              {saving ? "Saving…" : "Save purchase & add to stock"}
            </Button>
          </div>

          <AnimatePresence>
            {lastSaved && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="mt-3 flex items-center gap-2.5 rounded-xl border border-mint/30 bg-mint-soft px-4 py-3"
              >
                <CheckCircle2 size={16} className="text-mint" />
                <p className="text-sm font-semibold text-mint">
                  Purchase #{lastSaved} saved — stock updated
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* ------------------------------------------------ daily history */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.22 }}
        className="panel mt-4 p-5"
      >
        <SectionTitle
          title="Purchase history"
          hint="Grouped by day, newest first"
          icon={<CalendarDays size={15} />}
        />

        {loading && <p className="py-10 text-center text-sm text-white/35">Loading…</p>}
        {!loading && grouped.length === 0 && (
          <div className="rounded-xl border border-dashed border-line-strong px-4 py-12 text-center text-sm text-white/35">
            No purchases recorded yet — enter your first one above.
          </div>
        )}

        <div className="space-y-5">
          {grouped.map(([day, list]) => {
            const daySpend = list.reduce((a, p) => a + p.totalCostCents, 0);
            const dayUnits = list.reduce((a, p) => a + p.itemCount, 0);
            const isToday = day === new Date().toLocaleDateString("en-CA");
            return (
              <div key={day}>
                <div className="mb-2 flex items-center gap-3">
                  <span
                    className={cn(
                      "text-[12px] font-semibold",
                      isToday ? "text-mint" : "text-white/60"
                    )}
                  >
                    {isToday
                      ? "Today"
                      : new Date(`${day}T12:00:00`).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                  </span>
                  <span className="h-px flex-1 bg-line" />
                  <span className="tnum text-[11px] text-white/35">
                    {list.length} coupon{list.length > 1 ? "s" : ""} · {dayUnits} units ·{" "}
                    <span className="font-semibold text-amber-glow">
                      {formatCents(daySpend, currency)}
                    </span>
                  </span>
                </div>

                <div className="space-y-2">
                  {list.map((p) => {
                    const isOpen = expanded === p.id;
                    return (
                      <div
                        key={p.id}
                        className="overflow-hidden rounded-xl border border-line bg-white/[0.02]"
                      >
                        <button
                          onClick={() => setExpanded(isOpen ? null : p.id)}
                          className="flex w-full cursor-pointer items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
                        >
                          <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-amber-400/25 bg-amber-400/10 font-[family-name:var(--font-mono)] text-[10.5px] font-bold text-amber-glow">
                            #{p.purchaseNumber}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-white/90">
                              {p.supplier || "Unnamed supplier"}
                            </p>
                            <p className="text-xs text-white/35">
                              {p.items.length} article{p.items.length > 1 ? "s" : ""} ·{" "}
                              {p.itemCount} units
                              {p.note ? ` · ${p.note}` : ""}
                            </p>
                          </div>
                          {p.items.some((i) => i.isNewProduct) && (
                            <Badge tone="mint">
                              {p.items.filter((i) => i.isNewProduct).length} new
                            </Badge>
                          )}
                          <span className="tnum w-24 text-right text-sm font-bold text-amber-glow">
                            {formatCents(p.totalCostCents, currency)}
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
                                      <th className="pb-2 font-semibold">Article</th>
                                      <th className="pb-2 text-right font-semibold">Qty</th>
                                      <th className="pb-2 text-right font-semibold">Unit cost</th>
                                      <th className="pb-2 text-right font-semibold">Sell price</th>
                                      <th className="pb-2 text-right font-semibold">Line cost</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {p.items.map((it) => (
                                      <tr key={it.id} className="border-t border-line/40">
                                        <td className="py-2">
                                          <span className="text-white/80">{it.productName}</span>
                                          {it.isNewProduct && (
                                            <span className="ml-1.5 text-[10px] text-mint">new</span>
                                          )}
                                          <span className="ml-1.5 font-[family-name:var(--font-mono)] text-[10px] text-white/25">
                                            {it.barcode}
                                          </span>
                                        </td>
                                        <td className="tnum py-2 text-right text-white/50">
                                          {it.quantity}
                                        </td>
                                        <td className="tnum py-2 text-right text-white/50">
                                          {formatCents(it.unitCostCents, currency)}
                                        </td>
                                        <td className="tnum py-2 text-right text-white/50">
                                          {formatCents(it.unitSellCents, currency)}
                                        </td>
                                        <td className="tnum py-2 text-right font-medium text-amber-glow">
                                          {formatCents(it.unitCostCents * it.quantity, currency)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                <div className="mt-2 flex justify-end border-t border-line/40 pt-2">
                                  <button
                                    onClick={() => cancelPurchase(p)}
                                    className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-danger/25 px-2.5 py-1.5 text-[11px] font-semibold text-danger transition-colors hover:bg-danger/15"
                                  >
                                    <Trash2 size={12} /> Cancel purchase & remove from stock
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
