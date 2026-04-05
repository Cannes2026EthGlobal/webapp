import { mutation } from "./_generated/server";
import { v } from "convex/values";

function generateSlug(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let slug = "";
  for (let i = 0; i < 8; i++) {
    slug += chars[Math.floor(Math.random() * chars.length)];
  }
  return slug;
}

/**
 * Seeds 2 products with customized checkout links for influencer partnerships.
 *
 * Story: Two influencers promote products for the company. Each has a branded
 * checkout page with their own colors, messaging, and celebration effects.
 * The influencer's wallet is set as the custom recipient address so they
 * receive a cut directly on-chain.
 *
 * Usage:
 *   npx convex run seedInfluencers:seed '{"wallet": "0x..."}'
 */
export const seed = mutation({
  args: {
    wallet: v.string(),
  },
  handler: async (ctx, args) => {
    // Look up user → company from wallet
    const user = await ctx.db
      .query("users")
      .withIndex("by_walletAddress", (q) => q.eq("walletAddress", args.wallet))
      .unique();
    if (!user) throw new Error("No user found for this wallet");

    const membership = await ctx.db
      .query("companyMembers")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();
    if (!membership) throw new Error("No company found for this wallet");

    const companyId = membership.companyId;

    // ─── Influencer 1: Luna — Crypto lifestyle, premium aesthetic ───
    const lunaProductId = await ctx.db.insert("products", {
      companyId,
      name: "Luna's Premium Access Pass",
      description: "Exclusive monthly access to Luna's alpha signals, market analysis, and private community. Curated by @LunaCryptoQueen.",
      billingUnit: "month",
      pricingModel: "per-unit" as const,
      unitPriceCents: 4900, // $49.00
      currency: "USD" as const,
      settlementAsset: "USDC",
      privacyMode: "standard" as const,
      refundPolicy: "no-refund" as const,
      isActive: true,
    });

    const lunaSlug = `luna-${generateSlug()}`;
    const lunaLinkId = await ctx.db.insert("checkoutLinks", {
      companyId,
      productId: lunaProductId,
      slug: lunaSlug,
      label: "Luna's Checkout",
      isActive: true,
      recipientAddress: "0xL00000000000000000000000000000000000Luna1",
      customization: {
        primaryColor: "#8B5CF6",       // violet
        backgroundColor: "#0F0B1E",    // deep purple-black
        textColor: "#E8E0F0",          // lavender white
        heading: "Join Luna's Inner Circle",
        buttonText: "Get Access — $49/mo",
        thankYouMessage: "Welcome to the inner circle! 💎 Check your DMs for access.",
        effect: "fireworks" as const,
      },
    });

    // ─── Influencer 2: Rex — Builder / dev community, neon energy ───
    const rexProductId = await ctx.db.insert("products", {
      companyId,
      name: "Rex's Builder Toolkit",
      description: "Ship faster with Rex's curated smart contract templates, deployment scripts, and weekly live coding sessions. Built by @RexBuildoor.",
      billingUnit: "toolkit",
      pricingModel: "per-unit" as const,
      unitPriceCents: 2500, // $25.00
      currency: "USD" as const,
      settlementAsset: "USDC",
      privacyMode: "standard" as const,
      refundPolicy: "full" as const,
      isActive: true,
    });

    const rexSlug = `rex-${generateSlug()}`;
    const rexLinkId = await ctx.db.insert("checkoutLinks", {
      companyId,
      productId: rexProductId,
      slug: rexSlug,
      label: "Rex's Checkout",
      isActive: true,
      recipientAddress: "0xR00000000000000000000000000000000000Rex42",
      customization: {
        primaryColor: "#10B981",        // emerald green
        backgroundColor: "#022C22",     // dark green-black
        textColor: "#D1FAE5",           // mint white
        heading: "Rex's Builder Toolkit",
        buttonText: "Buy Toolkit — $25",
        thankYouMessage: "You're in! Check your email for the repo invite. Let's build. 🚀",
        effect: "bubbles" as const,
      },
    });

    return {
      luna: {
        productId: lunaProductId,
        linkId: lunaLinkId,
        checkoutUrl: `/checkout/${lunaSlug}`,
        slug: lunaSlug,
      },
      rex: {
        productId: rexProductId,
        linkId: rexLinkId,
        checkoutUrl: `/checkout/${rexSlug}`,
        slug: rexSlug,
      },
    };
  },
});
