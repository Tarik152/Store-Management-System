"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();
    let raf: number;
    const tick = (t: number) => {
      const p = Math.min((t - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

export function StatCard({
  label,
  valueCents,
  rawValue,
  suffix,
  hint,
  icon: Icon,
  tone = "mint",
  index = 0,
  currency = "$",
}: {
  label: string;
  valueCents?: number;
  rawValue?: number;
  suffix?: string;
  hint?: string;
  icon: LucideIcon;
  tone?: "mint" | "amber" | "rose" | "sky" | "violet";
  index?: number;
  currency?: string;
}) {
  const target = rawValue ?? valueCents ?? 0;
  const animated = useCountUp(Math.abs(target));

  const tones = {
    mint: "text-mint bg-mint-soft border-mint/20",
    amber: "text-amber-glow bg-amber-400/10 border-amber-400/20",
    rose: "text-danger bg-danger/10 border-danger/20",
    sky: "text-sky-300 bg-sky-400/10 border-sky-400/20",
    violet: "text-violet-300 bg-violet-400/10 border-violet-400/20",
  } as const;

  const display =
    valueCents !== undefined ? (
      <>
        {target < 0 && "-"}
        {currency}
        {(animated / 100).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </>
    ) : (
      <>
        {animated.toLocaleString()}
        {suffix && <span className="ml-1 text-base text-white/40">{suffix}</span>}
      </>
    );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="panel panel-hover relative overflow-hidden p-5"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
            {label}
          </p>
          <p className="tnum mt-2 font-display text-[26px] font-bold leading-none tracking-tight">
            {display}
          </p>
          {hint && <p className="mt-2 text-xs text-white/35">{hint}</p>}
        </div>
        <span
          className={cn("grid size-10 shrink-0 place-items-center rounded-xl border", tones[tone])}
        >
          <Icon size={18} />
        </span>
      </div>
    </motion.div>
  );
}
