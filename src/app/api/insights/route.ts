import { NextResponse } from "next/server";
import { db } from "@/db";
import { losses, products, saleItems, sales, settings } from "@/db/schema";
import { formatCents } from "@/lib/utils";

export const dynamic = "force-dynamic";

export type Insight = {
  id: string;
  type: "expiry" | "low-stock" | "loss" | "profit" | "stale";
  severity: "critical" | "warning" | "info" | "success";
  title: string;
  message: string;
  action?: string;
  productId?: number;
  createdAt: string;
};

/**
 * AI insight engine — analyses live store data and produces
 * natural-language notifications, prioritised by urgency.
 * The expiry window is controlled by the user's `expiryAlertDays` setting.
 */
export async function GET() {
  const cfgRows = await db.select().from(settings).limit(1);
  const cfg = cfgRows[0] ?? { expiryAlertDays: 7, lowStockThreshold: 5, currency: "$" };
  const c = cfg.currency;

  const allProducts = await db.select().from(products);
  const allSales = await db.select().from(sales);
  const allItems = await db.select().from(saleItems);
  const allLosses = await db.select().from(losses);

  const insights: Insight[] = [];
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);
  const limit = new Date(today);
  limit.setDate(limit.getDate() + cfg.expiryAlertDays);
  const limitStr = limit.toISOString().slice(0, 10);

  // ---------- Expired / expiring products ----------
  const expired = allProducts.filter(
    (p) => p.expiryDate && String(p.expiryDate) < todayStr && p.quantity > 0
  );
  const expiring = allProducts
    .filter(
      (p) =>
        p.expiryDate &&
        String(p.expiryDate) >= todayStr &&
        String(p.expiryDate) <= limitStr &&
        p.quantity > 0
    )
    .map((p) => ({
      p,
      daysLeft: Math.round(
        (new Date(String(p.expiryDate)).getTime() - today.getTime()) / 86400000
      ),
    }))
    .sort((a, b) => a.daysLeft - b.daysLeft);

  if (expired.length > 0) {
    const value = expired.reduce((a, p) => a + p.quantity * p.buyPriceCents, 0);
    insights.push({
      id: "expired-batch",
      type: "expiry",
      severity: "critical",
      title: `${expired.length} product${expired.length > 1 ? "s are" : " is"} past due`,
      message: `${expired
        .slice(0, 3)
        .map((p) => `“${p.name}”`)
        .join(", ")}${expired.length > 3 ? ` and ${expired.length - 3} more` : ""} passed their due date with stock still on hand — ${formatCents(value, c)} of cost value at risk. Pull them from shelves and log a loss to keep your books accurate.`,
      action: "Go to Losses",
      createdAt: now.toISOString(),
    });
  }

  for (const { p, daysLeft } of expiring.slice(0, 4)) {
    const value = p.quantity * p.buyPriceCents;
    const retail = p.quantity * p.sellPriceCents;
    const suggestedDiscount = daysLeft <= 1 ? 50 : daysLeft <= 3 ? 30 : 15;
    insights.push({
      id: `expiry-${p.id}`,
      type: "expiry",
      severity: daysLeft <= 1 ? "critical" : "warning",
      title:
        daysLeft === 0
          ? `“${p.name}” expires today`
          : `“${p.name}” expires in ${daysLeft} day${daysLeft > 1 ? "s" : ""}`,
      message: `${p.quantity} unit${p.quantity > 1 ? "s" : ""} on shelf (${formatCents(value, c)} cost, ${formatCents(retail, c)} at retail). I suggest a ${suggestedDiscount}% flash discount now — recovering part of the margin beats writing off ${formatCents(value, c)} as a loss.`,
      action: "Review product",
      productId: p.id,
      createdAt: now.toISOString(),
    });
  }

  // ---------- Low stock ----------
  const lowStock = allProducts.filter((p) => p.quantity <= cfg.lowStockThreshold);
  const soldBarcodes = new Set(allItems.map((i) => i.barcode));
  const hotLow = lowStock.filter((p) => soldBarcodes.has(p.barcode));
  if (hotLow.length > 0) {
    insights.push({
      id: "low-stock",
      type: "low-stock",
      severity: "warning",
      title: `${hotLow.length} selling product${hotLow.length > 1 ? "s" : ""} running low`,
      message: `${hotLow
        .slice(0, 3)
        .map((p) => `“${p.name}” (${p.quantity} left)`)
        .join(", ")} ${hotLow.length > 1 ? "have" : "has"} sales history and ${hotLow.length > 1 ? "are" : "is"} at or below your ${cfg.lowStockThreshold}-unit threshold. Reorder before you miss revenue.`,
      action: "Open inventory",
      createdAt: now.toISOString(),
    });
  }

  // ---------- Loss pattern ----------
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 86400000);
  const recentLosses = allLosses.filter((l) => new Date(l.createdAt) >= thirtyDaysAgo);
  if (recentLosses.length > 0) {
    const value = recentLosses.reduce((a, l) => a + l.quantity * l.unitCostCents, 0);
    const byReason = new Map<string, number>();
    for (const l of recentLosses)
      byReason.set(l.reason, (byReason.get(l.reason) ?? 0) + l.quantity * l.unitCostCents);
    const top = [...byReason.entries()].sort((a, b) => b[1] - a[1])[0];
    insights.push({
      id: "loss-pattern",
      type: "loss",
      severity: "info",
      title: `${formatCents(value, c)} written off in the last 30 days`,
      message: `The leading cause is “${top[0]}” (${formatCents(top[1], c)}). ${
        top[0] === "expired"
          ? "Tighten reorder quantities on short-shelf-life items, or let me warn you earlier by increasing the alert window."
          : "Review handling and storage for these items to cut the repeat damage."
      }`,
      createdAt: now.toISOString(),
    });
  }

  // ---------- Profit pulse ----------
  const soldRevenue = allItems.reduce((a, i) => a + i.quantity * i.unitSellCents, 0);
  const soldCost = allItems.reduce((a, i) => a + i.quantity * i.unitBuyCents, 0);
  if (allSales.length > 0) {
    const profit = soldRevenue - soldCost;
    const avgCoupon = soldRevenue / allSales.length;
    insights.push({
      id: "profit-pulse",
      type: "profit",
      severity: profit >= 0 ? "success" : "warning",
      title:
        profit >= 0
          ? `Lifetime profit is ${formatCents(profit, c)}`
          : `You're ${formatCents(Math.abs(profit), c)} in the red`,
      message: `Across ${allSales.length} closed coupon${allSales.length > 1 ? "s" : ""}, average basket is ${formatCents(Math.round(avgCoupon), c)} and blended margin is ${
        soldRevenue > 0 ? Math.round((profit / soldRevenue) * 100) : 0
      }%. ${
        hotLow.length > 0
          ? "Restock your low sellers to keep the streak going."
          : "Inventory depth looks healthy — keep it up."
      }`,
      createdAt: now.toISOString(),
    });
  }

  // ---------- Summary line ----------
  const summaryParts: string[] = [];
  if (expired.length > 0) summaryParts.push(`${expired.length} expired`);
  if (expiring.length > 0)
    summaryParts.push(`${expiring.length} due within ${cfg.expiryAlertDays}d`);
  if (hotLow.length > 0) summaryParts.push(`${hotLow.length} low stock`);
  const summary =
    summaryParts.length > 0
      ? `Heads up: ${summaryParts.join(" · ")}.`
      : "All clear — nothing expiring, stock levels healthy, margins positive.";

  const order = { critical: 0, warning: 1, info: 2, success: 3 };
  insights.sort((a, b) => order[a.severity] - order[b.severity]);

  return NextResponse.json({ summary, insights });
}
