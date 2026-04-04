import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * One-time migration: copy payrollContractAddress from businessProfiles → companies.
 *
 * Run once from the Convex dashboard: Functions → internal.migrations.backfillPayrollContractToCompanies
 */
export const backfillPayrollContractToCompanies = internalMutation({
  args: {},
  handler: async (ctx) => {
    const profiles = await ctx.db.query("businessProfiles").take(500);

    let updated = 0;
    let skipped = 0;

    for (const profile of profiles) {
      if (!profile.payrollContractAddress) {
        skipped++;
        continue;
      }

      // Find all companies owned by this user
      const memberships = await ctx.db
        .query("companyMembers")
        .withIndex("by_userId", (q) => q.eq("userId", profile.userId!))
        .take(50);

      for (const membership of memberships) {
        const company = await ctx.db.get(membership.companyId);
        if (!company) continue;

        // Only patch if not already set (don't overwrite a newer value)
        if (!company.payrollContractAddress) {
          await ctx.db.patch(membership.companyId, {
            payrollContractAddress: profile.payrollContractAddress,
          });
          updated++;
        }
      }
    }

    return { updated, skipped };
  },
});
