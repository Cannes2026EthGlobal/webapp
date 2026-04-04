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
  v.literal("inactive")
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
    const totalByEmployee = new Map<string, number>();
    for (const line of allLines) {
      if (!line.isActive) continue;
      const total = totalByEmployee.get(line.employeeId) ?? 0;
      totalByEmployee.set(line.employeeId, total + line.amountCents);
    }

    return employees.map((emp) => ({
      ...emp,
      totalCompensationCents: totalByEmployee.get(emp._id) ?? 0,
    }));
  },
});

export const getById = query({
  args: { id: v.id("employees") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Cross-tenant lookup for the employee self-service portal
export const listByWalletAddress = query({
  args: { walletAddress: v.string() },
  handler: async (ctx, args) => {
    const employees = await ctx.db
      .query("employees")
      .withIndex("by_walletAddress", (q) =>
        q.eq("walletAddress", args.walletAddress)
      )
      .take(20);

    // Attach company name and total active compensation to each result
    return await Promise.all(
      employees.map(async (emp) => {
        const company = await ctx.db.get(emp.companyId);
        const activeLines = await ctx.db
          .query("compensationLines")
          .withIndex("by_employeeId_and_isActive", (q) =>
            q.eq("employeeId", emp._id).eq("isActive", true)
          )
          .take(20);
        const totalCompensationCents = activeLines.reduce(
          (sum, l) => sum + l.amountCents,
          0
        );
        return {
          ...emp,
          companyName: company?.name ?? "Unknown",
          totalCompensationCents,
        };
      })
    );
  },
});

export const create = mutation({
  args: {
    companyId: v.id("companies"),
    displayName: v.string(),
    role: v.string(),
    employmentType: employmentTypeValidator,
    // Legacy flat comp fields
    compensationModel: v.optional(
      v.union(
        v.literal("salary"),
        v.literal("hourly"),
        v.literal("per-task"),
        v.literal("milestone")
      )
    ),
    payoutAsset: v.optional(v.string()),
    payoutAmountCents: v.optional(v.number()),
    payoutFrequency: v.optional(
      v.union(
        v.literal("monthly"),
        v.literal("biweekly"),
        v.literal("weekly"),
        v.literal("per-task")
      )
    ),
    nextPaymentDate: v.optional(v.number()),
    startDate: v.optional(v.number()),
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
        updates[key] = value === "" ? undefined : value;
      }
    }
    await ctx.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id("employees") },
  handler: async (ctx, args) => {
    // Cascade-delete compensation splits
    const splits = await ctx.db
      .query("compensationSplits")
      .withIndex("by_employeeId", (q) => q.eq("employeeId", args.id))
      .take(200);
    for (const split of splits) {
      await ctx.db.delete(split._id);
    }

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
