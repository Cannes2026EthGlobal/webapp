import { action, internalQuery } from "./_generated/server";
import { internal, api } from "./_generated/api";

const WC_PAY_API_URL = process.env.WC_PAY_API_URL ?? "https://api.pay.walletconnect.com";
const WC_PAY_API_KEY = process.env.WC_PAY_API_KEY ?? "";
const WC_PAY_MERCHANT_ID = process.env.WC_PAY_MERCHANT_ID ?? "";
const IS_MOCK = process.env.WC_PAY_MOCK === "true";

/**
 * Returns all customerPayments that have a wcPayPaymentId but are still pending.
 * These need their status checked against WC Pay.
 */
export const getPendingWcPayments = internalQuery({
  args: {},
  handler: async (ctx) => {
    const pending = await ctx.db
      .query("customerPayments")
      .withIndex("by_companyId_and_status")
      .take(200);
    return pending.filter(
      (p) => p.status === "pending" && p.wcPayPaymentId
    );
  },
});

/**
 * Polls WC Pay for each pending payment and marks them as paid/cancelled
 * when the status is final. Calls checkout.confirmPayment which handles
 * treasury crediting and customer auto-registration.
 *
 * Runs every 2 minutes via cron. Skips in mock mode (mock payments
 * auto-succeed immediately in the checkout flow).
 */
export const syncPaymentStatuses = action({
  args: {},
  handler: async (ctx) => {
    if (IS_MOCK) {
      return { synced: 0, message: "Mock mode — skipping sync" };
    }

    const pending = await ctx.runQuery(
      internal.wcpaySync.getPendingWcPayments,
      {}
    );

    let synced = 0;
    let failed = 0;

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
          synced++;
        } else if (
          data.isFinal &&
          (data.status === "failed" || data.status === "expired")
        ) {
          await ctx.runMutation(api.customerPayments.updateStatus, {
            id: payment._id,
            status: "cancelled",
          });
          failed++;
        }
      } catch {
        // Skip individual failures, retry next cycle
      }
    }

    return { synced, failed, pending: pending.length };
  },
});
