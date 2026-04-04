import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// ─── API Key Management ───

export const generateApiKey = mutation({
  args: {
    companyId: v.id("companies"),
    customerId: v.id("customers"),
    label: v.string(),
    rateLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const customer = await ctx.db.get(args.customerId);
    if (!customer) throw new Error("Customer not found");
    if (customer.companyId !== args.companyId) {
      throw new Error("Customer does not belong to this company");
    }

    // Generate random API key: "ak_" + 32 hex chars
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const apiKey = `ak_${hex}`;

    await ctx.db.insert("agentApiKeys", {
      companyId: args.companyId,
      customerId: args.customerId,
      apiKey,
      label: args.label,
      rateLimit: args.rateLimit,
      isActive: true,
    });

    return { apiKey };
  },
});

export const validateApiKey = query({
  args: { apiKey: v.string() },
  handler: async (ctx, args) => {
    const key = await ctx.db
      .query("agentApiKeys")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", args.apiKey))
      .first();

    if (!key || !key.isActive) return null;
    return key;
  },
});

export const touchApiKeyLastUsed = internalMutation({
  args: { id: v.id("agentApiKeys") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { lastUsedAt: Date.now() });
  },
});

export const revokeApiKey = mutation({
  args: { id: v.id("agentApiKeys") },
  handler: async (ctx, args) => {
    const key = await ctx.db.get(args.id);
    if (!key) throw new Error("API key not found");
    await ctx.db.patch(args.id, { isActive: false });
  },
});

export const listApiKeys = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const keys = await ctx.db
      .query("agentApiKeys")
      .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
      .take(100);

    return keys.map((key) => ({
      ...key,
      apiKey: key.apiKey.slice(0, 7) + "...",
    }));
  },
});

// ─── Session Lifecycle ───

export const startSession = mutation({
  args: {
    apiKeyId: v.id("agentApiKeys"),
    productId: v.id("products"),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const apiKey = await ctx.db.get(args.apiKeyId);
    if (!apiKey || !apiKey.isActive) {
      throw new Error("API key not found or inactive");
    }

    const product = await ctx.db.get(args.productId);
    if (!product || !product.isActive) {
      throw new Error("Product not found or inactive");
    }
    if (product.companyId !== apiKey.companyId) {
      throw new Error("Product does not belong to this company");
    }

    // Generate sessionId if not provided
    const sessionId = args.sessionId ?? (() => {
      const bytes = new Uint8Array(8);
      crypto.getRandomValues(bytes);
      const hex = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      return `ses_${hex}`;
    })();

    // Create a usage tab for this session
    const tabId = await ctx.db.insert("usageTabs", {
      companyId: apiKey.companyId,
      productId: args.productId,
      customerIdentifier: apiKey.customerId,
      totalUnits: 0,
      totalCents: 0,
      status: "open",
    });

    const now = Date.now();
    const id = await ctx.db.insert("agentSessions", {
      companyId: apiKey.companyId,
      customerId: apiKey.customerId,
      apiKeyId: args.apiKeyId,
      productId: args.productId,
      tabId,
      sessionId,
      status: "active",
      totalUnits: 0,
      totalMicroCents: 0,
      startedAt: now,
    });

    return { sessionId, id };
  },
});

export const recordEvent = mutation({
  args: {
    sessionId: v.string(),
    units: v.number(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.units <= 0) throw new Error("Units must be positive");

    const session = await ctx.db
      .query("agentSessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!session) throw new Error("Session not found");
    if (session.status !== "active") {
      throw new Error("Session is not active");
    }

    const product = await ctx.db.get(session.productId);
    if (!product) throw new Error("Product not found");

    // Calculate microCents: units * unitPriceCents * 10000
    const microCents = args.units * product.unitPriceCents * 10000;
    const newTotalUnits = session.totalUnits + args.units;
    const newTotalMicroCents = session.totalMicroCents + microCents;
    const newTotalCents = Math.round(newTotalMicroCents / 10000);

    // Update session
    await ctx.db.patch(session._id, {
      totalUnits: newTotalUnits,
      totalMicroCents: newTotalMicroCents,
    });

    // Update linked usage tab
    if (session.tabId) {
      await ctx.db.patch(session.tabId, {
        totalUnits: newTotalUnits,
        totalCents: newTotalCents,
      });

      // Insert usage entry for audit trail
      await ctx.db.insert("usageEntries", {
        tabId: session.tabId,
        companyId: session.companyId,
        units: args.units,
        amountCents: Math.round(microCents / 10000),
        description: args.description,
      });
    }

    return {
      totalUnits: newTotalUnits,
      totalMicroCents: newTotalMicroCents,
      totalCents: newTotalCents,
    };
  },
});

export const endSession = mutation({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("agentSessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!session) throw new Error("Session not found");
    if (session.status !== "active") {
      throw new Error("Session is not active");
    }

    const now = Date.now();
    await ctx.db.patch(session._id, {
      status: "completed",
      endedAt: now,
    });

    return {
      sessionId: session.sessionId,
      totalUnits: session.totalUnits,
      totalMicroCents: session.totalMicroCents,
      totalCents: Math.round(session.totalMicroCents / 10000),
      startedAt: session.startedAt,
      endedAt: now,
    };
  },
});

// ─── Session Queries ───

export const getSession = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("agentSessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!session) return null;

    const product = await ctx.db.get(session.productId);
    return {
      ...session,
      productName: product?.name ?? null,
    };
  },
});

export const listSessions = query({
  args: {
    companyId: v.id("companies"),
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("completed"),
        v.literal("billed"),
        v.literal("settled")
      )
    ),
  },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("agentSessions")
        .withIndex("by_companyId_and_status", (q) =>
          q.eq("companyId", args.companyId).eq("status", args.status!)
        )
        .order("desc")
        .take(100);
    }
    return await ctx.db
      .query("agentSessions")
      .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId))
      .order("desc")
      .take(100);
  },
});

export const listByCustomer = query({
  args: { customerId: v.id("customers") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentSessions")
      .withIndex("by_customerId", (q) => q.eq("customerId", args.customerId))
      .order("desc")
      .take(100);
  },
});
