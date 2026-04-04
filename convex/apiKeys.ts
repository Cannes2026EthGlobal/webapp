import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const listByCompany = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("apiKeys")
      .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
      .take(20);
  },
});

export const create = mutation({
  args: {
    companyId: v.id("companies"),
    keyHash: v.string(),
    keyPrefix: v.string(),
    label: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("apiKeys", {
      companyId: args.companyId,
      keyHash: args.keyHash,
      keyPrefix: args.keyPrefix,
      label: args.label,
      isActive: true,
    });
  },
});

export const revoke = mutation({
  args: { id: v.id("apiKeys") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { isActive: false });
  },
});

export const validateKeyHash = internalQuery({
  args: { keyHash: v.string() },
  handler: async (ctx, args) => {
    const apiKey = await ctx.db
      .query("apiKeys")
      .withIndex("by_keyHash", (q) => q.eq("keyHash", args.keyHash))
      .unique();
    if (!apiKey || !apiKey.isActive) return null;

    const company = await ctx.db.get(apiKey.companyId);
    if (!company) return null;

    return {
      apiKeyId: apiKey._id,
      companyId: apiKey.companyId,
      companyName: company.name,
    };
  },
});

export const touchLastUsed = internalMutation({
  args: { id: v.id("apiKeys") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { lastUsedAt: Date.now() });
  },
});
