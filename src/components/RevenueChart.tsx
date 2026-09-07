"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCents } from "@/lib/utils";

export function RevenueChart({
  data,
  currency,
}: {
  data: { date: string; label: string; revenue: number; profit: number }[];
  currency: string;
}) {
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 6, left: 6, bottom: 0 }}>
          <defs>
            <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a3e635" stopOpacity={0.32} />
              <stop offset="100%" stopColor="#a3e635" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="prof" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} dy={6} interval={2} />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={(v: number) =>
              `${currency}${v >= 10000 ? Math.round(v / 1000) + "k" : Math.round(v / 100)}`
            }
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as any;
              return (
                <div className="rounded-xl border border-line-strong bg-panel/95 px-3.5 py-2.5 text-xs shadow-xl backdrop-blur">
                  <p className="mb-1.5 font-semibold text-white/80">{label}</p>
                  <p className="tnum text-mint">
                    Revenue · {formatCents(d.revenue, currency)}
                  </p>
                  <p className="tnum text-sky-300">
                    Profit · {formatCents(d.profit, currency)}
                  </p>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#a3e635"
            strokeWidth={2.2}
            fill="url(#rev)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
          <Area
            type="monotone"
            dataKey="profit"
            stroke="#38bdf8"
            strokeWidth={1.8}
            fill="url(#prof)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
