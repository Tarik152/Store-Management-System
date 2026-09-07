"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Flame, Info, RefreshCw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionTitle } from "@/components/ui";
import type { InsightDTO } from "@/lib/types";

const sevIcon = {
  critical: Flame,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle2,
} as const;

const sevCls = {
  critical: "text-danger border-danger/25 bg-danger/[0.07]",
  warning: "text-amber-glow border-amber-400/25 bg-amber-400/[0.07]",
  info: "text-sky-300 border-sky-400/25 bg-sky-400/[0.06]",
  success: "text-mint border-mint/25 bg-mint-soft",
} as const;

export function InsightsPanel({ compact = false }: { compact?: boolean }) {
  const [insights, setInsights] = useState<InsightDTO[]>([]);
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/insights", { cache: "no-store" });
      const data = await res.json();
      setInsights(data.insights ?? []);
      setSummary(data.summary ?? "");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="panel flex h-full flex-col p-5">
      <div className="flex items-start justify-between">
        <SectionTitle
          title="AI Watchtower"
          hint={summary || "Analysing your store…"}
          icon={<Sparkles size={15} />}
        />
        <button
          onClick={() => load()}
          className="cursor-pointer rounded-lg p-2 text-white/35 transition-colors hover:bg-white/[0.06] hover:text-white"
          title="Re-analyse"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="space-y-2.5 overflow-y-auto">
        {insights.length === 0 && !loading && (
          <div className="rounded-xl border border-line bg-white/[0.02] px-4 py-6 text-center text-sm text-white/40">
            No signals yet — add products with due dates and start selling.
          </div>
        )}
        {(compact ? insights.slice(0, 5) : insights).map((ins, i) => {
          const Icon = sevIcon[ins.severity];
          return (
            <motion.div
              key={ins.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06, duration: 0.4 }}
              className={cn("rounded-xl border p-3.5", sevCls[ins.severity])}
            >
              <div className="flex items-center gap-2">
                <Icon size={14} />
                <p className="text-[13px] font-semibold">{ins.title}</p>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-white/55">{ins.message}</p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
