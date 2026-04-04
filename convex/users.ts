import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getByWallet = query({
  args: { walletAddress: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_walletAddress", (q) =>
        q.eq("walletAddress", args.walletAddress)
      )
      .unique();
  },
});

export const getById = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Idempotent: returns existing user or creates a new one for the given wallet
export const getOrCreateByWallet = mutation({
  args: { walletAddress: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_walletAddress", (q) =>
        q.eq("walletAddress", args.walletAddress)
      )
      .unique();
    if (existing) return existing._id;
    return await ctx.db.insert("users", { walletAddress: args.walletAddress });
  },
});

export const update = mutation({
  args: {
    id: v.id("users"),
    displayName: v.optional(v.string()),
    email: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) updates[key] = value;
    }
    await ctx.db.patch(id, updates);
  },
});
