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
        .query("creditRequests")
        .withIndex("by_companyId_and_status", (q) =>
          q.eq("companyId", args.companyId).eq("status", args.status!)
        )
        .order("desc")
        .take(100);
    }
    return await ctx.db
      .query("creditRequests")
      .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
      .order("desc")
      .take(100);
  },
});

export const listByEmployee = query({
  args: { employeeId: v.id("employees") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("creditRequests")
      .withIndex("by_employeeId", (q) => q.eq("employeeId", args.employeeId))
      .order("desc")
      .take(50);
  },
});

export const getActiveForEmployee = query({
  args: { employeeId: v.id("employees") },
  handler: async (ctx, args) => {
    const requests = await ctx.db
      .query("creditRequests")
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
      throw new Error("Only active employees can request credits");
    }
    if (employee.notes?.startsWith("[no-credit]")) {
      throw new Error("Credit requests are disabled for this employee");
    }

    const settings = await ctx.db
      .query("creditSettings")
      .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
      .unique();

    const enabled = settings?.enabled ?? true;
    const autoDisabled = settings?.autoDisabled ?? false;
    if (!enabled || autoDisabled) {
      throw new Error("Credit requests are currently disabled for this company");
    }

    const interestRateBps = settings?.interestRateBps ?? 200;
    const maxCreditPercent = settings?.maxCreditPercent ?? 80;

    // Block if there's already an approved or settled credit outstanding
    const outstanding = await ctx.db
      .query("creditRequests")
      .withIndex("by_employeeId", (q) =>
        q.eq("employeeId", args.employeeId)
      )
      .take(20);
    const hasOutstanding = outstanding.some(
      (r) => r.status === "approved" || r.status === "settled"
    );
    if (hasOutstanding) {
      throw new Error("You have an outstanding credit that hasn't been deducted yet");
    }

    // Sum active compensation lines as the source of truth for payout amount
    const activeLines = await ctx.db
      .query("compensationLines")
      .withIndex("by_employeeId_and_isActive", (q) =>
        q.eq("employeeId", args.employeeId).eq("isActive", true)
      )
      .take(20);
    const payoutCents = activeLines.reduce((s, l) => s + l.amountCents, 0);
    const maxAllowed = Math.floor((payoutCents * maxCreditPercent) / 100);
    if (args.requestedAmountCents > maxAllowed) {
      throw new Error(
        `Maximum credit is ${maxCreditPercent}% of your paycheck ($${(maxAllowed / 100).toFixed(2)})`
      );
    }

    const now = new Date();
    let nextPaycheckDate: number;
    if (employee.nextPaymentDate && employee.nextPaymentDate > now.getTime()) {
      nextPaycheckDate = employee.nextPaymentDate;
    } else {
      const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      nextPaycheckDate = next.getTime();
    }

    // Prorate annual interest over the actual days until next paycheck
    const daysUntilPaycheck = Math.max(
      1,
      Math.ceil((nextPaycheckDate - now.getTime()) / 86_400_000)
    );
    const interestAmountCents = Math.ceil(
      (args.requestedAmountCents * interestRateBps * daysUntilPaycheck) /
        (10000 * 365)
    );
    const netAmountCents = args.requestedAmountCents - interestAmountCents;

    // Auto-approve: create credit request + payment in one step
    const creditRequestId = await ctx.db.insert("creditRequests", {
      companyId: args.companyId,
      employeeId: args.employeeId,
      requestedAmountCents: args.requestedAmountCents,
      interestAmountCents,
      netAmountCents,
      currency: args.currency,
      status: "approved",
      reason: args.reason,
      nextPaycheckDate,
      nextPaycheckAmountCents: payoutCents,
    });

    // Create the employeePayment for CRE to pick up and settle on-chain
    const paymentId = await ctx.db.insert("employeePayments", {
      companyId: args.companyId,
      employeeId: args.employeeId,
      type: "credit",
      amountCents: netAmountCents,
      currency: args.currency,
      status: "approved",
      description: `Salary advance (${interestAmountCents}¢ interest deducted)`,
      scheduledDate: Date.now(),
    });

    await ctx.db.patch(creditRequestId, { creditPaymentId: paymentId });

    return creditRequestId;
  },
});

export const approve = mutation({
  args: { id: v.id("creditRequests") },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.id);
    if (!request) throw new Error("Request not found");
    if (request.status !== "pending") {
      throw new Error("Can only approve pending requests");
    }

    const paymentId = await ctx.db.insert("employeePayments", {
      companyId: request.companyId,
      employeeId: request.employeeId,
      type: "credit",
      amountCents: request.netAmountCents,
      currency: request.currency,
      status: "approved",
      description: `Salary credit (${request.interestAmountCents} interest deducted)`,
      scheduledDate: Date.now(),
    });

    await ctx.db.patch(args.id, {
      status: "approved",
      creditPaymentId: paymentId,
    });
  },
});

export const deny = mutation({
  args: {
    id: v.id("creditRequests"),
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
  args: { id: v.id("creditRequests") },
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
  args: { id: v.id("creditRequests") },
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
    id: v.id("creditRequests"),
    deductedFromPaymentId: v.id("employeePayments"),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.id);
    if (!request) throw new Error("Request not found");
    if (request.status !== "settled") {
      throw new Error("Can only deduct settled credits");
    }
    await ctx.db.patch(args.id, {
      status: "deducted",
      deductedFromPaymentId: args.deductedFromPaymentId,
    });
  },
});
