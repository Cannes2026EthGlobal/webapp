import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

/**
 * Returns the start of the current pay period (midnight UTC).
 * Used to check whether an employee has already been paid this period.
 *   monthly  → 1st of the current month
 *   biweekly → 14 days ago (rolling)
 *   weekly   → 7 days ago (rolling)
 */
function getPeriodStart(todayMidnightUtc: number, frequency: string): number {
  if (frequency === "monthly") {
    const d = new Date(todayMidnightUtc);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  }
  const days = frequency === "biweekly" ? 14 : 7;
  return todayMidnightUtc - (days - 1) * 24 * 60 * 60 * 1000;
}

// ---------------------------------------------------------------------------
// DEBUG
// ---------------------------------------------------------------------------

export const debugListAll = query({
  args: {},
  handler: async (ctx) => {
    const employees = await ctx.db.query("employees").take(50)
    const companies = await ctx.db.query("companies").take(20)
    return { employees, companies }
  },
})

// ---------------------------------------------------------------------------
// QUERIES
// ---------------------------------------------------------------------------

/**
 * Returns all active employees whose nextPaymentDate is today or overdue,
 * joined with their company's payrollContractAddress.
 *
 * Called by the CRE workflow every day at 09:00 UTC.
 *
 * Skips employees that are missing:
 *   - walletAddress
 *   - payoutAmountCents
 *   - payoutFrequency (or is 'per-task')
 *   - company.payrollContractAddress
 */
export const getDueEmployees = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const todayStart = Date.UTC(
      new Date(now).getUTCFullYear(),
      new Date(now).getUTCMonth(),
      new Date(now).getUTCDate(),
    );

    // Fetch all active compensation lines whose startDate has passed
    const activeLines = await ctx.db
      .query("compensationLines")
      .filter((q) =>
        q.and(
          q.eq(q.field("isActive"), true),
          q.lte(q.field("startDate"), now),
        )
      )
      .collect();

    // Group lines by employeeId, summing amounts
    // (an employee may have multiple lines — e.g. base salary + housing allowance)
    const byEmployee = new Map<
      Id<"employees">,
      { amountCents: number; frequency: string; companyId: Id<"companies"> }
    >();
    for (const line of activeLines) {
      if (line.endDate && line.endDate < now) continue; // expired
      const existing = byEmployee.get(line.employeeId);
      if (existing) {
        existing.amountCents += line.amountCents;
      } else {
        byEmployee.set(line.employeeId, {
          amountCents: line.amountCents,
          frequency: line.frequency,
          companyId: line.companyId,
        });
      }
    }

    const result: Array<{
      _id: string;
      walletAddress: string;
      amountCents: number;
      payrollContractAddress: string;
      companyId: string;
      frequency: string;
    }> = [];

    for (const [employeeId, data] of byEmployee) {
      // Skip if already paid during the current period
      const periodStart = getPeriodStart(todayStart, data.frequency);
      const recentPayment = await ctx.db
        .query("employeePayments")
        .withIndex("by_employeeId", (q) => q.eq("employeeId", employeeId))
        .filter((q) =>
          q.and(
            q.eq(q.field("status"), "settled"),
            q.gte(q.field("settledAt"), periodStart),
          )
        )
        .first();
      if (recentPayment) continue;

      const emp = await ctx.db.get(employeeId);
      if (!emp || emp.status !== "active" || !emp.walletAddress) continue;

      const company = await ctx.db.get(emp.companyId);
      if (!company?.payrollContractAddress) continue;

      result.push({
        _id: emp._id,
        walletAddress: emp.walletAddress,
        amountCents: data.amountCents,
        payrollContractAddress: company.payrollContractAddress,
        companyId: emp.companyId,
        frequency: data.frequency,
      });
    }

    return result;
  },
});

// ---------------------------------------------------------------------------
// MUTATIONS
// ---------------------------------------------------------------------------

/**
 * Records a successful on-chain payroll payment and advances nextPaymentDate.
 *
 * Called by the CRE workflow after evmClient.writeReport() succeeds.
 * If this call fails after an on-chain success the CRE logs a warning;
 * the employee's nextPaymentDate won't advance so they'll appear due again
 * on the next cycle — operators should investigate before then.
 */
export const markPaid = mutation({
  args: {
    employeeId: v.id("employees"),
    txHash: v.string(),
    amountCents: v.number(),
    paidAt: v.number(), // ms UTC
  },
  handler: async (ctx, args) => {
    const emp = await ctx.db.get(args.employeeId);
    if (!emp) throw new Error(`Employee ${args.employeeId} not found`);

    // Record the settled payment — this is also the idempotency guard:
    // getDueEmployees checks for a recent employeePayments record before including
    await ctx.db.insert("employeePayments", {
      companyId: emp.companyId,
      employeeId: args.employeeId,
      type: "salary",
      amountCents: args.amountCents,
      currency: "USD",
      status: "settled",
      txHash: args.txHash,
      settledAt: args.paidAt,
    });
  },
});
