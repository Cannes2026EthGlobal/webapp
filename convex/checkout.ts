import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { creditBalance } from "./balances";

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
      customerId = await ctx.runMutation(api.customers.findOrCreateByWallet, {
        companyId: link.companyId,
        walletAddress: args.buyerWallet,
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
      customerId = await ctx.runMutation(api.customers.findOrCreateByWallet, {
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
  },
  handler: async (ctx, args): Promise<void> => {
    const payment = await ctx.db.get(args.paymentId);
    if (!payment) throw new Error("Payment not found");
    if (payment.status === "paid") return; // idempotent

    // Auto-register customer if wallet provided and no customer yet
    if (args.buyerWallet && !payment.customerId) {
      const customerId = await ctx.runMutation(api.customers.findOrCreateByWallet, {
        companyId: payment.companyId,
        walletAddress: args.buyerWallet,
      });
      await ctx.db.patch(args.paymentId, { customerId });
    }

    // Credit treasury
    let customerName = "Anonymous";
    if (payment.customerId) {
      const customer = await ctx.db.get(payment.customerId);
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
      ...(args.txHash ? { txHash: args.txHash } : {}),
    });
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
