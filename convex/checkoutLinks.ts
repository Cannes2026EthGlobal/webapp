import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

function generateSlug(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let slug = "";
  for (let i = 0; i < 8; i++) {
    slug += chars[Math.floor(Math.random() * chars.length)];
  }
  return slug;
}

export const create = mutation({
  args: {
    companyId: v.id("companies"),
    productId: v.id("products"),
    label: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Generate a unique slug
    let slug = generateSlug();
    let existing = await ctx.db
      .query("checkoutLinks")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    while (existing) {
      slug = generateSlug();
      existing = await ctx.db
        .query("checkoutLinks")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique();
    }

    return await ctx.db.insert("checkoutLinks", {
      companyId: args.companyId,
      productId: args.productId,
      slug,
      label: args.label,
      isActive: true,
    });
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("checkoutLinks")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!link || !link.isActive) return null;

    const product = await ctx.db.get(link.productId);
    if (!product || !product.isActive) return null;

    const company = await ctx.db.get(link.companyId);

    return {
      link,
      product,
      companyName: company?.name ?? "Unknown",
      companyId: link.companyId,
    };
  },
});

export const listByCompany = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const links = await ctx.db
      .query("checkoutLinks")
      .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
      .order("desc")
      .take(100);

    // Enrich with product names
    const enriched = [];
    for (const link of links) {
      const product = await ctx.db.get(link.productId);
      enriched.push({
        ...link,
        productName: product?.name ?? "Deleted product",
      });
    }
    return enriched;
  },
});

export const listByProduct = query({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("checkoutLinks")
      .withIndex("by_productId", (q) => q.eq("productId", args.productId))
      .order("desc")
      .take(20);
  },
});

export const getById = query({
  args: { id: v.id("checkoutLinks") },
  handler: async (ctx, args) => {
    const link = await ctx.db.get(args.id);
    if (!link) return null;
    const product = await ctx.db.get(link.productId);
    return {
      ...link,
      productName: product?.name ?? "Unknown",
      productPriceCents: product?.unitPriceCents ?? 0,
      productCurrency: product?.currency ?? "USD",
    };
  },
});

export const deactivate = mutation({
  args: { id: v.id("checkoutLinks") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { isActive: false });
  },
});

export const update = mutation({
  args: {
    id: v.id("checkoutLinks"),
    recipientAddress: v.optional(v.string()),
    referralName: v.optional(v.string()),
    referralWalletAddress: v.optional(v.string()),
    referralPercentage: v.optional(v.number()),
    customization: v.optional(v.object({
      primaryColor: v.optional(v.string()),
      backgroundColor: v.optional(v.string()),
      textColor: v.optional(v.string()),
      buttonText: v.optional(v.string()),
      heading: v.optional(v.string()),
      thankYouMessage: v.optional(v.string()),
      effect: v.optional(v.union(
        v.literal("none"),
        v.literal("confetti"),
        v.literal("fireworks"),
        v.literal("snow"),
        v.literal("bubbles"),
      )),
    })),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) updates[key] = value;
    }
    await ctx.db.patch(id, updates);
  },
});
