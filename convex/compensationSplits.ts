import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ─── Queries ───

export const listByCompensationLine = query({
  args: { compensationLineId: v.id("compensationLines") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("compensationSplits")
      .withIndex("by_compensationLineId", (q) =>
        q.eq("compensationLineId", args.compensationLineId)
      )
      .take(20);
  },
});

export const listByEmployee = query({
  args: { employeeId: v.id("employees") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("compensationSplits")
      .withIndex("by_employeeId", (q) =>
        q.eq("employeeId", args.employeeId)
      )
      .take(100);
  },
});

// ─── Mutations ───

export const setSplits = mutation({
  args: {
    compensationLineId: v.id("compensationLines"),
    splits: v.array(
      v.object({
        walletAddress: v.string(),
        amountCents: v.number(),
        label: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const line = await ctx.db.get(args.compensationLineId);
    if (!line) throw new Error("Compensation line not found");

    // Validate splits sum to line total (empty array = clear all)
    if (args.splits.length > 0) {
      const sum = args.splits.reduce((s, x) => s + x.amountCents, 0);
      if (sum !== line.amountCents) {
        throw new Error(
          `Split amounts must equal the compensation line total (${line.amountCents} cents). Got ${sum} cents.`
        );
      }
      for (const split of args.splits) {
        if (split.amountCents <= 0) {
          throw new Error("Each split must have a positive amount");
        }
        if (!split.walletAddress.trim()) {
          throw new Error("Each split must have a wallet address");
        }
      }
    }

    // Delete existing splits for this line
    const existing = await ctx.db
      .query("compensationSplits")
      .withIndex("by_compensationLineId", (q) =>
        q.eq("compensationLineId", args.compensationLineId)
      )
      .take(20);
    for (const row of existing) {
      await ctx.db.delete(row._id);
    }

    // Insert new splits
    for (const split of args.splits) {
      await ctx.db.insert("compensationSplits", {
        compensationLineId: args.compensationLineId,
        employeeId: line.employeeId,
        walletAddress: split.walletAddress.trim(),
        amountCents: split.amountCents,
        label: split.label?.trim() || undefined,
      });
    }
  },
});
