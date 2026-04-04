import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const modeValidator = v.union(
  v.literal("usage"),
  v.literal("invoice"),
  v.literal("one-time"),
  v.literal("checkout")
);

const statusValidator = v.union(
  v.literal("draft"),
  v.literal("sent"),
  v.literal("pending"),
  v.literal("paid"),
  v.literal("overdue"),
  v.literal("cancelled")
);

export const listByCompany = query({
  args: {
    companyId: v.id("companies"),
    status: v.optional(statusValidator),
  },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("customerPayments")
        .withIndex("by_companyId_and_status", (q) =>
          q.eq("companyId", args.companyId).eq("status", args.status!)
        )
        .order("desc")
        .take(100);
    }
    return await ctx.db
      .query("customerPayments")
      .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
      .order("desc")
      .take(100);
  },
});

export const listByCustomer = query({
  args: { customerId: v.id("customers") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("customerPayments")
      .withIndex("by_customerId", (q) => q.eq("customerId", args.customerId))
      .order("desc")
      .take(50);
  },
});

export const listByProduct = query({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("customerPayments")
      .withIndex("by_productId", (q) => q.eq("productId", args.productId))
      .order("desc")
      .take(50);
  },
});

export const getById = query({
  args: { id: v.id("customerPayments") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    companyId: v.id("companies"),
    customerId: v.optional(v.id("customers")),
    productId: v.optional(v.id("products")),
    mode: modeValidator,
    amountCents: v.number(),
    currency: v.union(v.literal("USD"), v.literal("EUR")),
    description: v.optional(v.string()),
    dueDate: v.optional(v.number()),
    referenceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("customerPayments", {
      ...args,
      status: "draft",
    });
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("customerPayments"),
    status: statusValidator,
    paidAt: v.optional(v.number()),
    txHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    await ctx.db.patch(id, fields);
  },
});

export const update = mutation({
  args: {
    id: v.id("customerPayments"),
    mode: v.optional(modeValidator),
    amountCents: v.optional(v.number()),
    currency: v.optional(v.union(v.literal("USD"), v.literal("EUR"))),
    description: v.optional(v.string()),
    dueDate: v.optional(v.number()),
    referenceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        updates[key] = value;
      }
    }
    await ctx.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id("customerPayments") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
