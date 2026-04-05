import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Helper to resolve wallet → companyId
 */
async function resolveCompany(ctx: any, wallet: string) {
  const user = await ctx.db
    .query("users")
    .withIndex("by_walletAddress", (q: any) => q.eq("walletAddress", wallet))
    .unique();
  if (!user) throw new Error("No user found for this wallet");
  const membership = await ctx.db
    .query("companyMembers")
    .withIndex("by_userId", (q: any) => q.eq("userId", user._id))
    .first();
  if (!membership) throw new Error("No company found for this wallet");
  return membership.companyId;
}

/**
 * Add an employee.
 *
 * Usage:
 *   npx convex run seedData:addEmployee '{
 *     "wallet": "0x...",
 *     "displayName": "Alice Martin",
 *     "role": "Engineer",
 *     "employmentType": "full-time",
 *     "email": "alice@example.com",
 *     "employeeWallet": "0x1234..."
 *   }'
 */
export const addEmployee = mutation({
  args: {
    wallet: v.string(),
    displayName: v.string(),
    role: v.string(),
    employmentType: v.union(
      v.literal("full-time"),
      v.literal("part-time"),
      v.literal("contractor"),
      v.literal("freelance")
    ),
    email: v.optional(v.string()),
    employeeWallet: v.optional(v.string()),
    salaryAmountCents: v.optional(v.number()),
    salaryFrequency: v.optional(v.union(
      v.literal("monthly"),
      v.literal("biweekly"),
      v.literal("weekly")
    )),
    payoutAsset: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const companyId = await resolveCompany(ctx, args.wallet);

    const employeeId = await ctx.db.insert("employees", {
      companyId,
      displayName: args.displayName,
      role: args.role,
      employmentType: args.employmentType,
      walletVerified: !!args.employeeWallet,
      privacyLevel: "verified" as const,
      status: "active" as const,
      email: args.email,
      walletAddress: args.employeeWallet,
      payoutAsset: args.payoutAsset ?? "USDC",
    });

    // Create compensation line if salary provided
    if (args.salaryAmountCents) {
      await ctx.db.insert("compensationLines", {
        employeeId,
        companyId,
        name: "Base Salary",
        amountCents: args.salaryAmountCents,
        asset: args.payoutAsset ?? "USDC",
        frequency: args.salaryFrequency ?? "monthly",
        isActive: true,
      });
    }

    return { employeeId };
  },
});

/**
 * Add a customer.
 *
 * Usage:
 *   npx convex run seedData:addCustomer '{
 *     "wallet": "0x...",
 *     "displayName": "Acme Corp",
 *     "customerType": "company",
 *     "email": "billing@acme.io",
 *     "contactName": "John Doe"
 *   }'
 */
export const addCustomer = mutation({
  args: {
    wallet: v.string(),
    displayName: v.string(),
    customerType: v.union(
      v.literal("company"),
      v.literal("app"),
      v.literal("agent"),
      v.literal("buyer")
    ),
    email: v.optional(v.string()),
    contactName: v.optional(v.string()),
    customerWallet: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const companyId = await resolveCompany(ctx, args.wallet);

    const customerId = await ctx.db.insert("customers", {
      companyId,
      displayName: args.displayName,
      customerType: args.customerType,
      pricingModel: "invoice" as const,
      billingState: "active" as const,
      walletReady: !!args.customerWallet,
      email: args.email,
      contactName: args.contactName,
      walletAddress: args.customerWallet,
    });

    return { customerId };
  },
});

/**
 * Add a product.
 *
 * Usage:
 *   npx convex run seedData:addProduct '{
 *     "wallet": "0x...",
 *     "name": "API Access",
 *     "billingUnit": "1K requests",
 *     "priceCents": 50,
 *     "description": "Pay-per-use API"
 *   }'
 */
export const addProduct = mutation({
  args: {
    wallet: v.string(),
    name: v.string(),
    billingUnit: v.string(),
    priceCents: v.number(),
    description: v.optional(v.string()),
    pricingModel: v.optional(v.union(
      v.literal("per-unit"),
      v.literal("pay-as-you-go")
    )),
  },
  handler: async (ctx, args) => {
    const companyId = await resolveCompany(ctx, args.wallet);

    const productId = await ctx.db.insert("products", {
      companyId,
      name: args.name,
      description: args.description,
      billingUnit: args.billingUnit,
      pricingModel: args.pricingModel ?? "per-unit",
      unitPriceCents: args.priceCents,
      currency: "USD" as const,
      settlementAsset: "USDC",
      privacyMode: "standard" as const,
      refundPolicy: "no-refund" as const,
      isActive: true,
    });

    return { productId };
  },
});

/**
 * Add a payment (employee outbound).
 *
 * Usage:
 *   npx convex run seedData:addPayment '{
 *     "wallet": "0x...",
 *     "employeeId": "...",
 *     "type": "salary",
 *     "amountCents": 95,
 *     "description": "April salary"
 *   }'
 */
export const addPayment = mutation({
  args: {
    wallet: v.string(),
    employeeId: v.id("employees"),
    type: v.union(
      v.literal("salary"),
      v.literal("freelance"),
      v.literal("bonus"),
      v.literal("reimbursement"),
      v.literal("credit")
    ),
    amountCents: v.number(),
    description: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("draft"),
      v.literal("approved"),
      v.literal("settled")
    )),
  },
  handler: async (ctx, args) => {
    const companyId = await resolveCompany(ctx, args.wallet);

    const paymentId = await ctx.db.insert("employeePayments", {
      companyId,
      employeeId: args.employeeId,
      type: args.type,
      amountCents: args.amountCents,
      currency: "USD" as const,
      status: args.status ?? "draft",
      description: args.description,
      ...(args.status === "settled" ? { settledAt: Date.now() } : {}),
    });

    return { paymentId };
  },
});

/**
 * Seed a full demo company with employees, customers, products, and payments.
 *
 * Usage:
 *   npx convex run seedData:seedFullDemo '{"wallet": "0x...", "companyName": "My Demo Co"}'
 */
export const seedFullDemo = mutation({
  args: {
    wallet: v.string(),
    companyName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const companyId = await resolveCompany(ctx, args.wallet);

    const empWallet = "0xba232D9C9A551a60ff20F9f6AA3BBb21FE55F909";
    const day = 86400000;
    const now = Date.now();

    // Employees
    const employees = [
      { displayName: "Elena Vasquez", role: "Lead Engineer", employmentType: "full-time" as const, email: "elena@arcdemo.co", salary: 95 },
      { displayName: "Marcus Chen", role: "Product Designer", employmentType: "full-time" as const, salary: 80 },
      { displayName: "Aria Nakamura", role: "Backend Dev", employmentType: "contractor" as const, salary: 70 },
      { displayName: "James Whitfield", role: "DevOps", employmentType: "full-time" as const, salary: 85 },
      { displayName: "Sofia Reyes", role: "Data Analyst", employmentType: "part-time" as const, salary: 50 },
    ];

    const empIds = [];
    for (const emp of employees) {
      const id = await ctx.db.insert("employees", {
        companyId,
        displayName: emp.displayName,
        role: emp.role,
        employmentType: emp.employmentType,
        walletVerified: true,
        privacyLevel: "verified" as const,
        status: "active" as const,
        email: emp.email,
        walletAddress: empWallet,
      });
      empIds.push(id);

      await ctx.db.insert("compensationLines", {
        employeeId: id,
        companyId,
        name: "Base Salary",
        amountCents: emp.salary,
        asset: "USDC",
        frequency: "monthly",
        isActive: true,
      });
    }

    // Customers
    const customers = [
      { displayName: "Northwind Labs", customerType: "company" as const, email: "billing@northwind.io" },
      { displayName: "Synthex AI", customerType: "app" as const, email: "ops@synthex.ai" },
      { displayName: "AutoAgent-7", customerType: "agent" as const },
    ];

    for (const cust of customers) {
      await ctx.db.insert("customers", {
        companyId,
        displayName: cust.displayName,
        customerType: cust.customerType,
        pricingModel: "usage" as const,
        billingState: "active" as const,
        walletReady: true,
        email: cust.email,
      });
    }

    // Products
    const products = [
      { name: "API Access", billingUnit: "1K requests", priceCents: 50 },
      { name: "Pro License", billingUnit: "license", priceCents: 1500000 },
      { name: "Event Pass", billingUnit: "ticket", priceCents: 25000 },
    ];

    for (const prod of products) {
      await ctx.db.insert("products", {
        companyId,
        name: prod.name,
        billingUnit: prod.billingUnit,
        pricingModel: "per-unit" as const,
        unitPriceCents: prod.priceCents,
        currency: "USD" as const,
        settlementAsset: "USDC",
        privacyMode: "standard" as const,
        refundPolicy: "no-refund" as const,
        isActive: true,
      });
    }

    // Payments
    for (let i = 0; i < 3; i++) {
      await ctx.db.insert("employeePayments", {
        companyId,
        employeeId: empIds[i],
        type: "salary",
        amountCents: employees[i].salary,
        currency: "USD",
        status: "settled",
        description: "March salary",
        settledAt: now - 5 * day,
      });
    }

    await ctx.db.insert("employeePayments", {
      companyId,
      employeeId: empIds[0],
      type: "salary",
      amountCents: employees[0].salary,
      currency: "USD",
      status: "approved",
      description: "April salary",
      scheduledDate: now + 2 * day,
    });

    return { companyId, employees: empIds.length, customers: customers.length, products: products.length };
  },
});

/**
 * Seed a Paris contractor paid in EURC and a US dev paid in USDC.
 * Demonstrates dual-currency payroll — a key differentiator.
 *
 * Usage:
 *   npx convex run seedData:seedDualCurrencyTeam '{"wallet": "0x..."}'
 */
export const seedDualCurrencyTeam = mutation({
  args: {
    wallet: v.string(),
  },
  handler: async (ctx, args) => {
    const companyId = await resolveCompany(ctx, args.wallet);
    const day = 86400000;
    const now = Date.now();

    // US dev — paid in USDC
    const usDevId = await ctx.db.insert("employees", {
      companyId,
      displayName: "Ryan Mitchell",
      role: "Senior Full-Stack Engineer",
      employmentType: "full-time" as const,
      walletVerified: true,
      privacyLevel: "verified" as const,
      status: "active" as const,
      email: "ryan@arcdemo.co",
      walletAddress: "0xba232D9C9A551a60ff20F9f6AA3BBb21FE55F909",
      payoutAsset: "USDC",
      compensationModel: "salary" as const,
      payoutAmountCents: 1200000,
      payoutFrequency: "monthly" as const,
      jurisdiction: "US",
      nextPaymentDate: now + 15 * day,
    });

    await ctx.db.insert("compensationLines", {
      employeeId: usDevId,
      companyId,
      name: "Base Salary",
      amountCents: 1200000,
      asset: "USDC",
      frequency: "monthly",
      isActive: true,
    });

    // Paris contractor — paid in EURC
    const parisDevId = await ctx.db.insert("employees", {
      companyId,
      displayName: "Camille Dupont",
      role: "Smart Contract Auditor",
      employmentType: "contractor" as const,
      walletVerified: true,
      privacyLevel: "verified" as const,
      status: "active" as const,
      email: "camille@arcdemo.co",
      walletAddress: "0xC4e20D8eB3D5A85B6523f6A8C0b2D28E79b03B77",
      payoutAsset: "EURC",
      compensationModel: "salary" as const,
      payoutAmountCents: 950000,
      payoutFrequency: "monthly" as const,
      jurisdiction: "FR",
      nextPaymentDate: now + 15 * day,
    });

    await ctx.db.insert("compensationLines", {
      employeeId: parisDevId,
      companyId,
      name: "Base Salary",
      amountCents: 950000,
      asset: "EURC",
      frequency: "monthly",
      isActive: true,
    });

    // Create payments: settled March + draft April for both
    await ctx.db.insert("employeePayments", {
      companyId,
      employeeId: usDevId,
      type: "salary",
      amountCents: 1200000,
      currency: "USD",
      status: "settled",
      description: "March salary — USDC",
      settledAt: now - 5 * day,
    });

    await ctx.db.insert("employeePayments", {
      companyId,
      employeeId: usDevId,
      type: "salary",
      amountCents: 1200000,
      currency: "USD",
      status: "draft",
      description: "April salary — USDC",
      scheduledDate: now + 15 * day,
    });

    await ctx.db.insert("employeePayments", {
      companyId,
      employeeId: parisDevId,
      type: "salary",
      amountCents: 950000,
      currency: "EUR",
      status: "settled",
      description: "March salary — EURC",
      settledAt: now - 5 * day,
    });

    await ctx.db.insert("employeePayments", {
      companyId,
      employeeId: parisDevId,
      type: "salary",
      amountCents: 950000,
      currency: "EUR",
      status: "draft",
      description: "April salary — EURC",
      scheduledDate: now + 15 * day,
    });

    return {
      companyId,
      usDevId,
      parisDevId,
      message: "Ryan (US, $12K USDC/mo) + Camille (Paris, €9.5K EURC/mo) seeded with March settled + April draft",
    };
  },
});
