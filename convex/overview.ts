import { query } from "./_generated/server";
import { v } from "convex/values";

export const stats = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const balance = await ctx.db
      .query("companyBalances")
      .withIndex("by_companyId_and_currency", (q) =>
        q.eq("companyId", args.companyId).eq("currency", "USD")
      )
      .unique();

    const employees = await ctx.db
      .query("employees")
      .withIndex("by_companyId_and_status", (q) =>
        q.eq("companyId", args.companyId).eq("status", "active")
      )
      .take(200);

    const pendingPayroll = await ctx.db
      .query("employeePayments")
      .withIndex("by_companyId_and_status", (q) =>
        q.eq("companyId", args.companyId).eq("status", "draft")
      )
      .take(200);

    const approvedPayroll = await ctx.db
      .query("employeePayments")
      .withIndex("by_companyId_and_status", (q) =>
        q.eq("companyId", args.companyId).eq("status", "approved")
      )
      .take(200);

    const pendingReceivables = await ctx.db
      .query("customerPayments")
      .withIndex("by_companyId_and_status", (q) =>
        q.eq("companyId", args.companyId).eq("status", "pending")
      )
      .take(200);

    const sentReceivables = await ctx.db
      .query("customerPayments")
      .withIndex("by_companyId_and_status", (q) =>
        q.eq("companyId", args.companyId).eq("status", "sent")
      )
      .take(200);

    const paidToday = await ctx.db
      .query("customerPayments")
      .withIndex("by_companyId_and_status", (q) =>
        q.eq("companyId", args.companyId).eq("status", "paid")
      )
      .take(200);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayMs = todayStart.getTime();

    let payrollDueCents = 0;
    const duePayments = [...pendingPayroll, ...approvedPayroll];
    for (const p of duePayments) {
      payrollDueCents += p.amountCents;
    }

    let receivablesCents = 0;
    const allReceivables = [...pendingReceivables, ...sentReceivables];
    for (const r of allReceivables) {
      receivablesCents += r.amountCents;
    }

    let usageRevenueTodayCents = 0;
    for (const p of paidToday) {
      if (p.paidAt && p.paidAt >= todayMs) {
        usageRevenueTodayCents += p.amountCents;
      }
    }

    return {
      treasuryAvailableCents: balance
        ? balance.totalCreditedCents - balance.totalDebitedCents
        : 0,
      payrollDueCents,
      payrollDueCount: duePayments.length,
      receivablesCents,
      receivablesCount: allReceivables.length,
      usageRevenueTodayCents,
      activeEmployees: employees.length,
    };
  },
});
