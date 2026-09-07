"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="mb-7 flex flex-wrap items-end justify-between gap-4"
    >
      <div>
        <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-white/40">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </motion.div>
  );
}
