import { NextResponse } from "next/server";
import { db } from "@/db";
import { losses, products, purchases, saleItems, sales, settings } from "@/db/schema";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function GET() {
  const settingsRows = await db.select().from(settings).limit(1);
  const cfg = settingsRows[0] ?? { expiryAlertDays: 7, lowStockThreshold: 5, currency: "$" };

  const allProducts = await db.select().from(products);
  const allSales = await db.select().from(sales);
  const allItems = await db.select().from(saleItems);
  const allLosses = await db.select().from(losses);
  const allPurchases = await db.select().from(purchases);

  // ---- totals ----------------------------------------------------------
  const productsSold = allItems.reduce((a, i) => a + i.quantity, 0);
  const soldCostCents = allItems.reduce((a, i) => a + i.quantity * i.unitBuyCents, 0);
  const soldRevenueCents = allItems.reduce((a, i) => a + i.quantity * i.unitSellCents, 0);
  const profitCents = soldRevenueCents - soldCostCents;

  const lossValueCents = allLosses.reduce((a, l) => a + l.quantity * l.unitCostCents, 0);
  const lossUnits = allLosses.reduce((a, l) => a + l.quantity, 0);

  const stockUnits = allProducts.reduce((a, p) => a + p.quantity, 0);
  const stockCostCents = allProducts.reduce((a, p) => a + p.quantity * p.buyPriceCents, 0);
  const stockRetailCents = allProducts.reduce((a, p) => a + p.quantity * p.sellPriceCents, 0);

  // ---- daily series (last 14 days) --------------------------------------
  const days: { date: string; label: string; revenue: number; profit: number }[] = [];
  const today = startOfDay(new Date());
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({
      date: key,
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      revenue: 0,
      profit: 0,
    });
  }
  const dayMap = new Map(days.map((d) => [d.date, d]));
  const saleById = new Map(allSales.map((s) => [s.id, s]));
  for (const it of allItems) {
    const sale = saleById.get(it.saleId);
    if (!sale) continue;
    const key = startOfDay(new Date(sale.closedAt)).toISOString().slice(0, 10);
    const bucket = dayMap.get(key);
    if (bucket) {
      bucket.revenue += it.quantity * it.unitSellCents;
      bucket.profit += it.quantity * (it.unitSellCents - it.unitBuyCents);
    }
  }

  // ---- top products by profit -------------------------------------------
  const perProduct = new Map<
    string,
    { name: string; units: number; revenue: number; profit: number }
  >();
  for (const it of allItems) {
    const cur =
      perProduct.get(it.barcode) ?? { name: it.productName, units: 0, revenue: 0, profit: 0 };
    cur.units += it.quantity;
    cur.revenue += it.quantity * it.unitSellCents;
    cur.profit += it.quantity * (it.unitSellCents - it.unitBuyCents);
    perProduct.set(it.barcode, cur);
  }
  const topProducts = [...perProduct.values()]
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 5);

  // ---- expiry radar ------------------------------------------------------
  const todayStr = today.toISOString().slice(0, 10);
  const limit = new Date(today);
  limit.setDate(limit.getDate() + cfg.expiryAlertDays);
  const limitStr = limit.toISOString().slice(0, 10);

  const expiring = allProducts
    .filter((p) => p.expiryDate && p.quantity > 0 && String(p.expiryDate) <= limitStr)
    .map((p) => {
      const daysLeft = Math.round(
        (new Date(String(p.expiryDate)).getTime() - today.getTime()) / 86400000
      );
      return {
        id: p.id,
        name: p.name,
        barcode: p.barcode,
        quantity: p.quantity,
        daysLeft,
        expiryDate: String(p.expiryDate),
        valueCents: p.quantity * p.buyPriceCents,
        status: (String(p.expiryDate) < todayStr ? "expired" : "expiring") as
          | "expired"
          | "expiring",
      };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const lowStock = allProducts
    .filter((p) => p.quantity <= cfg.lowStockThreshold)
    .map((p) => ({ id: p.id, name: p.name, quantity: p.quantity, barcode: p.barcode }))
    .sort((a, b) => a.quantity - b.quantity)
    .slice(0, 10);

  return NextResponse.json({
    currency: cfg.currency,
    totals: {
      couponsClosed: allSales.length,
      productsSold,
      soldCostCents,
      soldRevenueCents,
      profitCents,
      lossValueCents,
      lossUnits,
      lossEvents: allLosses.length,
      purchaseSpendCents: allPurchases.reduce((a, p) => a + p.totalCostCents, 0),
      purchaseCount: allPurchases.length,
      purchaseUnits: allPurchases.reduce((a, p) => a + p.itemCount, 0),
      productCount: allProducts.length,
      stockUnits,
      stockCostCents,
      stockRetailCents,
      marginPct:
        soldRevenueCents > 0
          ? Math.round((profitCents / soldRevenueCents) * 1000) / 10
          : 0,
    },
    series: days,
    topProducts,
    expiring,
    lowStock,
    recentSales: allSales
      .sort((a, b) => +new Date(b.closedAt) - +new Date(a.closedAt))
      .slice(0, 8),
  });
}
