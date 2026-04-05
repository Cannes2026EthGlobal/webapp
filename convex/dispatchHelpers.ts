import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const getUndispatchedPayments = internalQuery({
  args: {},
  handler: async (ctx) => {
    const allPaid = await ctx.db.query("customerPayments").take(500);
    return allPaid.filter((p) => p.status === "paid" && !p.dispatched);
  },
});

export const markDispatched = internalMutation({
  args: { paymentIds: v.array(v.id("customerPayments")) },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const id of args.paymentIds) {
      await ctx.db.patch(id, { dispatched: true, dispatchedAt: now });
    }
  },
});

export const createDispatchRecord = internalMutation({
  args: {
    companyId: v.id("companies"),
    destinationAddress: v.string(),
    amountCents: v.number(),
    chain: v.string(),
    paymentIds: v.array(v.id("customerPayments")),
    txHash: v.optional(v.string()),
    status: v.union(v.literal("sent"), v.literal("failed")),
    errorMessage: v.optional(v.string()),
    isReferral: v.optional(v.boolean()),
    referralName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("dispatchRecords", {
      ...args,
      currency: "USD",
    });
  },
});

export const getCompany = internalQuery({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => await ctx.db.get(args.companyId),
});

export const getCheckoutLink = internalQuery({
  args: { linkId: v.id("checkoutLinks") },
  handler: async (ctx, args) => await ctx.db.get(args.linkId),
});

export const listRecent = internalQuery({
  args: {},
  handler: async (ctx) => await ctx.db.query("dispatchRecords").order("desc").take(50),
});
