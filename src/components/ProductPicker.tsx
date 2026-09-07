"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ScanBarcode } from "lucide-react";
import { cn, formatCents } from "@/lib/utils";
import type { ProductDTO } from "@/lib/types";

export function ProductPicker({
  products,
  value,
  onSelect,
  placeholder = "Search name or scan barcode…",
}: {
  products: ProductDTO[];
  value: ProductDTO | null;
  onSelect: (p: ProductDTO) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products.slice(0, 30);
    return products
      .filter(
        (p) => p.name.toLowerCase().includes(q) || p.barcode.toLowerCase().includes(q)
      )
      .slice(0, 30);
  }, [products, query]);

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <ScanBarcode
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
        />
        <input
          className="field pl-9 pr-9"
          placeholder={value ? value.name : placeholder}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            // Scanner guns end with "Enter" — pick exact barcode match instantly
            if (e.key === "Enter") {
              const exact = products.find(
                (p) => p.barcode.toLowerCase() === query.trim().toLowerCase()
              );
              const pick = exact ?? filtered[0];
              if (pick) {
                onSelect(pick);
                setQuery("");
                setOpen(false);
              }
            }
          }}
        />
        <ChevronDown
          size={15}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/30"
        />
      </div>

      <AnimatePresence>
        {open && filtered.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            className="absolute z-40 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-line-strong bg-panel/95 p-1.5 shadow-2xl shadow-black/60 backdrop-blur-xl"
          >
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  onSelect(p);
                  setQuery("");
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/[0.05]",
                  value?.id === p.id && "bg-mint-soft"
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white/90">{p.name}</p>
                  <p className="font-[family-name:var(--font-mono)] text-[11px] text-white/35">
                    {p.barcode}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tnum text-sm font-semibold text-mint">
                    {formatCents(p.sellPriceCents)}
                  </p>
                  <p
                    className={cn(
                      "text-[11px]",
                      p.quantity <= 5 ? "text-amber-glow" : "text-white/35"
                    )}
                  >
                    {p.quantity} in stock
                  </p>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
