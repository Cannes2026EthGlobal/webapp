import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getForCompany = query({
  args: {
    companyId: v.id("companies"),
    currency: v.union(v.literal("USD"), v.literal("EUR")),
  },
  handler: async (ctx, args) => {
    const balance = await ctx.db
      .query("companyBalances")
      .withIndex("by_companyId_and_currency", (q) =>
        q.eq("companyId", args.companyId).eq("currency", args.currency)
      )
      .unique();

    if (!balance) {
      return { availableCents: 0, totalCreditedCents: 0, totalDebitedCents: 0 };
    }

    return {
      availableCents: balance.totalCreditedCents - balance.totalDebitedCents,
      totalCreditedCents: balance.totalCreditedCents,
      totalDebitedCents: balance.totalDebitedCents,
    };
  },
});

export const getEntriesForCompany = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("balanceEntries")
      .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
      .order("desc")
      .take(100);
  },
});

export const credit = mutation({
  args: {
    companyId: v.id("companies"),
    amountCents: v.number(),
    currency: v.union(v.literal("USD"), v.literal("EUR")),
    reason: v.string(),
    relatedPaymentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("companyBalances")
      .withIndex("by_companyId_and_currency", (q) =>
        q.eq("companyId", args.companyId).eq("currency", args.currency)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        totalCreditedCents: existing.totalCreditedCents + args.amountCents,
      });
    } else {
      await ctx.db.insert("companyBalances", {
        companyId: args.companyId,
        totalCreditedCents: args.amountCents,
        totalDebitedCents: 0,
        currency: args.currency,
      });
    }

    await ctx.db.insert("balanceEntries", {
      companyId: args.companyId,
      type: "credit",
      amountCents: args.amountCents,
      currency: args.currency,
      reason: args.reason,
      relatedPaymentId: args.relatedPaymentId,
    });
  },
});

export const debit = mutation({
  args: {
    companyId: v.id("companies"),
    amountCents: v.number(),
    currency: v.union(v.literal("USD"), v.literal("EUR")),
    reason: v.string(),
    relatedPaymentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("companyBalances")
      .withIndex("by_companyId_and_currency", (q) =>
        q.eq("companyId", args.companyId).eq("currency", args.currency)
      )
      .unique();

    if (!existing) throw new Error("No balance record to debit");
    const available = existing.totalCreditedCents - existing.totalDebitedCents;
    if (args.amountCents > available) throw new Error("Insufficient balance");

    await ctx.db.patch(existing._id, {
      totalDebitedCents: existing.totalDebitedCents + args.amountCents,
    });

    await ctx.db.insert("balanceEntries", {
      companyId: args.companyId,
      type: "debit",
      amountCents: args.amountCents,
      currency: args.currency,
      reason: args.reason,
      relatedPaymentId: args.relatedPaymentId,
    });
  },
});
