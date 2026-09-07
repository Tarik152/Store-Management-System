"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  History,
  Minus,
  Pencil,
  Plus,
  Receipt,
  ScanBarcode,
  Search,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { CheckoutModal } from "@/components/CheckoutModal";
import { CouponEditModal } from "@/components/CouponEditModal";
import { Button, SectionTitle } from "@/components/ui";
import { cn, formatCents } from "@/lib/utils";
import type { OpenCouponDTO, ProductDTO, SaleDTO } from "@/lib/types";

const MAX_OPEN = 10;

export default function PosPage() {
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [currency, setCurrency] = useState("$");
  const [coupons, setCoupons] = useState<OpenCouponDTO[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [closed, setClosed] = useState<SaleDTO[]>([]);
  /** null = live coupon, 0 = most recent closed coupon, 1 = older, … */
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [editSale, setEditSale] = useState<SaleDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastCoupon, setLastCoupon] = useState<{
    number: number;
    changeCents: number;
  } | null>(null);

  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  // ---------------------------------------------------------------- loading
  const loadAll = useCallback(async () => {
    const [pRes, sRes, oRes, salesRes] = await Promise.all([
      fetch("/api/products", { cache: "no-store" }),
      fetch("/api/settings", { cache: "no-store" }),
      fetch("/api/open-coupons", { cache: "no-store" }),
      fetch("/api/sales", { cache: "no-store" }),
    ]);
    const pData = await pRes.json();
    const sData = await sRes.json();
    const oData = await oRes.json();
    const salesData = await salesRes.json();

    setProducts(pData.products ?? []);
    if (sData.settings?.currency) setCurrency(sData.settings.currency);
    setClosed(salesData.sales ?? []);

    let list: OpenCouponDTO[] = oData.coupons ?? [];
    if (list.length === 0) {
      const created = await fetch("/api/open-coupons", { method: "POST" });
      const cData = await created.json();
      if (cData.coupon) list = [cData.coupon];
    }
    setCoupons(list);
    setActiveId((prev) =>
      prev !== null && list.some((c) => c.id === prev) ? prev : (list[0]?.id ?? null)
    );
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ------------------------------------------------------------- derivation
  const productMap = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products]
  );
  const activeCoupon = coupons.find((c) => c.id === activeId) ?? null;
  const viewingSale = historyIndex === null ? null : (closed[historyIndex] ?? null);
  const isLive = historyIndex === null;

  const totalOf = useCallback(
    (c: OpenCouponDTO) =>
      c.items.reduce(
        (a, i) => a + (productMap.get(i.productId)?.sellPriceCents ?? 0) * i.quantity,
        0
      ),
    [productMap]
  );

  const lines = useMemo(() => {
    if (!activeCoupon) return [];
    return activeCoupon.items
      .map((i) => ({ product: productMap.get(i.productId), quantity: i.quantity }))
      .filter((l): l is { product: ProductDTO; quantity: number } => !!l.product);
  }, [activeCoupon, productMap]);

  const totalCents = lines.reduce(
    (a, l) => a + l.product.sellPriceCents * l.quantity,
    0
  );
  const itemCount = lines.reduce((a, l) => a + l.quantity, 0);

  /** Units already parked inside the OTHER open coupons. */
  const heldElsewhere = useMemo(() => {
    const map = new Map<number, number>();
    for (const c of coupons) {
      if (c.id === activeId) continue;
      for (const i of c.items) map.set(i.productId, (map.get(i.productId) ?? 0) + i.quantity);
    }
    return map;
  }, [coupons, activeId]);

  const availableOf = useCallback(
    (p: ProductDTO) => p.quantity - (heldElsewhere.get(p.id) ?? 0),
    [heldElsewhere]
  );

  // ------------------------------------------------------------ persistence
  const persist = useCallback(
    (couponId: number, items: { productId: number; quantity: number }[]) => {
      clearTimeout(timers.current[couponId]);
      timers.current[couponId] = setTimeout(() => {
        fetch(`/api/open-coupons/${couponId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
        }).catch(() => {});
      }, 300);
    },
    []
  );

  const mutate = useCallback(
    (
      couponId: number,
      updater: (
        items: { productId: number; quantity: number }[]
      ) => { productId: number; quantity: number }[]
    ) => {
      const coupon = coupons.find((c) => c.id === couponId);
      if (!coupon) return;
      const items = updater(coupon.items);
      setCoupons((prev) =>
        prev.map((c) => (c.id === couponId ? { ...c, items } : c))
      );
      persist(couponId, items);
    },
    [coupons, persist]
  );

  // ---------------------------------------------------------------- actions
  const add = (p: ProductDTO) => {
    if (!activeId) return;
    if (!isLive) {
      setHistoryIndex(null);
      toast.info("Back on the live coupon");
    }
    const available = availableOf(p);
    const current = activeCoupon?.items.find((i) => i.productId === p.id)?.quantity ?? 0;
    if (available <= 0) return toast.error(`"${p.name}" is not available`);
    if (current + 1 > available)
      return toast.error(
        `Only ${available} × "${p.name}" available${
          heldElsewhere.get(p.id) ? " (rest held in other coupons)" : ""
        }`
      );

    mutate(activeId, (items) => {
      const found = items.find((i) => i.productId === p.id);
      return found
        ? items.map((i) => (i.productId === p.id ? { ...i, quantity: i.quantity + 1 } : i))
        : [...items, { productId: p.id, quantity: 1 }];
    });
  };

  const step = (productId: number, delta: number) => {
    if (!activeId) return;
    const p = productMap.get(productId);
    if (delta > 0 && p) {
      const current = activeCoupon?.items.find((i) => i.productId === productId)?.quantity ?? 0;
      if (current + 1 > availableOf(p)) return toast.error(`Only ${availableOf(p)} available`);
    }
    mutate(activeId, (items) =>
      items
        .map((i) => (i.productId === productId ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0)
    );
  };

  const removeLine = (productId: number) => {
    if (!activeId) return;
    mutate(activeId, (items) => items.filter((i) => i.productId !== productId));
  };

  const renameCoupon = (couponId: number, label: string) => {
    setCoupons((prev) => prev.map((c) => (c.id === couponId ? { ...c, label } : c)));
    clearTimeout(timers.current[couponId]);
    timers.current[couponId] = setTimeout(() => {
      fetch(`/api/open-coupons/${couponId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      }).catch(() => {});
    }, 400);
  };

  const newCoupon = async () => {
    if (coupons.length >= MAX_OPEN)
      return toast.error(`Maximum ${MAX_OPEN} coupons can stay open at once`);
    setBusy(true);
    try {
      const res = await fetch("/api/open-coupons", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCoupons((prev) => [...prev, data.coupon]);
      setActiveId(data.coupon.id);
      setHistoryIndex(null);
      toast.success(`${data.coupon.label} opened`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const discardCoupon = async (couponId: number) => {
    const coupon = coupons.find((c) => c.id === couponId);
    if (!coupon) return;
    if (
      coupon.items.length > 0 &&
      !confirm(`Discard "${coupon.label}"? Its ${coupon.items.length} line(s) are lost.`)
    )
      return;

    await fetch(`/api/open-coupons/${couponId}`, { method: "DELETE" });
    const rest = coupons.filter((c) => c.id !== couponId);
    setCoupons(rest);
    if (rest.length === 0) {
      const res = await fetch("/api/open-coupons", { method: "POST" });
      const data = await res.json();
      setCoupons([data.coupon]);
      setActiveId(data.coupon.id);
    } else if (activeId === couponId) {
      setActiveId(rest[rest.length - 1].id);
    }
  };

  const confirmCheckout = async (amountReceivedCents: number) => {
    if (!activeId) return;
    setClosing(true);
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
          amountReceivedCents,
          openCouponId: activeId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to close coupon");

      const change = data.sale.changeCents ?? amountReceivedCents - totalCents;
      setLastCoupon({ number: data.sale.couponNumber, changeCents: change });
      setCheckoutOpen(false);
      toast.success(`Coupon #${data.sale.couponNumber} closed`, {
        description:
          change > 0
            ? `Return ${formatCents(change, currency)} to the customer`
            : `${itemCount} items · exact cash`,
      });
      setCoupons((prev) => prev.filter((c) => c.id !== activeId));
      setActiveId(null);
      await loadAll();
      setHistoryIndex(null);
      setTimeout(() => setLastCoupon(null), 6000);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setClosing(false);
    }
  };

  // ------------------------------------------------------- history browsing
  const goBack = useCallback(() => {
    setHistoryIndex((prev) => {
      if (closed.length === 0) return prev;
      if (prev === null) return 0;
      return Math.min(prev + 1, closed.length - 1);
    });
  }, [closed.length]);

  const goForward = useCallback(() => {
    setHistoryIndex((prev) => (prev === null ? null : prev === 0 ? null : prev - 1));
  }, []);

  // Arrow keys browse history (ignored while typing or in a modal)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (checkoutOpen || editSale) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goBack();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goForward();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goBack, goForward, checkoutOpen, editSale]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? products.filter(
          (p) => p.name.toLowerCase().includes(q) || p.barcode.toLowerCase().includes(q)
        )
      : products;
    return base.slice(0, 48);
  }, [products, query]);

  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    const exact = products.find(
      (p) => p.barcode.toLowerCase() === query.trim().toLowerCase()
    );
    if (exact) {
      add(exact);
      setQuery("");
    } else if (filtered.length === 1) {
      add(filtered[0]);
      setQuery("");
    } else if (query.trim()) {
      toast.error("No exact barcode match");
    }
  };

  return (
    <div className="mx-auto max-w-[1280px]">
      <PageHeader
        title="Point of Sale"
        subtitle={`Keep up to ${MAX_OPEN} coupons open · browse past ones with ← →`}
      />

      {/* Open coupon tabs */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-4 flex flex-wrap items-center gap-2"
      >
        {coupons.map((c) => {
          const active = c.id === activeId && isLive;
          const count = c.items.reduce((a, i) => a + i.quantity, 0);
          return (
            <button
              key={c.id}
              onClick={() => {
                setActiveId(c.id);
                setHistoryIndex(null);
              }}
              className={cn(
                "group relative flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2 transition-all",
                active
                  ? "border-mint/40 bg-mint-soft text-white"
                  : c.id === activeId
                    ? "border-line-strong bg-white/[0.05] text-white/70"
                    : "border-line bg-white/[0.02] text-white/50 hover:border-white/20 hover:text-white/85"
              )}
            >
              <span className="flex flex-col items-start leading-tight">
                <span className="text-[13px] font-semibold">{c.label}</span>
                <span className="tnum text-[10.5px] opacity-60">
                  {count === 0 ? "empty" : `${count} item${count > 1 ? "s" : ""} · ${formatCents(totalOf(c), currency)}`}
                </span>
              </span>
              {active && <span className="size-1.5 rounded-full bg-mint" />}
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  discardCoupon(c.id);
                }}
                onKeyDown={(e) => e.key === "Enter" && discardCoupon(c.id)}
                className="ml-0.5 cursor-pointer rounded p-0.5 text-white/25 opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
              >
                <X size={13} />
              </span>
            </button>
          );
        })}

        <button
          onClick={newCoupon}
          disabled={coupons.length >= MAX_OPEN || busy}
          className={cn(
            "flex cursor-pointer items-center gap-1.5 rounded-xl border border-dashed px-3.5 py-2.5 text-[13px] font-semibold transition-all",
            coupons.length >= MAX_OPEN
              ? "cursor-not-allowed border-line text-white/25"
              : "border-mint/30 text-mint hover:bg-mint-soft"
          )}
        >
          <Plus size={14} /> New coupon
          <span className="tnum text-[10.5px] opacity-60">
            {coupons.length}/{MAX_OPEN}
          </span>
        </button>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.6fr_1fr]">
        {/* Catalogue */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="panel p-5"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <SectionTitle
              title="Catalogue"
              hint="Click a product or scan a barcode"
              icon={<ScanBarcode size={15} />}
            />
            <div className="relative w-64">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
              />
              <input
                className="field pl-9"
                placeholder="Scan barcode or search…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onSearchKey}
              />
            </div>
          </div>

          <div className="grid max-h-[560px] grid-cols-2 gap-2.5 overflow-y-auto pr-1 lg:grid-cols-3">
            {filtered.map((p) => {
              const available = availableOf(p);
              const held = heldElsewhere.get(p.id) ?? 0;
              return (
                <button
                  key={p.id}
                  onClick={() => add(p)}
                  disabled={available <= 0}
                  className={cn(
                    "group cursor-pointer rounded-2xl border border-line bg-white/[0.02] p-3.5 text-left transition-all duration-200 hover:border-mint/35 hover:bg-mint-soft",
                    available <= 0 &&
                      "cursor-not-allowed opacity-35 hover:border-line hover:bg-white/[0.02]"
                  )}
                >
                  <p className="truncate text-[13.5px] font-semibold text-white/90">{p.name}</p>
                  <p className="mt-0.5 truncate font-[family-name:var(--font-mono)] text-[10.5px] text-white/30">
                    {p.barcode}
                  </p>
                  <div className="mt-2.5 flex items-end justify-between">
                    <p className="tnum text-[15px] font-bold text-mint">
                      {formatCents(p.sellPriceCents, currency)}
                    </p>
                    <p
                      className={cn(
                        "text-[11px]",
                        available <= 0
                          ? "text-danger"
                          : available <= 5
                            ? "text-amber-glow"
                            : "text-white/35"
                      )}
                    >
                      {available <= 0 ? "unavailable" : `${available} left`}
                      {held > 0 && <span className="text-white/25"> · {held} held</span>}
                    </p>
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="col-span-full rounded-xl border border-dashed border-line-strong px-4 py-10 text-center text-sm text-white/35">
                No products match. Register articles in Inventory first.
              </div>
            )}
          </div>
        </motion.div>

        {/* Coupon panel */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08 }}
          className="panel flex flex-col p-5"
        >
          {/* History navigator */}
          <div className="mb-4 flex items-center gap-2">
            <button
              onClick={goBack}
              disabled={closed.length === 0 || historyIndex === closed.length - 1}
              title="Previous coupon (←)"
              className="cursor-pointer rounded-lg border border-line p-2 text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-25 disabled:hover:bg-transparent"
            >
              <ChevronLeft size={15} />
            </button>

            <div
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-1.5 text-center transition-colors",
                isLive
                  ? "border-mint/25 bg-mint-soft"
                  : "border-amber-400/25 bg-amber-400/[0.07]"
              )}
            >
              {isLive ? (
                <>
                  <span className="relative flex size-1.5">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-mint opacity-70" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-mint" />
                  </span>
                  <span className="text-[12px] font-semibold text-mint">
                    Live · {activeCoupon?.label ?? "—"}
                  </span>
                </>
              ) : (
                <>
                  <History size={12} className="text-amber-glow" />
                  <span className="text-[12px] font-semibold text-amber-glow">
                    Coupon #{viewingSale?.couponNumber} ·{" "}
                    {historyIndex! + 1}/{closed.length}
                  </span>
                </>
              )}
            </div>

            <button
              onClick={goForward}
              disabled={isLive}
              title="Next / back to live coupon (→)"
              className="cursor-pointer rounded-lg border border-line p-2 text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-25 disabled:hover:bg-transparent"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          {/* ---------------------------------------------- past coupon view */}
          {!isLive && viewingSale && (
            <div className="flex flex-1 flex-col">
              <p className="mb-2 text-[11px] text-white/35">
                Closed{" "}
                {new Date(viewingSale.closedAt).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <div className="min-h-[180px] flex-1 space-y-2 overflow-y-auto">
                {(viewingSale.items ?? []).map((it) => (
                  <div
                    key={it.id}
                    className="flex items-center gap-2.5 rounded-xl border border-line bg-white/[0.02] px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-white/85">
                        {it.productName}
                      </p>
                      <p className="tnum text-[11px] text-white/35">
                        {formatCents(it.unitSellCents, currency)} × {it.quantity}
                      </p>
                    </div>
                    <p className="tnum text-sm font-semibold text-white/85">
                      {formatCents(it.unitSellCents * it.quantity, currency)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-white/50">Total</span>
                  <span className="tnum font-display text-[22px] font-bold text-white">
                    {formatCents(viewingSale.totalCents, currency)}
                  </span>
                </div>
                {viewingSale.amountReceivedCents != null && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/40">
                      Paid {formatCents(viewingSale.amountReceivedCents, currency)}
                    </span>
                    <span className="tnum font-semibold text-mint">
                      change {formatCents(viewingSale.changeCents ?? 0, currency)}
                    </span>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setEditSale(viewingSale)}
                  >
                    <Pencil size={14} /> Modify coupon
                  </Button>
                  <Button variant="ghost" onClick={() => setHistoryIndex(null)}>
                    Back to live
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------- live coupon */}
          {isLive && (
            <>
              <div className="mb-3">
                <input
                  className="field py-2 text-[13px] font-semibold"
                  value={activeCoupon?.label ?? ""}
                  placeholder="Ticket name (e.g. Table 4, Mrs. Diaz)"
                  onChange={(e) => activeId && renameCoupon(activeId, e.target.value)}
                />
              </div>

              <SectionTitle
                title="Current coupon"
                hint={
                  itemCount
                    ? `${itemCount} item${itemCount > 1 ? "s" : ""} in basket`
                    : "Basket is empty"
                }
                icon={<ShoppingCart size={15} />}
              />

              <div className="min-h-[180px] flex-1 space-y-2 overflow-y-auto">
                <AnimatePresence initial={false}>
                  {lines.map((l) => (
                    <motion.div
                      key={l.product.id}
                      layout
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -16 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center gap-2.5 rounded-xl border border-line bg-white/[0.02] px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-white/90">
                          {l.product.name}
                        </p>
                        <p className="tnum text-[11px] text-white/35">
                          {formatCents(l.product.sellPriceCents, currency)} × {l.quantity}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => step(l.product.id, -1)}
                          className="cursor-pointer rounded-md border border-line p-1.5 text-white/60 hover:bg-white/[0.06]"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="tnum w-7 text-center text-sm font-semibold">
                          {l.quantity}
                        </span>
                        <button
                          onClick={() => step(l.product.id, 1)}
                          className="cursor-pointer rounded-md border border-line p-1.5 text-white/60 hover:bg-white/[0.06]"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <p className="tnum w-20 text-right text-sm font-semibold text-white/90">
                        {formatCents(l.product.sellPriceCents * l.quantity, currency)}
                      </p>
                      <button
                        onClick={() => removeLine(l.product.id)}
                        className="cursor-pointer rounded-md p-1.5 text-white/30 hover:bg-danger/15 hover:text-danger"
                      >
                        <Trash2 size={13} />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {lines.length === 0 && (
                  <div className="grid h-[180px] place-items-center rounded-xl border border-dashed border-line-strong text-center text-sm text-white/30">
                    Scan or tap products to fill this coupon
                  </div>
                )}
              </div>

              <div className="mt-4 border-t border-line pt-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm text-white/50">Total</span>
                  <span className="tnum font-display text-[26px] font-bold tracking-tight text-mint">
                    {formatCents(totalCents, currency)}
                  </span>
                </div>
                <Button
                  onClick={() => setCheckoutOpen(true)}
                  disabled={lines.length === 0 || closing}
                  className="w-full py-3.5 text-[15px]"
                >
                  <Receipt size={17} />
                  {closing ? "Closing…" : "Close coupon"}
                </Button>
              </div>

              <AnimatePresence>
                {lastCoupon && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="mt-3 flex items-center gap-2.5 rounded-xl border border-mint/30 bg-mint-soft px-4 py-3"
                  >
                    <CheckCircle2 size={17} className="text-mint" />
                    <div>
                      <p className="text-sm font-semibold text-mint">
                        Coupon #{lastCoupon.number} closed & stock updated
                      </p>
                      <p className="tnum text-xs text-mint/70">
                        {lastCoupon.changeCents > 0
                          ? `Return ${formatCents(lastCoupon.changeCents, currency)} to the customer`
                          : "Exact amount received"}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </motion.div>
      </div>

      <CheckoutModal
        open={checkoutOpen}
        totalCents={totalCents}
        itemCount={itemCount}
        currency={currency}
        confirming={closing}
        onClose={() => setCheckoutOpen(false)}
        onConfirm={confirmCheckout}
      />

      <CouponEditModal
        open={!!editSale}
        sale={editSale}
        products={products}
        currency={currency}
        onClose={() => setEditSale(null)}
        onSaved={loadAll}
      />
    </div>
  );
}
