import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const statusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("denied"),
  v.literal("settled"),
  v.literal("deducted"),
  v.literal("cancelled")
);

// ─── Queries ───

export const listByCompany = query({
  args: {
    companyId: v.id("companies"),
    status: v.optional(statusValidator),
  },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("advanceRequests")
        .withIndex("by_companyId_and_status", (q) =>
          q.eq("companyId", args.companyId).eq("status", args.status!)
        )
        .order("desc")
        .take(100);
    }
    return await ctx.db
      .query("advanceRequests")
      .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
      .order("desc")
      .take(100);
  },
});

export const listByEmployee = query({
  args: { employeeId: v.id("employees") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("advanceRequests")
      .withIndex("by_employeeId", (q) => q.eq("employeeId", args.employeeId))
      .order("desc")
      .take(50);
  },
});

export const getActiveForEmployee = query({
  args: { employeeId: v.id("employees") },
  handler: async (ctx, args) => {
    const requests = await ctx.db
      .query("advanceRequests")
      .withIndex("by_employeeId", (q) => q.eq("employeeId", args.employeeId))
      .order("desc")
      .take(10);
    return requests.filter(
      (r) => r.status === "pending" || r.status === "approved" || r.status === "settled"
    );
  },
});

// ─── Mutations ───

export const request = mutation({
  args: {
    companyId: v.id("companies"),
    employeeId: v.id("employees"),
    requestedAmountCents: v.number(),
    currency: v.union(v.literal("USD"), v.literal("EUR")),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const employee = await ctx.db.get(args.employeeId);
    if (!employee || employee.companyId !== args.companyId) {
      throw new Error("Employee not found");
    }
    if (employee.status !== "active") {
      throw new Error("Only active employees can request advances");
    }

    const settings = await ctx.db
      .query("advanceSettings")
      .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
      .unique();

    const enabled = settings?.enabled ?? true;
    const autoDisabled = settings?.autoDisabled ?? false;
    if (!enabled || autoDisabled) {
      throw new Error("Advance requests are currently disabled for this company");
    }

    const interestRateBps = settings?.interestRateBps ?? 200;
    const maxAdvancePercent = settings?.maxAdvancePercent ?? 80;

    const existing = await ctx.db
      .query("advanceRequests")
      .withIndex("by_employeeId_and_status", (q) =>
        q.eq("employeeId", args.employeeId).eq("status", "pending")
      )
      .take(1);
    if (existing.length > 0) {
      throw new Error("You already have a pending advance request");
    }

    const settledAdvances = await ctx.db
      .query("advanceRequests")
      .withIndex("by_employeeId_and_status", (q) =>
        q.eq("employeeId", args.employeeId).eq("status", "settled")
      )
      .take(1);
    if (settledAdvances.length > 0) {
      throw new Error("You have an outstanding advance that hasn't been deducted yet");
    }

    const maxAllowed = Math.floor(
      (employee.payoutAmountCents * maxAdvancePercent) / 100
    );
    if (args.requestedAmountCents > maxAllowed) {
      throw new Error(
        `Maximum advance is ${maxAdvancePercent}% of your paycheck ($${(maxAllowed / 100).toFixed(2)})`
      );
    }

    const interestAmountCents = Math.ceil(
      (args.requestedAmountCents * interestRateBps) / 10000
    );
    const netAmountCents = args.requestedAmountCents - interestAmountCents;

    const now = new Date();
    let nextPaycheckDate: number;
    if (employee.nextPaymentDate && employee.nextPaymentDate > now.getTime()) {
      nextPaycheckDate = employee.nextPaymentDate;
    } else {
      const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      nextPaycheckDate = next.getTime();
    }

    return await ctx.db.insert("advanceRequests", {
      companyId: args.companyId,
      employeeId: args.employeeId,
      requestedAmountCents: args.requestedAmountCents,
      interestAmountCents,
      netAmountCents,
      currency: args.currency,
      status: "pending",
      reason: args.reason,
      nextPaycheckDate,
      nextPaycheckAmountCents: employee.payoutAmountCents,
    });
  },
});

export const approve = mutation({
  args: { id: v.id("advanceRequests") },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.id);
    if (!request) throw new Error("Request not found");
    if (request.status !== "pending") {
      throw new Error("Can only approve pending requests");
    }

    const paymentId = await ctx.db.insert("employeePayments", {
      companyId: request.companyId,
      employeeId: request.employeeId,
      type: "advance",
      amountCents: request.netAmountCents,
      currency: request.currency,
      status: "approved",
      description: `Salary advance (${request.interestAmountCents} interest deducted)`,
      scheduledDate: Date.now(),
    });

    await ctx.db.patch(args.id, {
      status: "approved",
      advancePaymentId: paymentId,
    });
  },
});

export const deny = mutation({
  args: {
    id: v.id("advanceRequests"),
    denyReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.id);
    if (!request) throw new Error("Request not found");
    if (request.status !== "pending") {
      throw new Error("Can only deny pending requests");
    }
    await ctx.db.patch(args.id, {
      status: "denied",
      denyReason: args.denyReason,
    });
  },
});

export const cancel = mutation({
  args: { id: v.id("advanceRequests") },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.id);
    if (!request) throw new Error("Request not found");
    if (request.status !== "pending") {
      throw new Error("Can only cancel pending requests");
    }
    await ctx.db.patch(args.id, { status: "cancelled" });
  },
});

export const markSettled = mutation({
  args: { id: v.id("advanceRequests") },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.id);
    if (!request) throw new Error("Request not found");
    if (request.status !== "approved") {
      throw new Error("Can only settle approved requests");
    }
    await ctx.db.patch(args.id, { status: "settled" });
  },
});

export const markDeducted = mutation({
  args: {
    id: v.id("advanceRequests"),
    deductedFromPaymentId: v.id("employeePayments"),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.id);
    if (!request) throw new Error("Request not found");
    if (request.status !== "settled") {
      throw new Error("Can only deduct settled advances");
    }
    await ctx.db.patch(args.id, {
      status: "deducted",
      deductedFromPaymentId: args.deductedFromPaymentId,
    });
  },
});
