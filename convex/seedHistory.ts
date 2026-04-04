import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Seeds ~30 days of historical balance entries for realistic chart data.
 * Run once per company after initial seed.
 */
export const seedSettlementHistory = mutation({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    // Check if history already seeded (more than 5 entries = already done)
    const existing = await ctx.db
      .query("balanceEntries")
      .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
      .take(10);
    if (existing.length > 6) return { seeded: false, message: "History already exists" };

    const day = 86400000;
    // April 4, 2026 at noon UTC
    const today = new Date("2026-04-04T12:00:00Z").getTime();

    // Generate 30 days of realistic settlement data
    const entries: Array<{
      type: "credit" | "debit";
      amountCents: number;
      reason: string;
      occurredAt: number;
    }> = [];

    const customerNames = [
      "Northwind Labs",
      "Synthex AI",
      "AutoAgent-7",
      "Meridian Events",
      "Helios Protocol",
      "Quantum Mesh",
    ];
    const employeeNames = [
      "Elena Vasquez",
      "Marcus Chen",
      "Aria Nakamura",
      "James Whitfield",
      "Sofia Reyes",
      "Kai Tanaka",
    ];

    // Seed from 30 days ago to yesterday
    for (let daysAgo = 30; daysAgo >= 1; daysAgo--) {
      const ts = today - daysAgo * day;

      // Inbound: 1-3 customer payments per day
      const inboundCount = 1 + Math.floor(seededRandom(daysAgo * 7) * 3);
      for (let i = 0; i < inboundCount; i++) {
        const customer =
          customerNames[
            Math.floor(seededRandom(daysAgo * 13 + i * 3) * customerNames.length)
          ];
        // Amounts between $200 and $15,000
        const amount =
          20000 +
          Math.floor(seededRandom(daysAgo * 17 + i * 11) * 1480000);
        entries.push({
          type: "credit",
          amountCents: amount,
          reason: `Payment: ${customer} — ${pickReason(daysAgo + i)}`,
          occurredAt: ts + Math.floor(seededRandom(daysAgo + i) * day * 0.8),
        });
      }

      // Outbound: 0-2 payroll/settlement per day
      const outboundCount = Math.floor(seededRandom(daysAgo * 23) * 2.5);
      for (let i = 0; i < outboundCount; i++) {
        const employee =
          employeeNames[
            Math.floor(
              seededRandom(daysAgo * 29 + i * 7) * employeeNames.length
            )
          ];
        // Amounts between $500 and $12,000
        const amount =
          50000 +
          Math.floor(seededRandom(daysAgo * 31 + i * 19) * 1150000);
        entries.push({
          type: "debit",
          amountCents: amount,
          reason: `Payroll: ${employee} — ${pickPayrollReason(daysAgo + i)}`,
          occurredAt:
            ts + Math.floor(seededRandom(daysAgo * 37 + i) * day * 0.8),
        });
      }
    }

    // Insert all entries
    for (const entry of entries) {
      await ctx.db.insert("balanceEntries", {
        companyId: args.companyId,
        type: entry.type,
        amountCents: entry.amountCents,
        currency: "USD",
        reason: entry.reason,
        occurredAt: entry.occurredAt,
      });
    }

    // Update the running balance to reflect history
    const balance = await ctx.db
      .query("companyBalances")
      .withIndex("by_companyId_and_currency", (q) =>
        q.eq("companyId", args.companyId).eq("currency", "USD")
      )
      .unique();

    let totalCredits = 0;
    let totalDebits = 0;
    for (const e of entries) {
      if (e.type === "credit") totalCredits += e.amountCents;
      else totalDebits += e.amountCents;
    }

    if (balance) {
      await ctx.db.patch(balance._id, {
        totalCreditedCents: balance.totalCreditedCents + totalCredits,
        totalDebitedCents: balance.totalDebitedCents + totalDebits,
      });
    }

    return {
      seeded: true,
      entriesCreated: entries.length,
      totalCredits: totalCredits / 100,
      totalDebits: totalDebits / 100,
    };
  },
});

// Deterministic pseudo-random for reproducible seeds
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

function pickReason(seed: number): string {
  const reasons = [
    "API usage billing",
    "Enterprise license",
    "Checkout payment",
    "Usage metering settlement",
    "Invoice payment",
    "Subscription renewal",
    "Compute credits",
    "Event ticket purchase",
  ];
  return reasons[Math.floor(seededRandom(seed * 41) * reasons.length)];
}

function pickPayrollReason(seed: number): string {
  const reasons = [
    "Monthly salary",
    "Biweekly payout",
    "Contract payment",
    "Freelance invoice",
    "Performance bonus",
    "Reimbursement",
  ];
  return reasons[Math.floor(seededRandom(seed * 53) * reasons.length)];
}
