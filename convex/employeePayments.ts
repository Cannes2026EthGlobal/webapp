import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const paymentTypeValidator = v.union(
  v.literal("salary"),
  v.literal("freelance"),
  v.literal("bonus"),
  v.literal("reimbursement"),
  v.literal("advance")
);

const statusValidator = v.union(
  v.literal("draft"),
  v.literal("approved"),
  v.literal("queued"),
  v.literal("settled"),
  v.literal("failed")
);

export const listByCompany = query({
  args: {
    companyId: v.id("companies"),
    status: v.optional(statusValidator),
  },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("employeePayments")
        .withIndex("by_companyId_and_status", (q) =>
          q.eq("companyId", args.companyId).eq("status", args.status!)
        )
        .order("desc")
        .take(100);
    }
    return await ctx.db
      .query("employeePayments")
      .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
      .order("desc")
      .take(100);
  },
});

export const listByEmployee = query({
  args: { employeeId: v.id("employees") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("employeePayments")
      .withIndex("by_employeeId", (q) => q.eq("employeeId", args.employeeId))
      .order("desc")
      .take(50);
  },
});

export const getById = query({
  args: { id: v.id("employeePayments") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    companyId: v.id("companies"),
    employeeId: v.id("employees"),
    type: paymentTypeValidator,
    amountCents: v.number(),
    currency: v.union(v.literal("USD"), v.literal("EUR")),
    description: v.optional(v.string()),
    scheduledDate: v.optional(v.number()),
    batchId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("employeePayments", {
      ...args,
      status: "draft",
    });
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("employeePayments"),
    status: statusValidator,
    settledAt: v.optional(v.number()),
    txHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    await ctx.db.patch(id, fields);
  },
});

export const update = mutation({
  args: {
    id: v.id("employeePayments"),
    type: v.optional(paymentTypeValidator),
    amountCents: v.optional(v.number()),
    currency: v.optional(v.union(v.literal("USD"), v.literal("EUR"))),
    description: v.optional(v.string()),
    scheduledDate: v.optional(v.number()),
    batchId: v.optional(v.string()),
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
  args: { id: v.id("employeePayments") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
