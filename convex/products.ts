import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const pricingModelValidator = v.union(
  v.literal("per-unit"),
  v.literal("pay-as-you-go")
);

const privacyModeValidator = v.union(
  v.literal("standard"),
  v.literal("shielded"),
  v.literal("pseudonymous")
);

const refundPolicyValidator = v.union(
  v.literal("no-refund"),
  v.literal("partial"),
  v.literal("full")
);

export const listByCompany = query({
  args: {
    companyId: v.id("companies"),
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (args.activeOnly) {
      return await ctx.db
        .query("products")
        .withIndex("by_companyId_and_isActive", (q) =>
          q.eq("companyId", args.companyId).eq("isActive", true)
        )
        .order("desc")
        .take(100);
    }
    return await ctx.db
      .query("products")
      .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
      .order("desc")
      .take(100);
  },
});

export const getById = query({
  args: { id: v.id("products") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    companyId: v.id("companies"),
    name: v.string(),
    description: v.optional(v.string()),
    billingUnit: v.string(),
    pricingModel: pricingModelValidator,
    unitPriceCents: v.number(),
    currency: v.union(v.literal("USD"), v.literal("EUR")),
    settlementAsset: v.string(),
    privacyMode: privacyModeValidator,
    refundPolicy: refundPolicyValidator,
    webhookUrl: v.optional(v.string()),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("products", args);
  },
});

export const update = mutation({
  args: {
    id: v.id("products"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    billingUnit: v.optional(v.string()),
    pricingModel: v.optional(pricingModelValidator),
    unitPriceCents: v.optional(v.number()),
    currency: v.optional(v.union(v.literal("USD"), v.literal("EUR"))),
    settlementAsset: v.optional(v.string()),
    privacyMode: v.optional(privacyModeValidator),
    refundPolicy: v.optional(refundPolicyValidator),
    webhookUrl: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
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
  args: { id: v.id("products") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
