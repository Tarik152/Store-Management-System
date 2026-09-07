"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Package, PackagePlus, Pencil, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { ProductModal } from "@/components/ProductModal";
import { Badge, Button, SectionTitle } from "@/components/ui";
import { cn, formatCents } from "@/lib/utils";
import type { ProductDTO, SettingsDTO } from "@/lib/types";

function ExpiryPill({
  expiry,
  alertDays,
}: {
  expiry: string | null;
  alertDays: number;
}) {
  if (!expiry) return <span className="text-xs text-white/25">No due date</span>;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysLeft = Math.round((new Date(expiry).getTime() - today.getTime()) / 86400000);
  if (daysLeft < 0) return <Badge tone="rose">Expired {-daysLeft}d ago</Badge>;
  if (daysLeft === 0) return <Badge tone="rose">Due today</Badge>;
  if (daysLeft <= alertDays) return <Badge tone="amber">{daysLeft}d left</Badge>;
  return (
    <span className="text-xs text-white/45">
      {new Date(expiry).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}
    </span>
  );
}

export default function InventoryPage() {
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [settings, setSettings] = useState<SettingsDTO | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProductDTO | null>(null);

  const load = useCallback(async () => {
    try {
      const [pRes, sRes] = await Promise.all([
        fetch("/api/products", { cache: "no-store" }),
        fetch("/api/settings", { cache: "no-store" }),
      ]);
      const pData = await pRes.json();
      const sData = await sRes.json();
      setProducts(pData.products ?? []);
      setSettings(sData.settings ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.barcode.toLowerCase().includes(q)
    );
  }, [products, query]);

  const remove = async (p: ProductDTO) => {
    if (!confirm(`Delete “${p.name}” permanently?`)) return;
    const res = await fetch(`/api/products/${p.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error ?? "Delete failed");
    toast.success("Product deleted");
    setProducts((prev) => prev.filter((x) => x.id !== p.id));
  };

  const currency = settings?.currency ?? "$";
  const alertDays = settings?.expiryAlertDays ?? 7;

  return (
    <div className="mx-auto max-w-[1280px]">
      <PageHeader
        title="Inventory"
        subtitle="Adjust names, prices and due dates. New stock comes in through Buys."
      >
        <Link href="/buys">
          <Button variant="outline">
            <PackagePlus size={15} /> Record a purchase
          </Button>
        </Link>
      </PageHeader>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="panel p-5"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <SectionTitle
            title={`${filtered.length} article${filtered.length === 1 ? "" : "s"}`}
            hint="Search by name or barcode"
            icon={<Package size={15} />}
          />
          <div className="relative w-72">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
            />
            <input
              className="field pl-9"
              placeholder="Search inventory…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-[0.12em] text-white/35">
                <th className="pb-3 pr-4 font-semibold">Product</th>
                <th className="pb-3 pr-4 font-semibold">Barcode</th>
                <th className="pb-3 pr-4 text-right font-semibold">Stock</th>
                <th className="pb-3 pr-4 text-right font-semibold">Buy price</th>
                <th className="pb-3 pr-4 text-right font-semibold">Sell price</th>
                <th className="pb-3 pr-4 text-right font-semibold">Margin</th>
                <th className="pb-3 pr-4 font-semibold">Due date</th>
                <th className="pb-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-white/35">
                    Loading inventory…
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <p className="text-white/35">
                      {products.length === 0 ? (
                        <>
                          Inventory is empty — articles appear here once you{" "}
                          <Link href="/buys" className="font-semibold text-mint hover:underline">
                            record a purchase
                          </Link>
                          .
                        </>
                      ) : (
                        "Nothing matches your search."
                      )}
                    </p>
                  </td>
                </tr>
              )}
              {filtered.map((p, i) => {
                const margin =
                  p.sellPriceCents > 0
                    ? ((p.sellPriceCents - p.buyPriceCents) / p.sellPriceCents) * 100
                    : 0;
                return (
                  <motion.tr
                    key={p.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                    className="group border-b border-line/60 transition-colors last:border-0 hover:bg-white/[0.02]"
                  >
                    <td className="py-3 pr-4">
                      <p className="font-medium text-white/90">{p.name}</p>
                    </td>
                    <td className="py-3 pr-4 font-[family-name:var(--font-mono)] text-xs text-white/45">
                      {p.barcode}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <span
                        className={cn(
                          "tnum font-semibold",
                          p.quantity === 0
                            ? "text-danger"
                            : p.quantity <= (settings?.lowStockThreshold ?? 5)
                              ? "text-amber-glow"
                              : "text-white/85"
                        )}
                      >
                        {p.quantity}
                      </span>
                    </td>
                    <td className="tnum py-3 pr-4 text-right text-white/60">
                      {formatCents(p.buyPriceCents, currency)}
                    </td>
                    <td className="tnum py-3 pr-4 text-right font-medium text-white/90">
                      {formatCents(p.sellPriceCents, currency)}
                    </td>
                    <td
                      className={cn(
                        "tnum py-3 pr-4 text-right font-medium",
                        margin >= 0 ? "text-mint" : "text-danger"
                      )}
                    >
                      {margin.toFixed(0)}%
                    </td>
                    <td className="py-3 pr-4">
                      <ExpiryPill expiry={p.expiryDate} alertDays={alertDays} />
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => {
                            setEditing(p);
                            setModalOpen(true);
                          }}
                          className="cursor-pointer rounded-lg p-2 text-white/40 transition-colors hover:bg-white/[0.07] hover:text-white"
                          title="Modify item"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => remove(p)}
                          className="cursor-pointer rounded-lg p-2 text-white/40 transition-colors hover:bg-danger/15 hover:text-danger"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>

      <ProductModal
        open={modalOpen}
        initial={editing}
        onClose={() => setModalOpen(false)}
        onSaved={() => load()}
      />
    </div>
  );
}
