import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const stepValidator = v.union(
  v.literal("details"),
  v.literal("deploy"),
  v.literal("done")
);

export const get = query({
  args: { ownerWallet: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("onboardingState")
      .withIndex("by_ownerWallet", (q) =>
        q.eq("ownerWallet", args.ownerWallet)
      )
      .unique();
  },
});

export const save = mutation({
  args: {
    ownerWallet: v.string(),
    step: stepValidator,
    businessName: v.string(),
    description: v.optional(v.string()),
    industry: v.optional(v.string()),
    website: v.optional(v.string()),
    deployTxHash: v.optional(v.string()),
    deployedAddress: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("onboardingState")
      .withIndex("by_ownerWallet", (q) =>
        q.eq("ownerWallet", args.ownerWallet)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        step: args.step,
        businessName: args.businessName,
        description: args.description,
        industry: args.industry,
        website: args.website,
        deployTxHash: args.deployTxHash,
        deployedAddress: args.deployedAddress,
      });
      return existing._id;
    }

    return await ctx.db.insert("onboardingState", args);
  },
});

export const remove = mutation({
  args: { ownerWallet: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("onboardingState")
      .withIndex("by_ownerWallet", (q) =>
        q.eq("ownerWallet", args.ownerWallet)
      )
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});
