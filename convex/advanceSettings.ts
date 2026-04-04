import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const DEFAULTS = {
  enabled: true,
  interestRateBps: 200, // 2%
  maxCreditPercent: 80, // max 80% of next paycheck
  autoDisableThresholdMonths: 2, // disable if treasury < 2 months payroll
  autoDisabled: false,
};

export const getForCompany = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("creditSettings")
      .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
      .unique();
    if (!settings) return { ...DEFAULTS, companyId: args.companyId, _id: null };
    return settings;
  },
});

export const upsert = mutation({
  args: {
    companyId: v.id("companies"),
    enabled: v.optional(v.boolean()),
    interestRateBps: v.optional(v.number()),
    maxCreditPercent: v.optional(v.number()),
    autoDisableThresholdMonths: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("creditSettings")
      .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
      .unique();

    const updates = {
      ...(args.enabled !== undefined && { enabled: args.enabled }),
      ...(args.interestRateBps !== undefined && {
        interestRateBps: args.interestRateBps,
      }),
      ...(args.maxCreditPercent !== undefined && {
        maxCreditPercent: args.maxCreditPercent,
      }),
      ...(args.autoDisableThresholdMonths !== undefined && {
        autoDisableThresholdMonths: args.autoDisableThresholdMonths,
      }),
    };

    if (existing) {
      await ctx.db.patch(existing._id, updates);
      return existing._id;
    }

    return await ctx.db.insert("creditSettings", {
      companyId: args.companyId,
      ...DEFAULTS,
      ...updates,
    });
  },
});

export const setAutoDisabled = mutation({
  args: {
    companyId: v.id("companies"),
    autoDisabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("creditSettings")
      .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { autoDisabled: args.autoDisabled });
    }
  },
});
