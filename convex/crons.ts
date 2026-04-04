import { cronJobs } from "convex/server";
import { internalAction, internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// ─── Internal helpers (called by the action) ───

export const listAllCompanies = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("companies").take(100);
  },
});

export const getAdvanceSettingsInternal = internalQuery({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("advanceSettings")
      .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
      .unique();
  },
});

export const getBalanceInternal = internalQuery({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const balance = await ctx.db
      .query("companyBalances")
      .withIndex("by_companyId_and_currency", (q) =>
        q.eq("companyId", args.companyId).eq("currency", "USD")
      )
      .unique();
    return {
      availableCents: balance
        ? balance.totalCreditedCents - balance.totalDebitedCents
        : 0,
    };
  },
});

export const getMonthlyPayrollInternal = internalQuery({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const employees = await ctx.db
      .query("employees")
      .withIndex("by_companyId_and_status", (q) =>
        q.eq("companyId", args.companyId).eq("status", "active")
      )
      .take(200);
    let total = 0;
    for (const e of employees) {
      if (e.compensationModel === "salary") {
        total += e.payoutAmountCents;
      }
    }
    return total;
  },
});

export const setAutoDisabledInternal = internalMutation({
  args: {
    companyId: v.id("companies"),
    autoDisabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("advanceSettings")
      .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { autoDisabled: args.autoDisabled });
    }
  },
});

// ─── Main cron action ───

export const checkAdvanceThresholds = internalAction({
  args: {},
  handler: async (ctx) => {
    const companies = await ctx.runQuery(internal.crons.listAllCompanies, {});

    for (const company of companies) {
      const settings = await ctx.runQuery(
        internal.crons.getAdvanceSettingsInternal,
        { companyId: company._id }
      );
      if (!settings) continue;

      const balance = await ctx.runQuery(internal.crons.getBalanceInternal, {
        companyId: company._id,
      });

      const monthlyPayroll = await ctx.runQuery(
        internal.crons.getMonthlyPayrollInternal,
        { companyId: company._id }
      );

      const thresholdCents =
        monthlyPayroll * settings.autoDisableThresholdMonths;
      const shouldDisable = balance.availableCents < thresholdCents;

      if (shouldDisable !== settings.autoDisabled) {
        await ctx.runMutation(internal.crons.setAutoDisabledInternal, {
          companyId: company._id,
          autoDisabled: shouldDisable,
        });
      }
    }
  },
});

// ─── Cron schedule ───

const crons = cronJobs();

crons.interval(
  "check advance thresholds",
  { hours: 1 },
  internal.crons.checkAdvanceThresholds,
  {}
);

export default crons;
