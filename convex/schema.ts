import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const privacyState = v.union(
  v.literal("Pseudonymous"),
  v.literal("Verified"),
  v.literal("Shielded"),
  v.literal("Multi-wallet"),
);

export default defineSchema({
  businesses: defineTable({
    createdAt: v.number(),
    name: v.string(),
    ownerTokenIdentifier: v.string(),
    privacyState,
    slug: v.string(),
    updatedAt: v.number(),
  }).index("by_owner_token_identifier", ["ownerTokenIdentifier"]),
  operators: defineTable({
    alias: v.string(),
    caip2Network: v.optional(v.string()),
    createdAt: v.number(),
    email: v.optional(v.string()),
    lastSeenAt: v.number(),
    privacyState,
    reownProfileUuid: v.optional(v.string()),
    reownProjectIdKey: v.optional(v.string()),
    reownProjectUuid: v.optional(v.string()),
    reownSubject: v.optional(v.string()),
    tokenIdentifier: v.string(),
    updatedAt: v.number(),
    walletAddress: v.optional(v.string()),
    walletAddressLower: v.optional(v.string()),
  })
    .index("by_token_identifier", ["tokenIdentifier"])
    .index("by_wallet_address_lower", ["walletAddressLower"]),
});
