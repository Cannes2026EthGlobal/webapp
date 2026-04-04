import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Clears seeded balance entries and resets the balance for a company
 * owned by the given wallet. One-time cleanup utility.
 */
export const clearBalanceData = mutation({
  args: { wallet: v.string() },
  handler: async (ctx, args) => {
    const companies = await ctx.db
      .query("companies")
      .withIndex("by_ownerWallet", (q) => q.eq("ownerWallet", args.wallet))
      .take(10);

    let entriesDeleted = 0;
    let balancesReset = 0;

    for (const company of companies) {
      // Delete all balance entries
      const entries = await ctx.db
        .query("balanceEntries")
        .withIndex("by_companyId", (q) => q.eq("companyId", company._id))
        .take(500);
      for (const entry of entries) {
        await ctx.db.delete(entry._id);
        entriesDeleted++;
      }

      // Reset balance totals to zero
      const balances = await ctx.db
        .query("companyBalances")
        .withIndex("by_companyId", (q) => q.eq("companyId", company._id))
        .take(10);
      for (const bal of balances) {
        await ctx.db.patch(bal._id, {
          totalCreditedCents: 0,
          totalDebitedCents: 0,
        });
        balancesReset++;
      }
    }

    return { companiesFound: companies.length, entriesDeleted, balancesReset };
  },
});
