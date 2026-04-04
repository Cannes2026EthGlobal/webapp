import { query, mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { findOrCreateCustomerByWallet } from "./customers";

/**
 * Record usage: adds units to an open tab (or creates one).
 * This is the hot path — called by developer services for every billable event.
 */
export const recordUsage = mutation({
  args: {
    companyId: v.id("companies"),
    productId: v.id("products"),
    customerIdentifier: v.string(), // wallet, email, or client ID
    units: v.number(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (!product || !product.isActive) throw new Error("Product not found or inactive");
    if (product.companyId !== args.companyId) throw new Error("Product does not belong to this company");

    const amountCents = args.units * product.unitPriceCents;

    // Find or create an open tab for this customer + product
    let tab = await ctx.db
      .query("usageTabs")
      .withIndex("by_customer", (q) =>
        q
          .eq("companyId", args.companyId)
          .eq("productId", args.productId)
          .eq("customerIdentifier", args.customerIdentifier)
      )
      .order("desc")
      .first();

    if (!tab || tab.status !== "open") {
      // Create a new open tab
      const tabId = await ctx.db.insert("usageTabs", {
        companyId: args.companyId,
        productId: args.productId,
        customerIdentifier: args.customerIdentifier,
        totalUnits: args.units,
        totalCents: amountCents,
        status: "open",
      });

      await ctx.db.insert("usageEntries", {
        tabId,
        companyId: args.companyId,
        units: args.units,
        amountCents,
        description: args.description,
      });

      return { tabId, totalUnits: args.units, totalCents: amountCents };
    }

    // Append to existing open tab
    const newTotalUnits = tab.totalUnits + args.units;
    const newTotalCents = tab.totalCents + amountCents;
    await ctx.db.patch(tab._id, {
      totalUnits: newTotalUnits,
      totalCents: newTotalCents,
    });

    await ctx.db.insert("usageEntries", {
      tabId: tab._id,
      companyId: args.companyId,
      units: args.units,
      amountCents,
      description: args.description,
    });

    return { tabId: tab._id, totalUnits: newTotalUnits, totalCents: newTotalCents };
  },
});

/**
 * Bill a tab: closes the tab and creates a customerPayment + referenceId.
 * Returns the paymentId and referenceId needed to create a WC Pay session.
 */
export const billTab = mutation({
  args: {
    tabId: v.id("usageTabs"),
  },
  handler: async (ctx, args): Promise<{
    paymentId: Id<"customerPayments">;
    referenceId: string;
    amountCents: number;
    currency: "USD" | "EUR";
    productName: string;
    customerIdentifier: string;
  }> => {
    const tab = await ctx.db.get(args.tabId);
    if (!tab) throw new Error("Tab not found");
    if (tab.status !== "open") throw new Error("Tab is already billed or paid");
    if (tab.totalCents <= 0) throw new Error("Tab has no usage to bill");

    const product = await ctx.db.get(tab.productId);
    if (!product) throw new Error("Product not found");

    // Auto-register customer if identifier looks like a wallet
    let customerId: Id<"customers"> | undefined;
    if (tab.customerIdentifier.startsWith("0x")) {
      customerId = await findOrCreateCustomerByWallet(ctx, {
        companyId: tab.companyId,
        walletAddress: tab.customerIdentifier,
      });
    }

    // Create payment record
    const paymentId = await ctx.db.insert("customerPayments", {
      companyId: tab.companyId,
      customerId,
      productId: tab.productId,
      mode: "usage",
      amountCents: tab.totalCents,
      currency: product.currency,
      status: "pending",
      description: `${product.name} — ${tab.totalUnits} ${product.billingUnit}${tab.totalUnits !== 1 ? "s" : ""}`,
    });

    // Generate short referenceId
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let ref = "arc-";
    for (let i = 0; i < 16; i++) {
      ref += chars[Math.floor(Math.random() * chars.length)];
    }
    await ctx.db.patch(paymentId, { referenceId: ref });

    // Close the tab
    await ctx.db.patch(args.tabId, {
      status: "billed",
      paymentId,
      billedAt: Date.now(),
    });

    return {
      paymentId,
      referenceId: ref,
      amountCents: tab.totalCents,
      currency: product.currency,
      productName: product.name,
      customerIdentifier: tab.customerIdentifier,
    };
  },
});

/**
 * Mark a tab as paid (called after payment confirmation).
 */
export const markPaid = mutation({
  args: { tabId: v.id("usageTabs") },
  handler: async (ctx, args) => {
    const tab = await ctx.db.get(args.tabId);
    if (!tab) throw new Error("Tab not found");
    await ctx.db.patch(args.tabId, { status: "paid", paidAt: Date.now() });
  },
});

/**
 * Attach the checkout URL to a billed tab.
 */
export const attachCheckoutUrl = mutation({
  args: {
    tabId: v.id("usageTabs"),
    checkoutUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.tabId, { checkoutUrl: args.checkoutUrl });
  },
});

// ─── Queries ───

export const getTab = query({
  args: { tabId: v.id("usageTabs") },
  handler: async (ctx, args) => {
    const tab = await ctx.db.get(args.tabId);
    if (!tab) return null;
    const product = await ctx.db.get(tab.productId);
    return { ...tab, productName: product?.name, billingUnit: product?.billingUnit };
  },
});

export const getOpenTab = query({
  args: {
    companyId: v.id("companies"),
    productId: v.id("products"),
    customerIdentifier: v.string(),
  },
  handler: async (ctx, args) => {
    const tab = await ctx.db
      .query("usageTabs")
      .withIndex("by_customer", (q) =>
        q
          .eq("companyId", args.companyId)
          .eq("productId", args.productId)
          .eq("customerIdentifier", args.customerIdentifier)
      )
      .order("desc")
      .first();

    if (!tab || tab.status !== "open") return null;
    return tab;
  },
});

export const listByCompany = query({
  args: {
    companyId: v.id("companies"),
    status: v.optional(v.union(v.literal("open"), v.literal("billed"), v.literal("paid"))),
  },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("usageTabs")
        .withIndex("by_companyId_and_status", (q) =>
          q.eq("companyId", args.companyId).eq("status", args.status!)
        )
        .order("desc")
        .take(100);
    }
    return await ctx.db
      .query("usageTabs")
      .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
      .order("desc")
      .take(100);
  },
});

export const getEntries = query({
  args: { tabId: v.id("usageTabs") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("usageEntries")
      .withIndex("by_tabId", (q) => q.eq("tabId", args.tabId))
      .order("desc")
      .take(200);
  },
});
