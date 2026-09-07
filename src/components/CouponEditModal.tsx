"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Banknote, Minus, Pencil, Plus, Trash2, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import { Button, FieldLabel } from "@/components/ui";
import { ProductPicker } from "@/components/ProductPicker";
import { cn, formatCents, parseMoneyToCents } from "@/lib/utils";
import type { ProductDTO, SaleDTO } from "@/lib/types";

type EditLine = {
  productId: number | null;
  productName: string;
  quantity: number;
  unitSellCents: number;
  unitBuyCents: number;
  /** original quantity on the coupon, used to show stock deltas */
  originalQuantity: number;
};

export function CouponEditModal({
  open,
  sale,
  products,
  currency = "$",
  onClose,
  onSaved,
}: {
  open: boolean;
  sale: SaleDTO | null;
  products: ProductDTO[];
  currency?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [lines, setLines] = useState<EditLine[]>([]);
  const [received, setReceived] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && sale) {
      setLines(
        (sale.items ?? []).map((i) => ({
          productId: i.productId,
          productName: i.productName,
          quantity: i.quantity,
          unitSellCents: i.unitSellCents,
          unitBuyCents: i.unitBuyCents,
          originalQuantity: i.quantity,
        }))
      );
      setReceived(
        sale.amountReceivedCents != null
          ? (sale.amountReceivedCents / 100).toFixed(2)
          : ""
      );
    }
  }, [open, sale]);

  const productMap = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products]
  );

  const totalCents = lines.reduce((a, l) => a + l.quantity * l.unitSellCents, 0);
  const receivedCents = received.trim() === "" ? null : parseMoneyToCents(received);
  const changeCents = receivedCents === null ? null : receivedCents - totalCents;
  const shortPaid = receivedCents !== null && receivedCents < totalCents;

  const setQty = (productId: number | null, index: number, delta: number) => {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== index) return l;
        const next = l.quantity + delta;
        if (next < 0) return l;
        if (delta > 0 && l.productId !== null) {
          const stock = productMap.get(l.productId)?.quantity ?? 0;
          const extraNeeded = next - l.originalQuantity;
          if (extraNeeded > stock) {
            toast.error(`Only ${stock} more in stock for "${l.productName}"`);
            return l;
          }
        }
        return { ...l, quantity: next };
      })
    );
  };

  const addProduct = (p: ProductDTO) => {
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.productId === p.id);
      if (idx >= 0) {
        const l = prev[idx];
        if (l.quantity + 1 - l.originalQuantity > p.quantity) {
          toast.error(`Only ${p.quantity} more in stock`);
          return prev;
        }
        return prev.map((x, i) => (i === idx ? { ...x, quantity: x.quantity + 1 } : x));
      }
      if (p.quantity < 1) {
        toast.error(`"${p.name}" is out of stock`);
        return prev;
      }
      return [
        ...prev,
        {
          productId: p.id,
          productName: p.name,
          quantity: 1,
          unitSellCents: p.sellPriceCents,
          unitBuyCents: p.buyPriceCents,
          originalQuantity: 0,
        },
      ];
    });
  };

  const save = async () => {
    if (!sale) return;
    const kept = lines.filter((l) => l.quantity > 0);
    if (kept.length === 0)
      return toast.error("Keep at least one item, or void the coupon instead");
    if (shortPaid)
      return toast.error("The cash received is below the new total");

    setSaving(true);
    try {
      const res = await fetch(`/api/sales/${sale.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: kept
            .filter((l) => l.productId !== null)
            .map((l) => ({ productId: l.productId, quantity: l.quantity })),
          amountReceivedCents: receivedCents,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to modify coupon");
      toast.success(`Coupon #${sale.couponNumber} updated`, {
        description: "Stock and totals were rebalanced automatically.",
      });
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const voidCoupon = async () => {
    if (!sale) return;
    if (
      !confirm(
        `Void coupon #${sale.couponNumber}? All ${sale.itemCount} unit(s) go back into stock.`
      )
    )
      return;
    setSaving(true);
    try {
      const res = await fetch(`/api/sales/${sale.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to void coupon");
      toast.success(`Coupon #${sale.couponNumber} voided`, {
        description: "Every unit was returned to inventory.",
      });
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && sale && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[85] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: "spring", bounce: 0.16, duration: 0.45 }}
            className="flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-line-strong bg-panel shadow-2xl shadow-black/60"
          >
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-lg border border-amber-400/25 bg-amber-400/10 text-amber-glow">
                  <Pencil size={14} />
                </span>
                <div>
                  <h3 className="font-display text-[15px] font-bold tracking-tight">
                    Modify coupon #{sale.couponNumber}
                  </h3>
                  <p className="text-[11px] text-white/40">
                    {new Date(sale.closedAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="cursor-pointer rounded-lg p-1.5 text-white/40 hover:bg-white/[0.06] hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
              <div className="flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-3.5 py-2.5 text-[11.5px] leading-relaxed text-white/55">
                <TriangleAlert size={13} className="mt-0.5 shrink-0 text-amber-glow" />
                <p>
                  Changing quantities moves stock in the opposite direction — removing a
                  unit puts it back on the shelf. Original unit prices are preserved.
                </p>
              </div>

              <div className="space-y-2">
                {lines.map((l, i) => {
                  const stock = l.productId ? productMap.get(l.productId)?.quantity ?? 0 : 0;
                  const diff = l.quantity - l.originalQuantity;
                  return (
                    <div
                      key={`${l.productId}-${i}`}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl border px-3 py-2.5",
                        l.quantity === 0
                          ? "border-danger/25 bg-danger/[0.05] opacity-60"
                          : "border-line bg-white/[0.02]"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-white/90">
                          {l.productName}
                          {l.productId === null && (
                            <span className="ml-1.5 text-[10px] text-white/30">(removed article)</span>
                          )}
                        </p>
                        <p className="tnum text-[11px] text-white/35">
                          {formatCents(l.unitSellCents, currency)} each
                          {diff !== 0 && (
                            <span className={diff > 0 ? "ml-1.5 text-amber-glow" : "ml-1.5 text-mint"}>
                              {diff > 0 ? `−${diff} from stock` : `+${-diff} back to stock`}
                            </span>
                          )}
                          {l.productId !== null && (
                            <span className="ml-1.5 text-white/25">· {stock} on shelf</span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setQty(l.productId, i, -1)}
                          disabled={l.productId === null || l.quantity === 0}
                          className="cursor-pointer rounded-md border border-line p-1.5 text-white/60 hover:bg-white/[0.06] disabled:opacity-30"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="tnum w-7 text-center text-sm font-semibold">
                          {l.quantity}
                        </span>
                        <button
                          onClick={() => setQty(l.productId, i, 1)}
                          disabled={l.productId === null}
                          className="cursor-pointer rounded-md border border-line p-1.5 text-white/60 hover:bg-white/[0.06] disabled:opacity-30"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <p className="tnum w-20 text-right text-sm font-semibold text-white/90">
                        {formatCents(l.quantity * l.unitSellCents, currency)}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div>
                <FieldLabel>Add another product</FieldLabel>
                <ProductPicker products={products} value={null} onSelect={addProduct} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Cash received</FieldLabel>
                  <div className="relative">
                    <Banknote
                      size={14}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
                    />
                    <input
                      className={cn("field tnum pl-9", shortPaid && "!border-danger/50")}
                      inputMode="decimal"
                      placeholder="not recorded"
                      value={received}
                      onChange={(e) => {
                        if (/^[0-9]*[.,]?[0-9]*$/.test(e.target.value))
                          setReceived(e.target.value);
                      }}
                    />
                  </div>
                </div>
                <div className="rounded-xl border border-line bg-white/[0.02] px-3.5 py-2.5">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-white/35">
                    Change returned
                  </p>
                  <p
                    className={cn(
                      "tnum mt-0.5 font-display text-lg font-bold",
                      changeCents === null
                        ? "text-white/25"
                        : changeCents < 0
                          ? "text-danger"
                          : "text-mint"
                    )}
                  >
                    {changeCents === null ? "—" : formatCents(changeCents, currency)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-line bg-white/[0.02] px-6 py-4">
              <button
                onClick={voidCoupon}
                disabled={saving}
                className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-danger/30 px-3 py-2 text-xs font-semibold text-danger transition-colors hover:bg-danger/15 disabled:opacity-40"
              >
                <Trash2 size={13} /> Void coupon
              </button>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-white/35">
                    New total
                  </p>
                  <p className="tnum font-display text-lg font-bold text-mint">
                    {formatCents(totalCents, currency)}
                  </p>
                </div>
                <Button onClick={save} disabled={saving || shortPaid}>
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
