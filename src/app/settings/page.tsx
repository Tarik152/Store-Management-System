"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BellRing, Boxes, Check, Coins, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button, FieldLabel, SectionTitle } from "@/components/ui";
import type { SettingsDTO } from "@/lib/types";

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsDTO | null>(null);
  const [days, setDays] = useState(7);
  const [lowStock, setLowStock] = useState(5);
  const [currency, setCurrency] = useState("$");
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const s: SettingsDTO = d.settings;
        setSettings(s);
        setDays(s.expiryAlertDays);
        setLowStock(s.lowStockThreshold);
        setCurrency(s.currency);
      });
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expiryAlertDays: days,
          lowStockThreshold: lowStock,
          currency,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setSettings(data.settings);
      toast.success("Settings saved", {
        description: `AI will now flag due products ${days} day${days === 1 ? "" : "s"} ahead.`,
      });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1800);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-[860px]">
      <PageHeader title="Settings" subtitle="Tune how the AI watches your store." />

      <div className="space-y-4">
        {/* AI expiry window */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="panel p-6"
        >
          <SectionTitle
            title="AI expiry notifications"
            hint="How far before the due date should I start warning you?"
            icon={<BellRing size={15} />}
          />

          <div className="mt-2 rounded-2xl border border-line bg-white/[0.02] p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/60">Alert window</span>
              <span className="tnum rounded-lg border border-mint/30 bg-mint-soft px-3 py-1 font-display text-lg font-bold text-mint">
                {days} day{days === 1 ? "" : "s"}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={60}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="mt-4 w-full cursor-pointer accent-lime-400"
            />
            <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wider text-white/25">
              <span>Same day</span>
              <span>30d</span>
              <span>60d</span>
            </div>
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-line bg-black/20 p-3.5 text-xs leading-relaxed text-white/50">
              <Sparkles size={14} className="mt-0.5 shrink-0 text-mint" />
              <p>
                {days === 0
                  ? "I'll notify you only on the exact due date — tight, but risky for slow movers."
                  : `I'll start flagging products ${days} day${days === 1 ? "" : "s"} before they expire, suggest discount depth, and escalate anything that slips past due. Change this anytime — the watchtower adapts instantly.`}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Stock + currency */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08 }}
          className="panel p-6"
        >
          <SectionTitle title="Store preferences" hint="Thresholds and display" icon={<Boxes size={15} />} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel>Low stock threshold (units)</FieldLabel>
              <input
                className="field tnum"
                type="number"
                min={0}
                value={lowStock}
                onChange={(e) => setLowStock(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
              />
              <p className="mt-1.5 text-[11px] text-white/30">
                Products at or below this count get flagged in reports and AI insights.
              </p>
            </div>
            <div>
              <FieldLabel>Currency symbol</FieldLabel>
              <div className="relative">
                <Coins size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  className="field pl-9"
                  maxLength={4}
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-white/30">
                Used for all money displays — e.g. $, €, £, CHF.
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-end border-t border-line pt-5">
            <Button onClick={save} disabled={saving || !settings} className="min-w-[160px]">
              {savedFlash ? (
                <>
                  <Check size={15} /> Saved
                </>
              ) : (
                <>
                  <Save size={15} /> {saving ? "Saving…" : "Save settings"}
                </>
              )}
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
