"use client";

import { useEffect, useMemo, useState } from "react";
import { Dices, PackagePlus, Repeat2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button, FieldLabel } from "@/components/ui";
import { ProductPicker } from "@/components/ProductPicker";
import { cn, formatCents, parseMoneyToCents } from "@/lib/utils";
import type { DraftBuyLine, ProductDTO } from "@/lib/types";

/**
 * Entry form for a single purchase line.
 * Two modes: restock an existing article, or bring in a brand-new one.
 */
export function BuyLineForm({
  products,
  currency,
  onAdd,
}: {
  products: ProductDTO[];
  currency: string;
  onAdd: (line: DraftBuyLine) => void;
}) {
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [picked, setPicked] = useState<ProductDTO | null>(null);
  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [quantity, setQuantity] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [generating, setGenerating] = useState(false);

  // Selecting an existing article prefills everything from the catalogue
  useEffect(() => {
    if (mode === "existing" && picked) {
      setName(picked.name);
      setBarcode(picked.barcode);
      setBuyPrice((picked.buyPriceCents / 100).toFixed(2));
      setSellPrice((picked.sellPriceCents / 100).toFixed(2));
      setExpiryDate(picked.expiryDate ?? "");
    }
  }, [mode, picked]);

  const reset = () => {
    setPicked(null);
    setName("");
    setBarcode("");
    setQuantity("");
    setBuyPrice("");
    setSellPrice("");
    setExpiryDate("");
  };

  const generateBarcode = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/barcode", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBarcode(data.barcode);
      toast.success("In-store EAN-13 generated");
    } catch (e: any) {
      toast.error(e.message ?? "Could not generate a barcode");
    } finally {
      setGenerating(false);
    }
  };

  const buyCents = parseMoneyToCents(buyPrice);
  const sellCents = parseMoneyToCents(sellPrice);
  const qty = Math.floor(Number(quantity || "0"));
  const lineTotal = buyCents !== null && qty > 0 ? buyCents * qty : 0;
  const margin =
    buyCents !== null && sellCents !== null && sellCents > 0
      ? ((sellCents - buyCents) / sellCents) * 100
      : null;

  const submit = () => {
    if (mode === "existing" && !picked) return toast.error("Pick the article you restocked");
    if (!name.trim()) return toast.error("Product name is required");
    if (!barcode.trim()) return toast.error("Barcode is required — type or generate one");
    if (!Number.isFinite(qty) || qty <= 0) return toast.error("Quantity must be at least 1");
    if (buyCents === null || buyCents < 0) return toast.error("Enter a valid buy price");
    if (sellCents === null || sellCents < 0) return toast.error("Enter a valid sell price");

    onAdd({
      key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      productId: mode === "existing" && picked ? picked.id : null,
      name: name.trim(),
      barcode: barcode.trim(),
      quantity: qty,
      buyPriceCents: buyCents,
      sellPriceCents: sellCents,
      expiryDate: expiryDate || null,
      isNew: mode === "new",
    });
    reset();
  };

  return (
    <div className="space-y-4">
      {/* Mode switch */}
      <div className="grid grid-cols-2 gap-2 rounded-xl border border-line bg-white/[0.02] p-1">
        {(
          [
            { key: "new", label: "New article", icon: PackagePlus },
            { key: "existing", label: "Restock existing", icon: Repeat2 },
          ] as const
        ).map((m) => {
          const Icon = m.icon;
          const active = mode === m.key;
          return (
            <button
              key={m.key}
              onClick={() => {
                setMode(m.key);
                reset();
              }}
              className={cn(
                "flex cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-semibold transition-all",
                active
                  ? "bg-mint-soft text-mint shadow-[inset_0_0_0_1px_rgba(163,230,53,0.25)]"
                  : "text-white/45 hover:text-white/75"
              )}
            >
              <Icon size={14} /> {m.label}
            </button>
          );
        })}
      </div>

      {mode === "existing" && (
        <div>
          <FieldLabel>Which article?</FieldLabel>
          <ProductPicker
            products={products}
            value={picked}
            onSelect={setPicked}
            placeholder="Search or scan the article you bought…"
          />
          {picked && (
            <p className="mt-1.5 text-[11px] text-white/35">
              Currently {picked.quantity} in stock · last cost{" "}
              {formatCents(picked.buyPriceCents, currency)}
            </p>
          )}
        </div>
      )}

      <div>
        <FieldLabel>Product name</FieldLabel>
        <input
          className="field"
          placeholder="e.g. Whole milk 1L"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={mode === "existing" && !picked}
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
            disabled={mode === "existing"}
          />
          {mode === "new" && (
            <button
              onClick={generateBarcode}
              disabled={generating}
              title="Generate an in-store EAN-13"
              className="group flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-mint/30 bg-mint-soft px-3.5 text-xs font-semibold text-mint transition-all hover:bg-mint/20 disabled:opacity-50"
            >
              <Dices
                size={15}
                className={generating ? "animate-spin" : "transition-transform group-hover:rotate-180"}
              />
              {generating ? "…" : "Generate"}
            </button>
          )}
        </div>
        {mode === "new" && (
          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-white/30">
            <Sparkles size={11} className="text-mint/60" />
            No barcode on the article? Generate a GS1-safe in-store code.
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <FieldLabel>Amount bought</FieldLabel>
          <input
            className="field tnum"
            type="number"
            min="1"
            placeholder="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
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
          <FieldLabel>Due / expiry date</FieldLabel>
          <input
            className="field"
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <div className="flex-1 rounded-xl border border-line bg-white/[0.02] px-3 py-2.5 text-xs">
            <span className="text-white/35">Margin </span>
            {margin !== null && Number.isFinite(margin) ? (
              <span className={margin >= 0 ? "font-semibold text-mint" : "font-semibold text-danger"}>
                {margin.toFixed(0)}%
              </span>
            ) : (
              <span className="text-white/40">—</span>
            )}
          </div>
          <div className="flex-1 rounded-xl border border-line bg-white/[0.02] px-3 py-2.5 text-xs">
            <span className="text-white/35">Cost </span>
            <span className="tnum font-semibold text-amber-glow">
              {formatCents(lineTotal, currency)}
            </span>
          </div>
        </div>
      </div>

      <Button onClick={submit} className="w-full">
        Add to purchase coupon
      </Button>
    </div>
  );
}
