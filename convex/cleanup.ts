import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Clears ALL seeded data for companies owned by the given wallet.
 * Deletes: balance entries, balances, employee payments, customer payments,
 * compensation lines, employees, customers, products, checkout links,
 * advance requests, advance settings.
 */
export const clearAllData = mutation({
  args: { wallet: v.string() },
  handler: async (ctx, args) => {
    const companies = await ctx.db
      .query("companies")
      .withIndex("by_ownerWallet", (q) => q.eq("ownerWallet", args.wallet))
      .take(10);

    let deleted = 0;

    for (const company of companies) {
      const tables = [
        "balanceEntries",
        "companyBalances",
        "employeePayments",
        "customerPayments",
        "compensationLines",
        "advanceRequests",
        "advanceSettings",
        "checkoutLinks",
      ] as const;

      for (const table of tables) {
        const docs = await ctx.db
          .query(table)
          .withIndex("by_companyId", (q) => q.eq("companyId", company._id))
          .take(500);
        for (const doc of docs) {
          await ctx.db.delete(doc._id);
          deleted++;
        }
      }

      // Employees and customers
      const employees = await ctx.db
        .query("employees")
        .withIndex("by_companyId", (q) => q.eq("companyId", company._id))
        .take(200);
      for (const e of employees) {
        await ctx.db.delete(e._id);
        deleted++;
      }

      const customers = await ctx.db
        .query("customers")
        .withIndex("by_companyId", (q) => q.eq("companyId", company._id))
        .take(200);
      for (const c of customers) {
        await ctx.db.delete(c._id);
        deleted++;
      }

      const products = await ctx.db
        .query("products")
        .withIndex("by_companyId", (q) => q.eq("companyId", company._id))
        .take(200);
      for (const p of products) {
        await ctx.db.delete(p._id);
        deleted++;
      }
    }

    return { companiesFound: companies.length, deleted };
  },
});
