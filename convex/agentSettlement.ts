import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const initiate = mutation({
  args: {
    companyId: v.id("companies"),
    fromCustomerId: v.id("customers"),
    toCustomerId: v.id("customers"),
    amountMicroCents: v.number(),
    currency: v.union(v.literal("USD"), v.literal("EUR")),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.amountMicroCents <= 0) {
      throw new Error("Amount must be positive");
    }

    const fromCustomer = await ctx.db.get(args.fromCustomerId);
    if (!fromCustomer || fromCustomer.companyId !== args.companyId) {
      throw new Error("Source customer not found or does not belong to this company");
    }

    const toCustomer = await ctx.db.get(args.toCustomerId);
    if (!toCustomer || toCustomer.companyId !== args.companyId) {
      throw new Error("Destination customer not found or does not belong to this company");
    }

    const id = await ctx.db.insert("agentSettlements", {
      companyId: args.companyId,
      fromCustomerId: args.fromCustomerId,
      toCustomerId: args.toCustomerId,
      amountMicroCents: args.amountMicroCents,
      currency: args.currency,
      status: "initiated",
      reason: args.reason,
      initiatedAt: Date.now(),
    });

    return { id };
  },
});

export const confirm = mutation({
  args: {
    id: v.id("agentSettlements"),
    txHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const settlement = await ctx.db.get(args.id);
    if (!settlement) throw new Error("Settlement not found");
    if (settlement.status !== "initiated") {
      throw new Error("Settlement must be in 'initiated' status to confirm");
    }

    await ctx.db.patch(args.id, {
      status: "confirmed",
      confirmedAt: Date.now(),
      txHash: args.txHash,
    });
  },
});

export const dispute = mutation({
  args: {
    id: v.id("agentSettlements"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const settlement = await ctx.db.get(args.id);
    if (!settlement) throw new Error("Settlement not found");
    if (settlement.status !== "initiated" && settlement.status !== "confirmed") {
      throw new Error("Settlement must be in 'initiated' or 'confirmed' status to dispute");
    }

    await ctx.db.patch(args.id, {
      status: "disputed",
      reason: args.reason,
    });
  },
});

export const resolve = mutation({
  args: { id: v.id("agentSettlements") },
  handler: async (ctx, args) => {
    const settlement = await ctx.db.get(args.id);
    if (!settlement) throw new Error("Settlement not found");
    if (settlement.status !== "disputed") {
      throw new Error("Settlement must be in 'disputed' status to resolve");
    }

    await ctx.db.patch(args.id, { status: "resolved" });
  },
});

export const listByCompany = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentSettlements")
      .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
      .order("desc")
      .take(100);
  },
});
