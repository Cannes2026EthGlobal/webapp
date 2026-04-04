import { cronJobs } from "convex/server";
import { internalAction, internalQuery, internalMutation } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";

// ═══════════════════════════════════════════════════════════════════════
// ADVANCE THRESHOLD CHECK
// ═══════════════════════════════════════════════════════════════════════

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
        total += e.payoutAmountCents ?? 0;
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

// ═══════════════════════════════════════════════════════════════════════
// WC PAY PAYMENT SYNC
// ═══════════════════════════════════════════════════════════════════════

const WC_PAY_API_URL = process.env.WC_PAY_API_URL ?? "https://api.pay.walletconnect.com";
const WC_PAY_API_KEY = process.env.WC_PAY_API_KEY ?? "";
const WC_PAY_MERCHANT_ID = process.env.WC_PAY_MERCHANT_ID ?? "";
const IS_MOCK = process.env.WC_PAY_MOCK === "true";

export const getPendingWcPayments = internalQuery({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db
      .query("customerPayments")
      .take(200);
    return all.filter(
      (p) => p.status === "pending" && p.wcPayPaymentId
    );
  },
});

export const syncWcPayStatuses = internalAction({
  args: {},
  handler: async (ctx): Promise<void> => {
    if (IS_MOCK) return;

    const pending: Array<{ _id: any; wcPayPaymentId?: string }> =
      await ctx.runQuery(internal.crons.getPendingWcPayments, {});

    for (const payment of pending) {
      if (!payment.wcPayPaymentId) continue;

      try {
        const res = await fetch(
          `${WC_PAY_API_URL}/v1/merchants/payment/${payment.wcPayPaymentId}/status`,
          {
            headers: {
              "Api-Key": WC_PAY_API_KEY,
              "Merchant-Id": WC_PAY_MERCHANT_ID,
              "Content-Type": "application/json",
            },
          }
        );

        if (!res.ok) continue;

        const data = (await res.json()) as {
          status: string;
          isFinal: boolean;
        };

        if (data.status === "succeeded") {
          await ctx.runMutation(api.checkout.confirmPayment, {
            paymentId: payment._id,
          });
        } else if (
          data.isFinal &&
          (data.status === "failed" || data.status === "expired")
        ) {
          await ctx.runMutation(api.customerPayments.updateStatus, {
            id: payment._id,
            status: "cancelled",
          });
        }
      } catch {
        // Skip failures, retry next cycle
      }
    }
  },
});

// ═══════════════════════════════════════════════════════════════════════
// CRON SCHEDULE
// ═══════════════════════════════════════════════════════════════════════

const crons = cronJobs();

crons.interval(
  "check advance thresholds",
  { hours: 1 },
  internal.crons.checkAdvanceThresholds,
  {}
);

crons.interval(
  "sync wcpay payment statuses",
  { minutes: 2 },
  internal.crons.syncWcPayStatuses,
  {}
);

export default crons;
