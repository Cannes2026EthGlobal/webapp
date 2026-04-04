import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const clearAllData = mutation({
  args: { wallet: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_walletAddress", (q) => q.eq("walletAddress", args.wallet))
      .unique();
    if (!user) return { companiesFound: 0, deleted: 0 };

    const companies = await ctx.db
      .query("companies")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .take(10);

    let deleted = 0;

    for (const company of companies) {
      for (const table of [
        "balanceEntries",
        "companyBalances",
        "employeePayments",
        "customerPayments",
        "compensationLines",
        "compensationSplits",
        "creditRequests",
        "creditSettings",
        "checkoutLinks",
        "usageTabs",
      ] as const) {
        const docs = await ctx.db
          .query(table)
          .withIndex("by_companyId", (q) => q.eq("companyId", company._id))
          .take(500);
        for (const doc of docs) {
          await ctx.db.delete(doc._id);
          deleted++;
        }
      }

      for (const table of ["employees", "customers", "products"] as const) {
        const docs = await ctx.db
          .query(table)
          .withIndex("by_companyId", (q) => q.eq("companyId", company._id))
          .take(200);
        for (const doc of docs) {
          await ctx.db.delete(doc._id);
          deleted++;
        }
      }
    }

    return { companiesFound: companies.length, deleted };
  },
});
