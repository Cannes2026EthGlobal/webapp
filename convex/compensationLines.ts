import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const typeValidator = v.union(
  v.literal("salary"),
  v.literal("hourly"),
  v.literal("per-task"),
  v.literal("milestone"),
  v.literal("bonus")
);

const frequencyValidator = v.union(
  v.literal("monthly"),
  v.literal("biweekly"),
  v.literal("weekly"),
  v.literal("per-task"),
  v.literal("one-time")
);

export const listByEmployee = query({
  args: { employeeId: v.id("employees") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("compensationLines")
      .withIndex("by_employeeId", (q) => q.eq("employeeId", args.employeeId))
      .order("desc")
      .take(50);
  },
});

export const listActiveByEmployee = query({
  args: { employeeId: v.id("employees") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("compensationLines")
      .withIndex("by_employeeId_and_isActive", (q) =>
        q.eq("employeeId", args.employeeId).eq("isActive", true)
      )
      .take(20);
  },
});

export const listByCompany = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("compensationLines")
      .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
      .take(500);
  },
});

export const getById = query({
  args: { id: v.id("compensationLines") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    employeeId: v.id("employees"),
    companyId: v.id("companies"),
    name: v.string(),
    description: v.optional(v.string()),
    type: typeValidator,
    amountCents: v.number(),
    asset: v.string(),
    frequency: frequencyValidator,
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const employee = await ctx.db.get(args.employeeId);
    if (!employee) throw new Error("Employee not found");
    if (employee.companyId !== args.companyId) {
      throw new Error("Employee does not belong to this company");
    }
    return await ctx.db.insert("compensationLines", args);
  },
});

export const update = mutation({
  args: {
    id: v.id("compensationLines"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    type: v.optional(typeValidator),
    amountCents: v.optional(v.number()),
    asset: v.optional(v.string()),
    frequency: v.optional(frequencyValidator),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
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

export const toggleActive = mutation({
  args: {
    id: v.id("compensationLines"),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { isActive: args.isActive });
  },
});

export const remove = mutation({
  args: { id: v.id("compensationLines") },
  handler: async (ctx, args) => {
    // Check for non-settled payments referencing this line
    const linkedPayments = await ctx.db
      .query("employeePayments")
      .withIndex("by_compensationLineId", (q) =>
        q.eq("compensationLineId", args.id)
      )
      .take(1);

    const hasActivePayments = linkedPayments.some(
      (p) => p.status !== "settled" && p.status !== "failed"
    );
    if (hasActivePayments) {
      throw new Error(
        "Cannot delete: active payments reference this compensation line"
      );
    }

    await ctx.db.delete(args.id);
  },
});
