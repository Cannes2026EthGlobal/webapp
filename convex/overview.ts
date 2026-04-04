import { query } from "./_generated/server";
import { v } from "convex/values";

export const settlementChart = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("balanceEntries")
      .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
      .order("desc")
      .take(500);

    // Group by date (use occurredAt if set, otherwise _creationTime)
    const byDate = new Map<string, { inbound: number; outbound: number }>();

    for (const entry of entries) {
      const ts = entry.occurredAt ?? entry._creationTime;
      const date = new Date(ts).toISOString().slice(0, 10);
      const existing = byDate.get(date) ?? { inbound: 0, outbound: 0 };
      if (entry.type === "credit") {
        existing.inbound += entry.amountCents;
      } else {
        existing.outbound += entry.amountCents;
      }
      byDate.set(date, existing);
    }

    // Convert to sorted array (ascending date)
    return Array.from(byDate.entries())
      .map(([date, data]) => ({
        date,
        inbound: data.inbound,
        outbound: data.outbound,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  },
});

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
    let totalCollectedCents = 0;
    for (const p of paidToday) {
      totalCollectedCents += p.amountCents;
      if (p.paidAt && p.paidAt >= todayMs) {
        usageRevenueTodayCents += p.amountCents;
      }
    }

    // Settled payroll total
    const settledPayroll = await ctx.db
      .query("employeePayments")
      .withIndex("by_companyId_and_status", (q) =>
        q.eq("companyId", args.companyId).eq("status", "settled")
      )
      .take(200);
    let totalPaidOutCents = 0;
    for (const p of settledPayroll) {
      totalPaidOutCents += p.amountCents;
    }

    // Overdue receivables
    const overdueReceivables = await ctx.db
      .query("customerPayments")
      .withIndex("by_companyId_and_status", (q) =>
        q.eq("companyId", args.companyId).eq("status", "overdue")
      )
      .take(200);
    let overdueCents = 0;
    for (const r of overdueReceivables) {
      overdueCents += r.amountCents;
    }

    // Active customers count
    const activeCustomers = await ctx.db
      .query("customers")
      .withIndex("by_companyId_and_billingState", (q) =>
        q.eq("companyId", args.companyId).eq("billingState", "active")
      )
      .take(200);

    // Active products count
    const activeProducts = await ctx.db
      .query("products")
      .withIndex("by_companyId_and_isActive", (q) =>
        q.eq("companyId", args.companyId).eq("isActive", true)
      )
      .take(200);

    // Pending advance requests
    const pendingAdvances = await ctx.db
      .query("advanceRequests")
      .withIndex("by_companyId_and_status", (q) =>
        q.eq("companyId", args.companyId).eq("status", "pending")
      )
      .take(50);

    return {
      treasuryAvailableCents: balance
        ? balance.totalCreditedCents - balance.totalDebitedCents
        : 0,
      totalCreditedCents: balance?.totalCreditedCents ?? 0,
      totalDebitedCents: balance?.totalDebitedCents ?? 0,
      payrollDueCents,
      payrollDueCount: duePayments.length,
      receivablesCents,
      receivablesCount: allReceivables.length,
      usageRevenueTodayCents,
      totalCollectedCents,
      totalPaidOutCents,
      overdueCents,
      overdueCount: overdueReceivables.length,
      activeEmployees: employees.length,
      activeCustomers: activeCustomers.length,
      activeProducts: activeProducts.length,
      pendingAdvances: pendingAdvances.length,
    };
  },
});
