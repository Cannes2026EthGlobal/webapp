import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const employmentTypeValidator = v.union(
  v.literal("full-time"),
  v.literal("part-time"),
  v.literal("contractor"),
  v.literal("freelance")
);

const privacyLevelValidator = v.union(
  v.literal("pseudonymous"),
  v.literal("verified"),
  v.literal("shielded")
);

const statusValidator = v.union(
  v.literal("active"),
  v.literal("inactive"),
  v.literal("onboarding")
);

export const listByCompany = query({
  args: {
    companyId: v.id("companies"),
    status: v.optional(statusValidator),
  },
  handler: async (ctx, args) => {
    let employees;
    if (args.status) {
      employees = await ctx.db
        .query("employees")
        .withIndex("by_companyId_and_status", (q) =>
          q.eq("companyId", args.companyId).eq("status", args.status!)
        )
        .order("desc")
        .take(100);
    } else {
      employees = await ctx.db
        .query("employees")
        .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
        .order("desc")
        .take(100);
    }

    // Batch-fetch active compensation lines for all employees in this company
    const allLines = await ctx.db
      .query("compensationLines")
      .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
      .take(500);

    // Group active lines by employee
    const linesByEmployee = new Map<string, number>();
    for (const line of allLines) {
      if (!line.isActive) continue;
      const current = linesByEmployee.get(line.employeeId) ?? 0;
      linesByEmployee.set(line.employeeId, current + line.amountCents);
    }

    return employees.map((emp) => ({
      ...emp,
      totalCompensationCents: linesByEmployee.get(emp._id) ?? emp.payoutAmountCents ?? 0,
    }));
  },
});

export const getById = query({
  args: { id: v.id("employees") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    companyId: v.id("companies"),
    displayName: v.string(),
    role: v.string(),
    employmentType: employmentTypeValidator,
    walletAddress: v.optional(v.string()),
    backupWalletAddress: v.optional(v.string()),
    walletVerified: v.boolean(),
    privacyLevel: privacyLevelValidator,
    legalName: v.optional(v.string()),
    taxId: v.optional(v.string()),
    jurisdiction: v.optional(v.string()),
    email: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: statusValidator,
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("employees", args);
  },
});

export const update = mutation({
  args: {
    id: v.id("employees"),
    displayName: v.optional(v.string()),
    role: v.optional(v.string()),
    employmentType: v.optional(employmentTypeValidator),
    walletAddress: v.optional(v.string()),
    backupWalletAddress: v.optional(v.string()),
    walletVerified: v.optional(v.boolean()),
    privacyLevel: v.optional(privacyLevelValidator),
    legalName: v.optional(v.string()),
    taxId: v.optional(v.string()),
    jurisdiction: v.optional(v.string()),
    email: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: v.optional(statusValidator),
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

export const remove = mutation({
  args: { id: v.id("employees") },
  handler: async (ctx, args) => {
    // Cascade-delete compensation lines
    const lines = await ctx.db
      .query("compensationLines")
      .withIndex("by_employeeId", (q) => q.eq("employeeId", args.id))
      .take(100);
    for (const line of lines) {
      await ctx.db.delete(line._id);
    }

    await ctx.db.delete(args.id);
  },
});
