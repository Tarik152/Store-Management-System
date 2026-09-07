"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Banknote, CornerDownLeft, HandCoins, Receipt, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui";
import { cn, formatCents, parseMoneyToCents } from "@/lib/utils";

/** Cash denominations in cents, ascending. */
const DENOMS = [100, 200, 500, 1000, 2000, 5000, 10000, 20000];

export function CheckoutModal({
  open,
  totalCents,
  itemCount,
  currency = "$",
  confirming,
  onClose,
  onConfirm,
}: {
  open: boolean;
  totalCents: number;
  itemCount: number;
  currency?: string;
  confirming: boolean;
  onClose: () => void;
  onConfirm: (amountReceivedCents: number) => void;
}) {
  const [tendered, setTendered] = useState("");

  // Reset every time the window opens
  useEffect(() => {
    if (open) setTendered("");
  }, [open]);

  const receivedCents = useMemo(() => parseMoneyToCents(tendered), [tendered]);
  const changeCents = receivedCents === null ? null : receivedCents - totalCents;
  const covered = changeCents !== null && changeCents >= 0;

  // Suggested quick amounts: exact + the next 3 round bills above the total
  const suggestions = useMemo(() => {
    const above = DENOMS.filter((d) => d > totalCents).slice(0, 3);
    return [totalCents, ...above];
  }, [totalCents]);

  const confirm = () => {
    if (!covered || receivedCents === null || confirming) return;
    onConfirm(receivedCents);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      confirm();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
          onKeyDown={onKeyDown}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ type: "spring", bounce: 0.18, duration: 0.45 }}
            className="w-full max-w-sm overflow-hidden rounded-3xl border border-line-strong bg-panel shadow-2xl shadow-black/60"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-lg border border-mint/25 bg-mint-soft text-mint">
                  <HandCoins size={15} />
                </span>
                <div>
                  <h3 className="font-display text-[15px] font-bold tracking-tight">
                    Cash payment
                  </h3>
                  <p className="text-[11px] text-white/40">{itemCount} item{itemCount === 1 ? "" : "s"}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="cursor-pointer rounded-lg p-1.5 text-white/40 hover:bg-white/[0.06] hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              {/* Total */}
              <div className="flex items-center justify-between rounded-2xl border border-line bg-white/[0.02] px-4 py-3.5">
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/40">
                  <Receipt size={14} /> Total due
                </span>
                <span className="tnum font-display text-[24px] font-bold tracking-tight text-white">
                  {formatCents(totalCents, currency)}
                </span>
              </div>

              {/* Amount given */}
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">
                  <Banknote size={13} /> Amount given by customer
                </label>
                <input
                  autoFocus
                  inputMode="decimal"
                  className={cn(
                    "field tnum py-3 text-center font-display text-[22px] font-bold tracking-tight",
                    tendered !== "" &&
                      (covered
                        ? "!border-mint/50 !bg-mint/[0.05]"
                        : receivedCents !== null && "!border-danger/50 !bg-danger/[0.05]")
                  )}
                  placeholder="0.00"
                  value={tendered}
                  onChange={(e) => {
                    // digits + one decimal separator only, live as you type
                    if (/^[0-9]*[.,]?[0-9]*$/.test(e.target.value)) setTendered(e.target.value);
                  }}
                />
              </div>

              {/* Quick cash buttons */}
              <div className="flex flex-wrap gap-2">
                {suggestions.map((amt, i) => (
                  <button
                    key={amt}
                    onClick={() => setTendered((amt / 100).toFixed(2))}
                    className={cn(
                      "tnum flex-1 cursor-pointer whitespace-nowrap rounded-xl border px-3 py-2 text-[13px] font-semibold transition-all active:scale-[0.97]",
                      receivedCents === amt
                        ? "border-mint/50 bg-mint-soft text-mint"
                        : "border-line bg-white/[0.03] text-white/70 hover:border-white/20 hover:text-white"
                    )}
                  >
                    {i === 0 ? "Exact" : formatCents(amt, currency)}
                  </button>
                ))}
              </div>

              {/* Live change readout — adapts on every keystroke */}
              <div
                className={cn(
                  "flex items-center justify-between rounded-2xl border px-4 py-3.5 transition-colors duration-200",
                  changeCents === null
                    ? "border-line bg-white/[0.02]"
                    : covered
                      ? "border-mint/35 bg-mint-soft"
                      : "border-danger/35 bg-danger/[0.07]"
                )}
              >
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em]">
                  <Wallet
                    size={14}
                    className={cn(
                      changeCents === null
                        ? "text-white/40"
                        : covered
                          ? "text-mint"
                          : "text-danger"
                    )}
                  />
                  <span
                    className={cn(
                      changeCents === null
                        ? "text-white/40"
                        : covered
                          ? "text-mint"
                          : "text-danger"
                    )}
                  >
                    {changeCents === null
                      ? "Return money"
                      : covered
                        ? "Return money"
                        : "Still missing"}
                  </span>
                </span>
                <motion.span
                  key={changeCents === null ? "empty" : changeCents}
                  initial={{ opacity: 0.4, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.12 }}
                  className={cn(
                    "tnum font-display text-[22px] font-bold tracking-tight",
                    changeCents === null
                      ? "text-white/25"
                      : covered
                        ? "text-mint"
                        : "text-danger"
                  )}
                >
                  {changeCents === null
                    ? "—"
                    : formatCents(Math.abs(changeCents), currency)}
                </motion.span>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-line bg-white/[0.02] px-5 py-4">
              <Button
                onClick={confirm}
                disabled={!covered || confirming}
                className="w-full py-3 text-[15px]"
              >
                {confirming ? (
                  "Closing coupon…"
                ) : (
                  <>
                    Confirm & close coupon
                    <span className="flex items-center gap-1 text-[11px] font-medium opacity-70">
                      <CornerDownLeft size={11} /> Enter
                    </span>
                  </>
                )}
              </Button>
              {!covered && receivedCents !== null && (
                <p className="mt-2 text-center text-[11px] text-danger/80">
                  The amount given doesn't cover the total yet
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
