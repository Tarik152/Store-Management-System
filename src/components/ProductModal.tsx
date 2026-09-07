"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Dices, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button, FieldLabel } from "@/components/ui";
import { parseMoneyToCents } from "@/lib/utils";
import type { ProductDTO } from "@/lib/types";

export function ProductModal({
  open,
  initial,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** When provided the modal edits this product, otherwise it creates one. */
  initial?: ProductDTO | null;
  onClose: () => void;
  onSaved: (p: ProductDTO) => void;
}) {
  const editing = !!initial;
  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [quantity, setQuantity] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setBarcode(initial?.barcode ?? "");
      setQuantity(initial ? String(initial.quantity) : "");
      setBuyPrice(initial ? (initial.buyPriceCents / 100).toFixed(2) : "");
      setSellPrice(initial ? (initial.sellPriceCents / 100).toFixed(2) : "");
      setExpiryDate(initial?.expiryDate ?? "");
    }
  }, [open, initial]);

  const generateBarcode = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/barcode", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBarcode(data.barcode);
      toast.success("In-store EAN-13 generated", {
        description: "Codes starting with 20x are reserved for internal use.",
      });
    } catch (e: any) {
      toast.error(e.message ?? "Could not generate barcode");
    } finally {
      setGenerating(false);
    }
  };

  const save = async () => {
    const buyCents = parseMoneyToCents(buyPrice);
    const sellCents = parseMoneyToCents(sellPrice);
    if (!name.trim()) return toast.error("Name is required");
    if (!barcode.trim()) return toast.error("Barcode is required — type one or generate it");
    if (buyCents === null || buyCents < 0) return toast.error("Enter a valid buy price");
    if (sellCents === null || sellCents < 0) return toast.error("Enter a valid sell price");
    const qty = Math.floor(Number(quantity || "0"));
    if (!Number.isFinite(qty) || qty < 0) return toast.error("Enter a valid quantity");

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        barcode: barcode.trim(),
        quantity: qty,
        buyPriceCents: buyCents,
        sellPriceCents: sellCents,
        expiryDate: expiryDate || null,
      };
      const res = await fetch(
        editing ? `/api/products/${initial!.id}` : "/api/products",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      toast.success(editing ? "Product updated" : "Product added to inventory");
      onSaved(data.product);
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const margin =
    parseMoneyToCents(sellPrice ?? "") !== null && parseMoneyToCents(buyPrice ?? "") !== null
      ? ((parseMoneyToCents(sellPrice)! - parseMoneyToCents(buyPrice)!) /
          Math.max(parseMoneyToCents(sellPrice)!, 1)) *
        100
      : null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: "spring", bounce: 0.18, duration: 0.5 }}
            className="w-full max-w-lg overflow-hidden rounded-3xl border border-line-strong bg-panel shadow-2xl shadow-black/60"
          >
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <div>
                <h3 className="font-display text-lg font-bold tracking-tight">
                  {editing ? "Modify item" : "New product"}
                </h3>
                <p className="text-xs text-white/40">
                  {editing
                    ? `Editing “${initial!.name}” · stock edits are corrections`
                    : "Register an article in your stock"}
                </p>
              </div>
              <button
                onClick={onClose}
                className="cursor-pointer rounded-lg p-2 text-white/40 hover:bg-white/[0.06] hover:text-white"
              >
                <X size={17} />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div>
                <FieldLabel>Product name</FieldLabel>
                <input
                  className="field"
                  placeholder="e.g. Whole milk 1L"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <FieldLabel>Barcode</FieldLabel>
                <div className="flex gap-2">
                  <input
                    className="field font-[family-name:var(--font-mono)] tracking-wider"
                    placeholder="Scan or type EAN / UPC…"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value.replace(/[^\dA-Za-z-]/g, ""))}
                  />
                  <button
                    onClick={generateBarcode}
                    disabled={generating}
                    title="Generate a random in-store EAN-13"
                    className="group flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-mint/30 bg-mint-soft px-3.5 text-xs font-semibold text-mint transition-all hover:bg-mint/20 disabled:opacity-50"
                  >
                    <Dices
                      size={15}
                      className={
                        generating ? "animate-spin" : "transition-transform group-hover:rotate-180"
                      }
                    />
                    {generating ? "Rolling…" : "Generate"}
                  </button>
                </div>
                <p className="mt-1.5 flex items-center gap-1 text-[11px] text-white/30">
                  <Sparkles size={11} className="text-mint/60" />
                  No barcode on the article? Generate a GS1-safe in-store code (prefix 20x).
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <FieldLabel>Stock on hand</FieldLabel>
                  <input
                    className="field tnum"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    title="Manual correction — purchases should be entered in Buys"
                  />
                </div>
                <div>
                  <FieldLabel>Buy price</FieldLabel>
                  <input
                    className="field tnum"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={buyPrice}
                    onChange={(e) => setBuyPrice(e.target.value)}
                  />
                </div>
                <div>
                  <FieldLabel>Sell price</FieldLabel>
                  <input
                    className="field tnum"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={sellPrice}
                    onChange={(e) => setSellPrice(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 items-end gap-3">
                <div>
                  <FieldLabel>Due / expiry date (optional)</FieldLabel>
                  <input
                    className="field"
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                  />
                </div>
                <div className="rounded-xl border border-line bg-white/[0.02] px-3 py-2.5 text-xs">
                  <span className="text-white/35">Margin: </span>
                  {margin !== null && Number.isFinite(margin) ? (
                    <span className={margin >= 0 ? "font-semibold text-mint" : "font-semibold text-danger"}>
                      {margin.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-white/40">—</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-line bg-white/[0.02] px-6 py-4">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? "Saving…" : editing ? "Save changes" : "Add product"}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
