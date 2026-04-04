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
      // Delete from each table individually (can't use generic loop with Convex types)
      for (const doc of await ctx.db.query("balanceEntries").withIndex("by_companyId", (q) => q.eq("companyId", company._id)).take(500)) { await ctx.db.delete(doc._id); deleted++; }
      for (const doc of await ctx.db.query("companyBalances").withIndex("by_companyId", (q) => q.eq("companyId", company._id)).take(500)) { await ctx.db.delete(doc._id); deleted++; }
      for (const doc of await ctx.db.query("employeePayments").withIndex("by_companyId", (q) => q.eq("companyId", company._id)).take(500)) { await ctx.db.delete(doc._id); deleted++; }
      for (const doc of await ctx.db.query("customerPayments").withIndex("by_companyId", (q) => q.eq("companyId", company._id)).take(500)) { await ctx.db.delete(doc._id); deleted++; }
      for (const doc of await ctx.db.query("compensationLines").withIndex("by_companyId", (q) => q.eq("companyId", company._id)).take(500)) { await ctx.db.delete(doc._id); deleted++; }
      for (const doc of await ctx.db.query("compensationSplits").withIndex("by_companyId", (q) => q.eq("companyId", company._id)).take(500)) { await ctx.db.delete(doc._id); deleted++; }
      for (const doc of await ctx.db.query("creditRequests").withIndex("by_companyId", (q) => q.eq("companyId", company._id)).take(500)) { await ctx.db.delete(doc._id); deleted++; }
      for (const doc of await ctx.db.query("creditSettings").withIndex("by_companyId", (q) => q.eq("companyId", company._id)).take(500)) { await ctx.db.delete(doc._id); deleted++; }
      for (const doc of await ctx.db.query("checkoutLinks").withIndex("by_companyId", (q) => q.eq("companyId", company._id)).take(500)) { await ctx.db.delete(doc._id); deleted++; }
      for (const doc of await ctx.db.query("usageTabs").withIndex("by_companyId", (q) => q.eq("companyId", company._id)).take(500)) { await ctx.db.delete(doc._id); deleted++; }
      for (const doc of await ctx.db.query("employees").withIndex("by_companyId", (q) => q.eq("companyId", company._id)).take(200)) { await ctx.db.delete(doc._id); deleted++; }
      for (const doc of await ctx.db.query("customers").withIndex("by_companyId", (q) => q.eq("companyId", company._id)).take(200)) { await ctx.db.delete(doc._id); deleted++; }
      for (const doc of await ctx.db.query("products").withIndex("by_companyId", (q) => q.eq("companyId", company._id)).take(200)) { await ctx.db.delete(doc._id); deleted++; }
    }

    return { companiesFound: companies.length, deleted };
  },
});
