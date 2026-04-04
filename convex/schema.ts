import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ─── Users (one per wallet identity) ───
  users: defineTable({
    walletAddress: v.string(),
    displayName: v.optional(v.string()),
    email: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  }).index("by_walletAddress", ["walletAddress"]),

  // ─── Company Members (many-to-many: users ↔ companies) ───
  companyMembers: defineTable({
    userId: v.id("users"),
    companyId: v.id("companies"),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
  })
    .index("by_userId", ["userId"])
    .index("by_companyId", ["companyId"])
    .index("by_userId_and_companyId", ["userId", "companyId"]),

  // ─── Business Profiles (1:1 per user, gates dashboard access) ───
  businessProfiles: defineTable({
    userId: v.id("users"),
    businessName: v.string(),
    description: v.optional(v.string()),
    industry: v.optional(v.string()),
    website: v.optional(v.string()),
    payrollContractAddress: v.optional(v.string()),
  }).index("by_userId", ["userId"]),

  // ─── Onboarding Wizard State (persisted across refreshes) ───
  onboardingState: defineTable({
    userId: v.id("users"),
    step: v.union(
      v.literal("details"),
      v.literal("deploy"),
      v.literal("done")
    ),
    businessName: v.string(),
    description: v.optional(v.string()),
    industry: v.optional(v.string()),
    website: v.optional(v.string()),
    deployTxHash: v.optional(v.string()),
    deployedAddress: v.optional(v.string()),
  }).index("by_userId", ["userId"]),

  // ─── Companies ───
  companies: defineTable({
    name: v.string(),
    slug: v.string(),
    ownerId: v.id("users"),
    treasuryAddress: v.optional(v.string()),
    industry: v.optional(v.string()),
    website: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    payrollContractAddress: v.optional(v.string()),
  })
    .index("by_ownerId", ["ownerId"])
    .index("by_slug", ["slug"]),

  // ─── Employees ───
  employees: defineTable({
    companyId: v.id("companies"),
    displayName: v.string(),
    role: v.string(),
    employmentType: v.union(
      v.literal("full-time"),
      v.literal("part-time"),
      v.literal("contractor"),
      v.literal("freelance")
    ),
    // Legacy flat comp fields — optional for backward compat; new employees use compensationLines
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
    walletAddress: v.optional(v.string()),
    backupWalletAddress: v.optional(v.string()),
    walletVerified: v.boolean(),
    privacyLevel: v.union(
      v.literal("pseudonymous"),
      v.literal("verified"),
      v.literal("shielded")
    ),
    // Identity vault (concealed by default)
    legalName: v.optional(v.string()),
    taxId: v.optional(v.string()),
    jurisdiction: v.optional(v.string()),
    email: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("inactive")
    ),
    startDate: v.optional(v.number()),
  })
    .index("by_companyId", ["companyId"])
    .index("by_companyId_and_status", ["companyId", "status"])
    .index("by_walletAddress", ["walletAddress"]),

  // ─── Compensation Lines (salaries, one-to-many per employee) ───
  compensationLines: defineTable({
    employeeId: v.id("employees"),
    companyId: v.id("companies"),
    name: v.string(),
    description: v.optional(v.string()),
    amountCents: v.number(),
    asset: v.string(),
    frequency: v.union(
      v.literal("monthly"),
      v.literal("biweekly"),
      v.literal("weekly")
    ),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    isActive: v.boolean(),
  })
    .index("by_employeeId", ["employeeId"])
    .index("by_companyId", ["companyId"])
    .index("by_employeeId_and_isActive", ["employeeId", "isActive"]),

  // ─── Customers ───
  customers: defineTable({
    companyId: v.id("companies"),
    displayName: v.string(),
    customerType: v.union(
      v.literal("company"),
      v.literal("app"),
      v.literal("agent"),
      v.literal("buyer")
    ),
    pricingModel: v.union(
      v.literal("usage"),
      v.literal("invoice"),
      v.literal("one-time"),
      v.literal("subscription")
    ),
    billingState: v.union(
      v.literal("active"),
      v.literal("overdue"),
      v.literal("paused"),
      v.literal("churned")
    ),
    walletAddress: v.optional(v.string()),
    walletReady: v.boolean(),
    email: v.optional(v.string()),
    contactName: v.optional(v.string()),
    fullName: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    country: v.optional(v.string()),
    notes: v.optional(v.string()),
  })
    .index("by_companyId", ["companyId"])
    .index("by_companyId_and_billingState", ["companyId", "billingState"])
    .index("by_companyId_and_walletAddress", ["companyId", "walletAddress"]),

  // ─── Products ───
  products: defineTable({
    companyId: v.id("companies"),
    name: v.string(),
    description: v.optional(v.string()),
    billingUnit: v.string(),
    pricingModel: v.union(
      v.literal("per-unit"),
      v.literal("tiered"),
      v.literal("flat"),
      v.literal("usage-commit")
    ),
    unitPriceCents: v.number(),
    currency: v.union(v.literal("USD"), v.literal("EUR")),
    settlementAsset: v.string(),
    privacyMode: v.union(
      v.literal("standard"),
      v.literal("shielded"),
      v.literal("pseudonymous")
    ),
    refundPolicy: v.union(
      v.literal("no-refund"),
      v.literal("partial"),
      v.literal("full")
    ),
    webhookUrl: v.optional(v.string()),
    isActive: v.boolean(),
  })
    .index("by_companyId", ["companyId"])
    .index("by_companyId_and_isActive", ["companyId", "isActive"]),

  // ─── Employee Payments (outbound) ───
  employeePayments: defineTable({
    companyId: v.id("companies"),
    employeeId: v.id("employees"),
    type: v.union(
      v.literal("salary"),
      v.literal("freelance"),
      v.literal("bonus"),
      v.literal("reimbursement"),
      v.literal("credit")
    ),
    amountCents: v.number(),
    currency: v.union(v.literal("USD"), v.literal("EUR")),
    status: v.union(
      v.literal("draft"),
      v.literal("approved"),
      v.literal("queued"),
      v.literal("settled"),
      v.literal("failed")
    ),
    description: v.optional(v.string()),
    scheduledDate: v.optional(v.number()),
    settledAt: v.optional(v.number()),
    txHash: v.optional(v.string()),
    batchId: v.optional(v.string()),
    compensationLineId: v.optional(v.id("compensationLines")),
  })
    .index("by_companyId", ["companyId"])
    .index("by_companyId_and_status", ["companyId", "status"])
    .index("by_employeeId", ["employeeId"])
    .index("by_compensationLineId", ["compensationLineId"]),

  // ─── Checkout Links (public purchase URLs for products) ───
  checkoutLinks: defineTable({
    companyId: v.id("companies"),
    productId: v.id("products"),
    slug: v.string(),
    label: v.optional(v.string()),
    isActive: v.boolean(),
  })
    .index("by_slug", ["slug"])
    .index("by_productId", ["productId"])
    .index("by_companyId", ["companyId"]),

  // ─── Customer Payments (inbound) ───
  customerPayments: defineTable({
    companyId: v.id("companies"),
    customerId: v.optional(v.id("customers")),
    productId: v.optional(v.id("products")),
    mode: v.union(
      v.literal("usage"),
      v.literal("invoice"),
      v.literal("one-time"),
      v.literal("checkout")
    ),
    amountCents: v.number(),
    currency: v.union(v.literal("USD"), v.literal("EUR")),
    status: v.union(
      v.literal("draft"),
      v.literal("sent"),
      v.literal("pending"),
      v.literal("paid"),
      v.literal("overdue"),
      v.literal("cancelled")
    ),
    description: v.optional(v.string()),
    dueDate: v.optional(v.number()),
    paidAt: v.optional(v.number()),
    txHash: v.optional(v.string()),
    referenceId: v.optional(v.string()),
    // WalletConnect Pay fields
    wcPayPaymentId: v.optional(v.string()),
    wcPayGatewayUrl: v.optional(v.string()),
    quantity: v.optional(v.number()),
  })
    .index("by_companyId", ["companyId"])
    .index("by_companyId_and_status", ["companyId", "status"])
    .index("by_customerId", ["customerId"])
    .index("by_productId", ["productId"])
    .index("by_referenceId", ["referenceId"]),

  // ─── Treasury / Company Balances ───
  companyBalances: defineTable({
    companyId: v.id("companies"),
    totalCreditedCents: v.number(),
    totalDebitedCents: v.number(),
    currency: v.union(v.literal("USD"), v.literal("EUR")),
  })
    .index("by_companyId", ["companyId"])
    .index("by_companyId_and_currency", ["companyId", "currency"]),

  // ─── Balance Ledger Entries (audit trail) ───
  balanceEntries: defineTable({
    companyId: v.id("companies"),
    type: v.union(v.literal("credit"), v.literal("debit")),
    amountCents: v.number(),
    currency: v.union(v.literal("USD"), v.literal("EUR")),
    reason: v.string(),
    relatedPaymentId: v.optional(v.string()),
    occurredAt: v.optional(v.number()),
  }).index("by_companyId", ["companyId"]),

  // ─── Credit Settings (per company) ───
  creditSettings: defineTable({
    companyId: v.id("companies"),
    enabled: v.boolean(),
    interestRateBps: v.number(), // basis points, e.g. 200 = 2%
    maxCreditPercent: v.number(), // 0-100, max % of next paycheck
    autoDisableThresholdMonths: v.number(), // disable credits if treasury < N months of payroll
    autoDisabled: v.boolean(), // set by cron when threshold breached
  }).index("by_companyId", ["companyId"]),

  // ─── Credit Requests (employee → company) ───
  creditRequests: defineTable({
    companyId: v.id("companies"),
    employeeId: v.id("employees"),
    requestedAmountCents: v.number(),
    interestAmountCents: v.number(), // calculated at request time
    netAmountCents: v.number(), // requestedAmountCents - interestAmountCents
    currency: v.union(v.literal("USD"), v.literal("EUR")),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("denied"),
      v.literal("settled"), // credit paid out
      v.literal("deducted"), // deducted from next paycheck
      v.literal("cancelled")
    ),
    reason: v.optional(v.string()),
    denyReason: v.optional(v.string()),
    creditPaymentId: v.optional(v.id("employeePayments")),
    deductedFromPaymentId: v.optional(v.id("employeePayments")),
    nextPaycheckDate: v.number(),
    nextPaycheckAmountCents: v.number(),
  })
    .index("by_companyId", ["companyId"])
    .index("by_companyId_and_status", ["companyId", "status"])
    .index("by_employeeId", ["employeeId"])
    .index("by_employeeId_and_status", ["employeeId", "status"]),
});
