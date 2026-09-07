import {
  pgTable,
  serial,
  integer,
  text,
  varchar,
  date,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";

/**
 * All money values are stored as integer cents to avoid float issues.
 */

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  barcode: varchar("barcode", { length: 64 }).notNull().unique(),
  quantity: integer("quantity").notNull().default(0),
  buyPriceCents: integer("buy_price_cents").notNull().default(0),
  sellPriceCents: integer("sell_price_cents").notNull().default(0),
  expiryDate: date("expiry_date"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sales = pgTable("sales", {
  id: serial("id").primaryKey(),
  couponNumber: integer("coupon_number").notNull().unique(),
  status: varchar("status", { length: 16 }).notNull().default("closed"),
  itemCount: integer("item_count").notNull().default(0),
  totalCostCents: integer("total_cost_cents").notNull().default(0),
  totalCents: integer("total_cents").notNull().default(0),
  amountReceivedCents: integer("amount_received_cents"),
  changeCents: integer("change_cents"),
  closedAt: timestamp("closed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const saleItems = pgTable("sale_items", {
  id: serial("id").primaryKey(),
  saleId: integer("sale_id")
    .notNull()
    .references(() => sales.id, { onDelete: "cascade" }),
  productId: integer("product_id").references(() => products.id, {
    onDelete: "set null",
  }),
  productName: varchar("product_name", { length: 160 }).notNull(),
  barcode: varchar("barcode", { length: 64 }).notNull(),
  quantity: integer("quantity").notNull(),
  unitBuyCents: integer("unit_buy_cents").notNull(),
  unitSellCents: integer("unit_sell_cents").notNull(),
});

/** Purchase coupons — goods entering the store from a supplier. */
export const purchases = pgTable("purchases", {
  id: serial("id").primaryKey(),
  purchaseNumber: integer("purchase_number").notNull().unique(),
  supplier: varchar("supplier", { length: 120 }),
  note: text("note"),
  itemCount: integer("item_count").notNull().default(0),
  totalCostCents: integer("total_cost_cents").notNull().default(0),
  purchasedAt: timestamp("purchased_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const purchaseItems = pgTable("purchase_items", {
  id: serial("id").primaryKey(),
  purchaseId: integer("purchase_id")
    .notNull()
    .references(() => purchases.id, { onDelete: "cascade" }),
  productId: integer("product_id").references(() => products.id, {
    onDelete: "set null",
  }),
  productName: varchar("product_name", { length: 160 }).notNull(),
  barcode: varchar("barcode", { length: 64 }).notNull(),
  quantity: integer("quantity").notNull(),
  unitCostCents: integer("unit_cost_cents").notNull(),
  unitSellCents: integer("unit_sell_cents").notNull(),
  expiryDate: date("expiry_date"),
  isNewProduct: boolean("is_new_product").notNull().default(false),
});

/** Parked / held tickets — coupons the cashier keeps open before closing. */
export const openCoupons = pgTable("open_coupons", {
  id: serial("id").primaryKey(),
  label: varchar("label", { length: 60 }).notNull().default("Ticket"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const openCouponItems = pgTable("open_coupon_items", {
  id: serial("id").primaryKey(),
  couponId: integer("coupon_id")
    .notNull()
    .references(() => openCoupons.id, { onDelete: "cascade" }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull(),
});

export const losses = pgTable("losses", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id, {
    onDelete: "set null",
  }),
  productName: varchar("product_name", { length: 160 }).notNull(),
  quantity: integer("quantity").notNull(),
  unitCostCents: integer("unit_cost_cents").notNull(),
  reason: varchar("reason", { length: 32 }).notNull().default("expired"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  expiryAlertDays: integer("expiry_alert_days").notNull().default(7),
  lowStockThreshold: integer("low_stock_threshold").notNull().default(5),
  currency: varchar("currency", { length: 8 }).notNull().default("$"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type Sale = typeof sales.$inferSelect;
export type SaleItem = typeof saleItems.$inferSelect;
export type Loss = typeof losses.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type Purchase = typeof purchases.$inferSelect;
export type PurchaseItem = typeof purchaseItems.$inferSelect;
