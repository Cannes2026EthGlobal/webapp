import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { creditBalance } from "./balances";
import { findOrCreateCustomerByWallet } from "./customers";

/** Generate a short referenceId that fits WC Pay's 35-char limit. */
function shortRef(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "arc-";
  for (let i = 0; i < 16; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id; // 20 chars total, well under 35
}

/**
 * Initiate a checkout for a per-unit product via checkout link slug.
 * Creates a customer payment record and returns info needed for WC Pay.
 */
export const initiateCheckout = mutation({
  args: {
    slug: v.string(),
    quantity: v.optional(v.number()),
    buyerWallet: v.optional(v.string()),
    buyerFullName: v.optional(v.string()),
    buyerEmail: v.optional(v.string()),
    buyerCountry: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{
    paymentId: Id<"customerPayments">;
    referenceId: string;
    amountCents: number;
    currency: "USD" | "EUR";
    productName: string;
    companyId: Id<"companies">;
  }> => {
    const qty = args.quantity ?? 1;

    // Resolve checkout link
    const link = await ctx.db
      .query("checkoutLinks")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!link || !link.isActive) throw new Error("Checkout link not found or inactive");

    const product = await ctx.db.get(link.productId);
    if (!product || !product.isActive) throw new Error("Product not found or inactive");

    const amountCents = product.unitPriceCents * qty;

    // Auto-register customer if wallet provided
    let customerId = undefined;
    if (args.buyerWallet) {
      customerId = await findOrCreateCustomerByWallet(ctx, {
        companyId: link.companyId,
        walletAddress: args.buyerWallet,
        fullName: args.buyerFullName,
        email: args.buyerEmail,
        country: args.buyerCountry,
      });
    }

    // Create payment record
    const paymentId = await ctx.db.insert("customerPayments", {
      companyId: link.companyId,
      customerId,
      productId: link.productId,
      mode: "checkout",
      amountCents,
      currency: product.currency,
      status: "pending",
      description: `${product.name}${qty > 1 ? ` x${qty}` : ""}`,
      quantity: qty,
      checkoutLinkId: link._id,
    });

    const referenceId = shortRef();
    await ctx.db.patch(paymentId, { referenceId });

    return {
      paymentId,
      referenceId,
      amountCents,
      currency: product.currency,
      productName: product.name,
      companyId: link.companyId,
    };
  },
});

/**
 * Initiate a usage/pay-as-you-go payment via SDK.
 * Amount is dynamic, set by the calling service.
 */
export const initiateUsagePayment = mutation({
  args: {
    companyId: v.id("companies"),
    productId: v.id("products"),
    amountCents: v.number(),
    currency: v.union(v.literal("USD"), v.literal("EUR")),
    description: v.optional(v.string()),
    buyerWallet: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{
    paymentId: Id<"customerPayments">;
    referenceId: string;
    amountCents: number;
    currency: "USD" | "EUR";
    productName: string;
  }> => {
    const product = await ctx.db.get(args.productId);
    if (!product || !product.isActive) throw new Error("Product not found or inactive");
    if (product.companyId !== args.companyId) throw new Error("Product does not belong to this company");

    let customerId = undefined;
    if (args.buyerWallet) {
      customerId = await findOrCreateCustomerByWallet(ctx, {
        companyId: args.companyId,
        walletAddress: args.buyerWallet,
      });
    }

    const paymentId = await ctx.db.insert("customerPayments", {
      companyId: args.companyId,
      customerId,
      productId: args.productId,
      mode: "usage",
      amountCents: args.amountCents,
      currency: args.currency,
      status: "pending",
      description: args.description ?? `${product.name} — usage`,
    });

    const referenceId = shortRef();
    await ctx.db.patch(paymentId, { referenceId });

    return {
      paymentId,
      referenceId,
      amountCents: args.amountCents,
      currency: args.currency,
      productName: product.name,
    };
  },
});

/**
 * Store the WC Pay payment ID and gateway URL on the payment record.
 * Called after the API route creates the WC Pay session.
 */
export const attachWcPay = mutation({
  args: {
    paymentId: v.id("customerPayments"),
    wcPayPaymentId: v.string(),
    wcPayGatewayUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.paymentId, {
      wcPayPaymentId: args.wcPayPaymentId,
      wcPayGatewayUrl: args.wcPayGatewayUrl,
    });
  },
});

/**
 * Confirm a payment as paid. Credits the business treasury.
 * Called by webhook or after WC Pay settlement confirmation.
 */
export const confirmPayment = mutation({
  args: {
    paymentId: v.id("customerPayments"),
    txHash: v.optional(v.string()),
    buyerWallet: v.optional(v.string()),
    buyerFullName: v.optional(v.string()),
    buyerDateOfBirth: v.optional(v.string()),
    buyerCountry: v.optional(v.string()),
    buyerEmail: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const payment = await ctx.db.get(args.paymentId);
    if (!payment) throw new Error("Payment not found");
    if (payment.status === "paid") return; // idempotent

    // Auto-register customer with full details from the transaction
    let resolvedCustomerId = payment.customerId;
    if (args.buyerWallet) {
      resolvedCustomerId = await findOrCreateCustomerByWallet(ctx, {
        companyId: payment.companyId,
        walletAddress: args.buyerWallet,
        fullName: args.buyerFullName,
        dateOfBirth: args.buyerDateOfBirth,
        country: args.buyerCountry,
        email: args.buyerEmail,
      });
      if (resolvedCustomerId !== payment.customerId) {
        await ctx.db.patch(args.paymentId, { customerId: resolvedCustomerId });
      }
    }

    // Credit treasury
    let customerName = "Anonymous";
    if (resolvedCustomerId) {
      const customer = await ctx.db.get(resolvedCustomerId);
      customerName = customer?.displayName ?? "Unknown";
    }

    await creditBalance(ctx, {
      companyId: payment.companyId,
      amountCents: payment.amountCents,
      currency: payment.currency,
      reason: `Payment: ${customerName} — ${payment.description ?? payment.mode}`,
      relatedPaymentId: payment._id,
    });

    await ctx.db.patch(args.paymentId, {
      status: "paid",
      paidAt: Date.now(),
      ...(args.txHash ? {
        txHash: args.txHash,
        txExplorerUrl: `https://testnet.arcscan.app/tx/${args.txHash}`,
      } : {}),
    });

    // ─── Referral Commission ───
    // If the payment came through a checkout link with referral config,
    // create an employee payment for the referee's commission.
    if (payment.checkoutLinkId) {
      const link = await ctx.db.get(payment.checkoutLinkId);
      if (link?.referralPercentage && link.referralPercentage > 0 && link.referralName) {
        const commissionCents = Math.round(
          (payment.amountCents * link.referralPercentage) / 100
        );
        if (commissionCents > 0) {
          await ctx.db.insert("employeePayments", {
            companyId: payment.companyId,
            // No employeeId — this is a referral payout, not tied to an employee record
            type: "freelance" as const,
            amountCents: commissionCents,
            currency: payment.currency,
            status: "draft" as const,
            description: `Referral commission: ${link.referralName} — ${link.referralPercentage}% of ${payment.description ?? "checkout payment"}`,
            walletAddress: link.referralWalletAddress,
          });
        }
      }
    }
  },
});

/**
 * Get payment by referenceId — used by webhook to resolve payments.
 */
export const getByReferenceId = query({
  args: { referenceId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("customerPayments")
      .withIndex("by_referenceId", (q) => q.eq("referenceId", args.referenceId))
      .unique();
  },
});
