import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const insightTypeValidator = v.union(
  v.literal("product_analysis"),
  v.literal("customer_importance"),
  v.literal("revenue_forecast"),
  v.literal("churn_risk"),
  v.literal("cashflow_optimization"),
  v.literal("payroll_efficiency"),
  v.literal("chat"),
  v.literal("custom")
);

// ─── Chat Session CRUD ───

/**
 * Create a new chat session.
 */
export const createChatSession = mutation({
  args: {
    companyId: v.id("companies"),
    title: v.string(),
    messages: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("aiChatSessions", {
      companyId: args.companyId,
      title: args.title,
      messages: args.messages,
      lastMessageAt: Date.now(),
    });
  },
});

/**
 * Update chat session messages.
 */
export const updateChatSession = mutation({
  args: {
    sessionId: v.id("aiChatSessions"),
    messages: v.string(),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: { messages: string; lastMessageAt: number; title?: string } = {
      messages: args.messages,
      lastMessageAt: Date.now(),
    };
    if (args.title) updates.title = args.title;
    await ctx.db.patch(args.sessionId, updates);
  },
});

/**
 * Delete a chat session.
 */
export const deleteChatSession = mutation({
  args: { sessionId: v.id("aiChatSessions") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.sessionId);
  },
});

/**
 * List chat sessions for a company.
 */
export const listChatSessions = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("aiChatSessions")
      .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
      .order("desc")
      .take(50);
    // Return without messages blob for the list view
    return sessions.map((s) => ({
      _id: s._id,
      _creationTime: s._creationTime,
      title: s.title,
      lastMessageAt: s.lastMessageAt,
    }));
  },
});

/**
 * Get a single chat session with messages.
 */
export const getChatSession = query({
  args: { sessionId: v.id("aiChatSessions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sessionId);
  },
});

/**
 * Record an AI insight request (called by the API route after Claude responds).
 */
export const recordRequest = mutation({
  args: {
    companyId: v.id("companies"),
    insightType: insightTypeValidator,
    prompt: v.string(),
    response: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    costCents: v.number(),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    const company = await ctx.db.get(args.companyId);
    if (!company) throw new Error("Company not found");

    return await ctx.db.insert("aiInsightRequests", args);
  },
});

/**
 * Get AI usage summary for a company (total requests, tokens, cost).
 */
export const getUsageSummary = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const requests = await ctx.db
      .query("aiInsightRequests")
      .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
      .order("desc")
      .take(200);

    // Find already-billed request IDs by looking at paid/billed bills
    const bills = await ctx.db
      .query("aiUsageBills")
      .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
      .order("desc")
      .take(100);

    const billedUpTo = bills.length > 0
      ? Math.max(...bills.map((b) => b.periodEnd))
      : 0;

    let totalRequests = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCostCents = 0;
    let unbilledRequests = 0;
    let unbilledCostCents = 0;

    for (const req of requests) {
      totalRequests++;
      totalInputTokens += req.inputTokens;
      totalOutputTokens += req.outputTokens;
      totalCostCents += req.costCents;

      if (req._creationTime > billedUpTo) {
        unbilledRequests++;
        unbilledCostCents += req.costCents;
      }
    }

    return {
      totalRequests,
      totalInputTokens,
      totalOutputTokens,
      totalCostCents,
      unbilledRequests,
      unbilledCostCents,
      billedUpTo,
    };
  },
});

/**
 * List recent AI insight requests for a company.
 */
export const listRequests = query({
  args: {
    companyId: v.id("companies"),
    insightType: v.optional(insightTypeValidator),
  },
  handler: async (ctx, args) => {
    if (args.insightType) {
      return await ctx.db
        .query("aiInsightRequests")
        .withIndex("by_companyId_and_insightType", (q) =>
          q.eq("companyId", args.companyId).eq("insightType", args.insightType!)
        )
        .order("desc")
        .take(50);
    }
    return await ctx.db
      .query("aiInsightRequests")
      .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
      .order("desc")
      .take(50);
  },
});

/**
 * Create a bill for unbilled AI usage.
 */
export const createBill = mutation({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const bills = await ctx.db
      .query("aiUsageBills")
      .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
      .order("desc")
      .take(100);

    const billedUpTo = bills.length > 0
      ? Math.max(...bills.map((b) => b.periodEnd))
      : 0;

    const requests = await ctx.db
      .query("aiInsightRequests")
      .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
      .order("desc")
      .take(200);

    const unbilled = requests.filter((r) => r._creationTime > billedUpTo);
    if (unbilled.length === 0) throw new Error("No unbilled AI usage");

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCostCents = 0;
    let periodStart = Infinity;
    let periodEnd = 0;

    for (const req of unbilled) {
      totalInputTokens += req.inputTokens;
      totalOutputTokens += req.outputTokens;
      totalCostCents += req.costCents;
      if (req._creationTime < periodStart) periodStart = req._creationTime;
      if (req._creationTime > periodEnd) periodEnd = req._creationTime;
    }

    // Minimum bill of $0.01
    if (totalCostCents < 1) totalCostCents = 1;

    const billId = await ctx.db.insert("aiUsageBills", {
      companyId: args.companyId,
      totalRequests: unbilled.length,
      totalInputTokens,
      totalOutputTokens,
      totalCostCents,
      status: "pending",
      periodStart,
      periodEnd,
    });

    return { billId, totalCostCents, totalRequests: unbilled.length };
  },
});

/**
 * Attach WC Pay checkout URL to a bill.
 */
export const attachCheckout = mutation({
  args: {
    billId: v.id("aiUsageBills"),
    checkoutUrl: v.string(),
    wcPayPaymentId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.billId, {
      status: "billed",
      checkoutUrl: args.checkoutUrl,
      wcPayPaymentId: args.wcPayPaymentId,
      billedAt: Date.now(),
    });
  },
});

/**
 * Mark a bill as paid.
 */
export const markBillPaid = mutation({
  args: { billId: v.id("aiUsageBills") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.billId, {
      status: "paid",
      paidAt: Date.now(),
    });
  },
});

/**
 * List bills for a company.
 */
export const listBills = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("aiUsageBills")
      .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
      .order("desc")
      .take(50);
  },
});

/**
 * Get all business data for AI analysis context.
 */
export const getBusinessContext = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const [
      company,
      employees,
      customers,
      products,
      employeePayments,
      customerPayments,
      usageTabs,
      balance,
    ] = await Promise.all([
      ctx.db.get(args.companyId),
      ctx.db
        .query("employees")
        .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
        .take(200),
      ctx.db
        .query("customers")
        .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
        .take(200),
      ctx.db
        .query("products")
        .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
        .take(100),
      ctx.db
        .query("employeePayments")
        .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
        .order("desc")
        .take(200),
      ctx.db
        .query("customerPayments")
        .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
        .order("desc")
        .take(200),
      ctx.db
        .query("usageTabs")
        .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
        .order("desc")
        .take(200),
      ctx.db
        .query("companyBalances")
        .withIndex("by_companyId_and_currency", (q) =>
          q.eq("companyId", args.companyId).eq("currency", "USD")
        )
        .unique(),
    ]);

    return {
      company,
      employees: employees.map((e) => ({
        displayName: e.displayName,
        role: e.role,
        employmentType: e.employmentType,
        status: e.status,
        privacyLevel: e.privacyLevel,
      })),
      customers: customers.map((c) => ({
        displayName: c.displayName,
        customerType: c.customerType,
        pricingModel: c.pricingModel,
        billingState: c.billingState,
      })),
      products: products.map((p) => ({
        name: p.name,
        description: p.description,
        pricingModel: p.pricingModel,
        unitPriceCents: p.unitPriceCents,
        billingUnit: p.billingUnit,
        isActive: p.isActive,
      })),
      employeePaymentsSummary: {
        total: employeePayments.length,
        settled: employeePayments.filter((p) => p.status === "settled").length,
        totalSettledCents: employeePayments
          .filter((p) => p.status === "settled")
          .reduce((sum, p) => sum + p.amountCents, 0),
        draft: employeePayments.filter((p) => p.status === "draft").length,
        failed: employeePayments.filter((p) => p.status === "failed").length,
      },
      customerPaymentsSummary: {
        total: customerPayments.length,
        paid: customerPayments.filter((p) => p.status === "paid").length,
        totalPaidCents: customerPayments
          .filter((p) => p.status === "paid")
          .reduce((sum, p) => sum + p.amountCents, 0),
        pending: customerPayments.filter((p) => p.status === "pending").length,
        overdue: customerPayments.filter((p) => p.status === "overdue").length,
      },
      usageTabsSummary: {
        total: usageTabs.length,
        open: usageTabs.filter((t) => t.status === "open").length,
        totalOpenCents: usageTabs
          .filter((t) => t.status === "open")
          .reduce((sum, t) => sum + t.totalCents, 0),
        paid: usageTabs.filter((t) => t.status === "paid").length,
        totalPaidCents: usageTabs
          .filter((t) => t.status === "paid")
          .reduce((sum, t) => sum + t.totalCents, 0),
      },
      treasuryBalanceCents: balance
        ? balance.totalCreditedCents - balance.totalDebitedCents
        : 0,
    };
  },
});
