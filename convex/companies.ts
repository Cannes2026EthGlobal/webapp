import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get all companies the user is a member of (via companyMembers join)
export const getByUserId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query("companyMembers")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .take(50);

    const companies = await Promise.all(
      memberships.map(async (m) => {
        const company = await ctx.db.get(m.companyId);
        if (!company) return null;
        return { ...company, role: m.role };
      })
    );

    return companies.filter(
      (c): c is NonNullable<typeof c> => c !== null
    );
  },
});

export const getById = query({
  args: { id: v.id("companies") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("companies")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    userId: v.id("users"),
    treasuryAddress: v.optional(v.string()),
    industry: v.optional(v.string()),
    website: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, ...rest } = args;
    const existing = await ctx.db
      .query("companies")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (existing) {
      throw new Error(`Company with slug "${args.slug}" already exists`);
    }
    const companyId = await ctx.db.insert("companies", {
      ownerId: userId,
      ...rest,
    });
    // Automatically make the creator an owner member
    await ctx.db.insert("companyMembers", {
      userId,
      companyId,
      role: "owner",
    });
    return companyId;
  },
});

export const update = mutation({
  args: {
    id: v.id("companies"),
    name: v.optional(v.string()),
    treasuryAddress: v.optional(v.string()),
    industry: v.optional(v.string()),
    website: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const updates: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        updates[key] = value;
      }
    }
    await ctx.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id("companies") },
  handler: async (ctx, args) => {
    // Cascade-delete company memberships
    const members = await ctx.db
      .query("companyMembers")
      .withIndex("by_companyId", (q) => q.eq("companyId", args.id))
      .take(100);
    for (const m of members) {
      await ctx.db.delete(m._id);
    }
    await ctx.db.delete(args.id);
  },
});
