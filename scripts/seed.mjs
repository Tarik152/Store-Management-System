import "dotenv/config";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// --- tiny EAN-13 helpers (mirrors src/lib/barcode.ts) -----------------------
function checksum(first12) {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += i % 2 === 0 ? +first12[i] : +first12[i] * 3;
  return (10 - (sum % 10)) % 10;
}
function ean13(prefix) {
  let body = prefix;
  while (body.length < 12) body += Math.floor(Math.random() * 10);
  return body + checksum(body);
}
const rand = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

// --- catalogue (cents, expiryOffsetDays relative to today) ------------------
const CATALOGUE = [
  { name: "Whole Milk 1L", barcode: ean13("405"), qty: 40, buy: 68, sell: 129, exp: 3 },
  { name: "Greek Yogurt 500g", barcode: ean13("406"), qty: 30, buy: 145, sell: 259, exp: 1 },
  { name: "Sourdough Bread", barcode: ean13("203"), qty: 15, buy: 120, sell: 240, exp: -2 },
  { name: "Free-Range Eggs 12ct", barcode: ean13("408"), qty: 36, buy: 230, sell: 399, exp: 20 },
  { name: "Bananas (per bag 1kg)", barcode: ean13("201"), qty: 25, buy: 75, sell: 149, exp: 5 },
  { name: "Cheddar Cheese 250g", barcode: ean13("410"), qty: 20, buy: 210, sell: 379, exp: 12 },
  { name: "Orange Juice 1L", barcode: ean13("412"), qty: 24, buy: 150, sell: 289, exp: 6 },
  { name: "Dark Chocolate 70% 100g", barcode: ean13("415"), qty: 30, buy: 130, sell: 249, exp: null },
  { name: "Sparkling Water 6×1L", barcode: ean13("418"), qty: 40, buy: 240, sell: 420, exp: null },
  { name: "Basmati Rice 5kg", barcode: ean13("420"), qty: 12, buy: 690, sell: 1090, exp: null },
  { name: "Espresso Beans 500g", barcode: ean13("422"), qty: 18, buy: 520, sell: 890, exp: 90 },
  { name: "Butter 250g", barcode: ean13("424"), qty: 22, buy: 165, sell: 295, exp: 9 },
  { name: "Chicken Breast 1kg", barcode: ean13("426"), qty: 16, buy: 430, sell: 699, exp: -1 },
  { name: "Tomato Passata 700g", barcode: ean13("428"), qty: 28, buy: 95, sell: 179, exp: 120 },
];

const LOSS_PLAN = [
  { name: "Sourdough Bread", qty: 2, reason: "expired", daysAgo: 2, note: "Past due, pulled from shelf" },
  { name: "Whole Milk 1L", qty: 3, reason: "expired", daysAgo: 5, note: "Batch turned early" },
  { name: "Chicken Breast 1kg", qty: 1, reason: "damaged", daysAgo: 1, note: "Packaging torn" },
];

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "TRUNCATE sale_items, sales, losses, products, settings RESTART IDENTITY CASCADE"
    );

    // products
    const products = [];
    for (const c of CATALOGUE) {
      const { rows } = await client.query(
        `insert into products (name, barcode, quantity, buy_price_cents, sell_price_cents, expiry_date)
         values ($1,$2,$3,$4,$5, case when $6::int is null then null else current_date + $6::int end)
         returning *`,
        [c.name, c.barcode, c.qty, c.buy, c.sell, c.exp]
      );
      products.push({ ...rows[0], remaining: c.qty, byName: c.name });
    }
    const byName = new Map(products.map((p) => [p.name, p]));
    const soldByProduct = new Map();

    // coupons across last 14 days
    let couponNumber = 1001;
    for (let d = 13; d >= 0; d--) {
      const couponsToday = d === 0 ? rand(2, 4) : rand(1, 4);
      for (let k = 0; k < couponsToday; k++) {
        const picks = [...products]
          .sort(() => Math.random() - 0.5)
          .slice(0, rand(1, 4))
          .filter((p) => p.remaining > 0);
        if (picks.length === 0) continue;

        let total = 0;
        let cost = 0;
        let count = 0;
        const lines = [];
        for (const p of picks) {
          const qty = Math.min(rand(1, 2), p.remaining);
          if (qty <= 0) continue;
          p.remaining -= qty;
          soldByProduct.set(p.name, (soldByProduct.get(p.name) ?? 0) + qty);
          total += p.sell_price_cents * qty;
          cost += p.buy_price_cents * qty;
          count += qty;
          lines.push({ p, qty });
        }
        if (lines.length === 0) continue;

        const closedAt = new Date();
        closedAt.setDate(closedAt.getDate() - d);
        closedAt.setHours(rand(8, 20), rand(0, 59), rand(0, 59), 0);

        const { rows } = await client.query(
          `insert into sales (coupon_number, status, item_count, total_cost_cents, total_cents, closed_at)
           values ($1,'closed',$2,$3,$4,$5) returning id`,
          [couponNumber++, count, cost, total, closedAt]
        );
        const saleId = rows[0].id;
        for (const { p, qty } of lines) {
          await client.query(
            `insert into sale_items (sale_id, product_id, product_name, barcode, quantity, unit_buy_cents, unit_sell_cents)
             values ($1,$2,$3,$4,$5,$6,$7)`,
            [saleId, p.id, p.name, p.barcode, qty, p.buy_price_cents, p.sell_price_cents]
          );
        }
      }
    }

    // losses
    for (const l of LOSS_PLAN) {
      const p = byName.get(l.name);
      const when = new Date();
      when.setDate(when.getDate() - l.daysAgo);
      when.setHours(rand(9, 18), rand(0, 59), 0, 0);
      p.remaining -= l.qty;
      await client.query(
        `insert into losses (product_id, product_name, quantity, unit_cost_cents, reason, note, created_at)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [p.id, p.name, l.qty, p.buy_price_cents, l.reason, l.note, when]
      );
    }

    // settle final stock
    for (const p of products) {
      await client.query(`update products set quantity = $1 where id = $2`, [
        Math.max(0, p.remaining),
        p.id,
      ]);
    }

    await client.query(
      `insert into settings (expiry_alert_days, low_stock_threshold, currency) values (7, 5, '$')`
    );

    await client.query("COMMIT");

    const { rows: counts } = await client.query(
      `select
        (select count(*) from products) as products,
        (select count(*) from sales) as sales,
        (select count(*) from sale_items) as items,
        (select count(*) from losses) as losses`
    );
    console.log(
      `Seeded: ${counts[0].products} products, ${counts[0].sales} coupons, ${counts[0].items} sold lines, ${counts[0].losses} losses.`
    );
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
