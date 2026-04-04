import { query } from "./_generated/server";
import { v } from "convex/values";

export const upcoming = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const employees = await ctx.db
      .query("employees")
      .withIndex("by_companyId_and_status", (q) =>
        q.eq("companyId", args.companyId).eq("status", "active")
      )
      .take(200);

    const now = Date.now();
    const months: Array<{
      month: string;
      totalSalaryCents: number;
      employeeCount: number;
      entries: Array<{
        employeeId: string;
        displayName: string;
        role: string;
        payoutAmountCents: number;
        frequency: string;
        hasActiveCredit: boolean;
        creditDeductionCents: number;
        netPayoutCents: number;
      }>;
    }> = [];

    for (let i = 0; i < 3; i++) {
      const date = new Date(now);
      date.setMonth(date.getMonth() + i);
      const monthLabel = date.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });

      let totalSalaryCents = 0;
      const entries = [];

      for (const emp of employees) {
        // Resolve compensation: prefer active compensationLines, fall back to flat payoutAmountCents
        const activeLines = await ctx.db
          .query("compensationLines")
          .withIndex("by_employeeId_and_isActive", (q) =>
            q.eq("employeeId", emp._id).eq("isActive", true)
          )
          .take(20);

        const lineTotal = activeLines.reduce((sum, l) => sum + l.amountCents, 0);
        const empPayoutCents = lineTotal > 0 ? lineTotal : (emp.payoutAmountCents ?? 0);

        // Skip employees with no compensation configured at all
        if (empPayoutCents === 0) continue;

        // Only include salary-type employees (skip per-task / freelance-only)
        const hasNoCompLines = activeLines.length === 0;
        const isFlatNonSalary =
          hasNoCompLines &&
          emp.compensationModel != null &&
          emp.compensationModel !== "salary" &&
          emp.compensationModel !== "hourly";
        if (isFlatNonSalary) continue;

        const advances = await ctx.db
          .query("creditRequests")
          .withIndex("by_employeeId_and_status", (q) =>
            q.eq("employeeId", emp._id).eq("status", "settled")
          )
          .take(1);

        const hasActiveCredit = advances.length > 0;
        const creditDeductionCents = hasActiveCredit
          ? advances[0].requestedAmountCents
          : 0;
        const netPayoutCents = empPayoutCents - creditDeductionCents;

        totalSalaryCents += netPayoutCents;

        entries.push({
          employeeId: emp._id,
          displayName: emp.displayName,
          role: emp.role,
          payoutAmountCents: empPayoutCents,
          frequency: emp.payoutFrequency ?? "monthly",
          hasActiveCredit,
          creditDeductionCents,
          netPayoutCents,
        });
      }

      months.push({
        month: monthLabel,
        totalSalaryCents,
        employeeCount: entries.length,
        entries,
      });
    }

    return months;
  },
});

export const advanceSummary = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const pending = await ctx.db
      .query("creditRequests")
      .withIndex("by_companyId_and_status", (q) =>
        q.eq("companyId", args.companyId).eq("status", "pending")
      )
      .take(50);

    const settled = await ctx.db
      .query("creditRequests")
      .withIndex("by_companyId_and_status", (q) =>
        q.eq("companyId", args.companyId).eq("status", "settled")
      )
      .take(50);

    let pendingTotalCents = 0;
    for (const r of pending) pendingTotalCents += r.netAmountCents;

    let outstandingTotalCents = 0;
    for (const r of settled) outstandingTotalCents += r.requestedAmountCents;

    let totalInterestEarnedCents = 0;
    const all = await ctx.db
      .query("creditRequests")
      .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
      .take(200);
    for (const r of all) {
      if (r.status === "approved" || r.status === "settled" || r.status === "deducted") {
        totalInterestEarnedCents += r.interestAmountCents;
      }
    }

    return {
      pendingCount: pending.length,
      pendingTotalCents,
      outstandingCount: settled.length,
      outstandingTotalCents,
      totalInterestEarnedCents,
    };
  },
});
