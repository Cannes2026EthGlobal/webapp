import { query, mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";

const customerTypeValidator = v.union(
  v.literal("company"),
  v.literal("app"),
  v.literal("agent"),
  v.literal("buyer")
);

const pricingModelValidator = v.union(
  v.literal("usage"),
  v.literal("invoice"),
  v.literal("one-time"),
  v.literal("subscription")
);

const billingStateValidator = v.union(
  v.literal("active"),
  v.literal("overdue"),
  v.literal("paused"),
  v.literal("churned")
);

export const listByCompany = query({
  args: {
    companyId: v.id("companies"),
    billingState: v.optional(billingStateValidator),
  },
  handler: async (ctx, args) => {
    if (args.billingState) {
      return await ctx.db
        .query("customers")
        .withIndex("by_companyId_and_billingState", (q) =>
          q
            .eq("companyId", args.companyId)
            .eq("billingState", args.billingState!)
        )
        .order("desc")
        .take(100);
    }
    return await ctx.db
      .query("customers")
      .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
      .order("desc")
      .take(100);
  },
});

export const getById = query({
  args: { id: v.id("customers") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getByWallet = query({
  args: {
    companyId: v.id("companies"),
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("customers")
      .withIndex("by_companyId_and_walletAddress", (q) =>
        q.eq("companyId", args.companyId).eq("walletAddress", args.walletAddress)
      )
      .unique();
  },
});

export const create = mutation({
  args: {
    companyId: v.id("companies"),
    displayName: v.string(),
    customerType: customerTypeValidator,
    pricingModel: pricingModelValidator,
    billingState: billingStateValidator,
    walletAddress: v.optional(v.string()),
    walletReady: v.boolean(),
    email: v.optional(v.string()),
    contactName: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("customers", args);
  },
});

export const update = mutation({
  args: {
    id: v.id("customers"),
    displayName: v.optional(v.string()),
    customerType: v.optional(customerTypeValidator),
    pricingModel: v.optional(pricingModelValidator),
    billingState: v.optional(billingStateValidator),
    walletAddress: v.optional(v.string()),
    walletReady: v.optional(v.boolean()),
    email: v.optional(v.string()),
    contactName: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        updates[key] = value;
      }
    }
    await ctx.db.patch(id, updates);
  },
});

/**
 * Shared helper: find or create a customer by wallet address.
 * Can be called directly from any mutation handler without ctx.runMutation.
 */
export async function findOrCreateCustomerByWallet(
  ctx: MutationCtx,
  args: {
    companyId: Id<"companies">;
    walletAddress: string;
    displayName?: string;
    fullName?: string;
    dateOfBirth?: string;
    country?: string;
    email?: string;
  }
): Promise<Id<"customers">> {
  const existing = await ctx.db
    .query("customers")
    .withIndex("by_companyId_and_walletAddress", (q) =>
      q.eq("companyId", args.companyId).eq("walletAddress", args.walletAddress)
    )
    .unique();

  if (existing) {
    const updates: Record<string, string> = {};
    if (args.fullName && !existing.fullName) updates.fullName = args.fullName;
    if (args.dateOfBirth && !existing.dateOfBirth) updates.dateOfBirth = args.dateOfBirth;
    if (args.country && !existing.country) updates.country = args.country;
    if (args.email && !existing.email) updates.email = args.email;
    if (args.fullName && existing.displayName.includes("...")) {
      updates.displayName = args.fullName;
    }
    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(existing._id, updates);
    }
    return existing._id;
  }

  const displayName = args.fullName ?? args.displayName ?? `${args.walletAddress.slice(0, 6)}...${args.walletAddress.slice(-4)}`;

  return await ctx.db.insert("customers", {
    companyId: args.companyId,
    displayName,
    customerType: "buyer",
    pricingModel: "one-time",
    billingState: "active",
    walletAddress: args.walletAddress,
    walletReady: true,
    fullName: args.fullName,
    dateOfBirth: args.dateOfBirth,
    country: args.country,
    email: args.email,
  });
}

/**
 * Public mutation wrapper for findOrCreateCustomerByWallet.
 */
export const findOrCreateByWallet = mutation({
  args: {
    companyId: v.id("companies"),
    walletAddress: v.string(),
    displayName: v.optional(v.string()),
    fullName: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    country: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await findOrCreateCustomerByWallet(ctx, args);
  },
});

export const remove = mutation({
  args: { id: v.id("customers") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
