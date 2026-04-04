import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getByWallet = query({
  args: { wallet: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("businessProfiles")
      .withIndex("by_ownerWallet", (q) => q.eq("ownerWallet", args.wallet))
      .unique();
  },
});

export const create = mutation({
  args: {
    ownerWallet: v.string(),
    businessName: v.string(),
    description: v.optional(v.string()),
    industry: v.optional(v.string()),
    website: v.optional(v.string()),
    payrollContractAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("businessProfiles")
      .withIndex("by_ownerWallet", (q) => q.eq("ownerWallet", args.ownerWallet))
      .unique();
    if (existing) {
      throw new Error("Business profile already exists for this wallet");
    }
    return await ctx.db.insert("businessProfiles", args);
  },
});

export const update = mutation({
  args: {
    id: v.id("businessProfiles"),
    businessName: v.optional(v.string()),
    description: v.optional(v.string()),
    industry: v.optional(v.string()),
    website: v.optional(v.string()),
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
