import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Atomic onboarding completion:
 * 1. Creates the businessProfile (gates dashboard access)
 * 2. Creates the company (or updates an existing one) with payrollContractAddress
 *
 * Keeping both tables: businessProfile = "has the user ever onboarded?"
 * companies = the operational workspace with the payroll contract.
 */
export const complete = mutation({
  args: {
    userId: v.id("users"),
    businessName: v.string(),
    description: v.optional(v.string()),
    industry: v.optional(v.string()),
    website: v.optional(v.string()),
    payrollContractAddress: v.string(),
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
    // ─── 1. Create businessProfile if it doesn't exist ───
    const existingProfile = await ctx.db
      .query("businessProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (!existingProfile) {
      await ctx.db.insert("businessProfiles", {
        userId: args.userId,
        businessName: args.businessName,
        description: args.description,
        industry: args.industry,
        website: args.website,
        payrollContractAddress: args.payrollContractAddress,
      });
    }

    // ─── 2. Find or create company for this user ───
    const membership = await ctx.db
      .query("companyMembers")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (membership) {
      // Update the existing company with the payroll contract address
      await ctx.db.patch(membership.companyId, {
        payrollContractAddress: args.payrollContractAddress,
      });
      return { companyId: membership.companyId };
    } else {
      // Create a new company for this user
      const slugBase = args.businessName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const slugSuffix = args.walletAddress.slice(-6).toLowerCase();
      const slug = `${slugBase}-${slugSuffix}`;

      const companyId = await ctx.db.insert("companies", {
        name: args.businessName,
        slug,
        ownerId: args.userId,
        industry: args.industry,
        website: args.website,
        payrollContractAddress: args.payrollContractAddress,
      });

      await ctx.db.insert("companyMembers", {
        userId: args.userId,
        companyId,
        role: "owner",
      });

      return { companyId };
    }
  },
});
