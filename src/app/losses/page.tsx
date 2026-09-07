"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { PackageX, Skull, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { ProductPicker } from "@/components/ProductPicker";
import { Badge, Button, FieldLabel, SectionTitle } from "@/components/ui";
import { formatCents } from "@/lib/utils";
import type { LossDTO, ProductDTO } from "@/lib/types";

const REASONS = [
  { value: "expired", label: "Expired / past due" },
  { value: "spoiled", label: "Spoiled" },
  { value: "damaged", label: "Damaged" },
  { value: "stolen", label: "Stolen / missing" },
  { value: "other", label: "Other" },
];

const reasonTone = (r: string) =>
  r === "expired" ? "rose" : r === "damaged" ? "amber" : r === "spoiled" ? "amber" : "neutral";

export default function LossesPage() {
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [losses, setLosses] = useState<LossDTO[]>([]);
  const [selected, setSelected] = useState<ProductDTO | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("expired");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [pRes, lRes] = await Promise.all([
        fetch("/api/products", { cache: "no-store" }),
        fetch("/api/losses", { cache: "no-store" }),
      ]);
      const pData = await pRes.json();
      const lData = await lRes.json();
      setProducts(pData.products ?? []);
      setLosses(lData.losses ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    const value = losses.reduce((a, l) => a + l.quantity * l.unitCostCents, 0);
    const units = losses.reduce((a, l) => a + l.quantity, 0);
    return { value, units, events: losses.length };
  }, [losses]);

  const submit = async () => {
    if (!selected) return toast.error("Pick the product you lost");
    const qty = Math.floor(Number(quantity));
    if (!Number.isFinite(qty) || qty <= 0) return toast.error("Enter a valid quantity");
    setSaving(true);
    try {
      const res = await fetch("/api/losses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: selected.id, quantity: qty, reason, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to record loss");
      toast.success("Loss recorded", {
        description: `${qty} × ${selected.name} written off and removed from stock.`,
      });
      setSelected(null);
      setQuantity("1");
      setNote("");
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1280px]">
      <PageHeader
        title="Losses"
        subtitle="Write off expired or damaged stock — quantities leave inventory immediately."
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
        <StatCard label="Value written off" valueCents={totals.value} icon={Skull} tone="rose" index={0} hint="At purchase cost" />
        <StatCard label="Units lost" rawValue={totals.units} icon={PackageX} tone="amber" index={1} />
        <StatCard label="Loss events" rawValue={totals.events} icon={Trash2} tone="violet" index={2} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1.6fr]">
        {/* Entry form */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
          className="panel h-fit p-5"
        >
          <SectionTitle title="Record a loss" hint="e.g. product reached its due date" icon={<PackageX size={15} />} />
          <div className="space-y-4">
            <div>
              <FieldLabel>Product</FieldLabel>
              <ProductPicker products={products} value={selected} onSelect={setSelected} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Quantity lost</FieldLabel>
                <input
                  className="field tnum"
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              <div>
                <FieldLabel>Reason</FieldLabel>
                <select
                  className="field cursor-pointer appearance-none"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                >
                  {REASONS.map((r) => (
                    <option key={r.value} value={r.value} className="bg-panel">
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <FieldLabel>Note (optional)</FieldLabel>
              <textarea
                className="field min-h-[74px] resize-none"
                placeholder="e.g. Found on aisle 3, already curdled…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            {selected && (
              <div className="rounded-xl border border-danger/20 bg-danger/[0.06] px-3.5 py-2.5 text-xs text-white/60">
                Writing off{" "}
                <span className="tnum font-semibold text-danger">
                  {formatCents(
                    Math.max(0, Math.floor(Number(quantity) || 0)) * selected.buyPriceCents
                  )}
                </span>{" "}
                at cost · {selected.quantity} currently in stock
              </div>
            )}
            <Button variant="danger" onClick={submit} disabled={saving} className="w-full">
              {saving ? "Recording…" : "Record loss"}
            </Button>
          </div>
        </motion.div>

        {/* History */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.16 }}
          className="panel p-5"
        >
          <SectionTitle title="Loss history" hint="Most recent first" icon={<Skull size={15} />} />
          <div className="space-y-2">
            {loading && <p className="py-10 text-center text-sm text-white/35">Loading…</p>}
            {!loading && losses.length === 0 && (
              <div className="rounded-xl border border-dashed border-line-strong px-4 py-12 text-center text-sm text-white/35">
                Clean sheet — no losses recorded yet.
              </div>
            )}
            {losses.map((l, i) => (
              <motion.div
                key={l.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.4) }}
                className="flex items-center gap-4 rounded-xl border border-line bg-white/[0.02] px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white/90">{l.productName}</p>
                  <p className="mt-0.5 text-xs text-white/35">
                    {new Date(l.createdAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {l.note ? ` · ${l.note}` : ""}
                  </p>
                </div>
                <Badge tone={reasonTone(l.reason) as any}>{l.reason}</Badge>
                <span className="tnum text-sm text-white/50">×{l.quantity}</span>
                <span className="tnum w-24 text-right text-sm font-bold text-danger">
                  -{formatCents(l.quantity * l.unitCostCents)}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
