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
 * Nuke all data for a company (keeps the company + user + membership).
 *
 * Usage:
 *   npx convex run seedData:nukeCompanyData '{"wallet": "0x..."}'
 */
export const nukeCompanyData = mutation({
  args: { wallet: v.string() },
  handler: async (ctx, args) => {
    const companyId = await resolveCompany(ctx, args.wallet);

    // Tables with by_companyId index
    const tables = [
      "employees",
      "compensationLines",
      "employeePayments",
      "customers",
      "customerPayments",
      "products",
      "checkoutLinks",
      "companyBalances",
      "balanceEntries",
      "creditRequests",
      "creditSettings",
    ] as const;

    let total = 0;
    for (const table of tables) {
      const rows = await ctx.db
        .query(table)
        .withIndex("by_companyId", (q: any) => q.eq("companyId", companyId))
        .take(500);
      for (const row of rows) {
        await ctx.db.delete(row._id);
        total++;
      }
    }

    // compensationSplits uses by_employeeId, not by_companyId — already deleted via cascade
    // but clean up any orphans
    const splits = await ctx.db.query("compensationSplits").take(500);
    for (const s of splits) {
      const line = await ctx.db.get(s.compensationLineId);
      if (!line) { await ctx.db.delete(s._id); total++; }
    }

    return { companyId, deletedRows: total };
  },
});

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

    // ─── Treasury balance (seed companyBalances) ───
    // $85,000 USDC credited, $32,000 debited → $53,000 available
    const existingUsd = await ctx.db
      .query("companyBalances")
      .withIndex("by_companyId_and_currency", (q: any) => q.eq("companyId", companyId).eq("currency", "USD"))
      .unique();
    if (!existingUsd) {
      await ctx.db.insert("companyBalances", {
        companyId,
        currency: "USD",
        availableCents: 5300000,
        totalCreditedCents: 8500000,
        totalDebitedCents: 3200000,
      });
    }

    // €25,000 EURC credited, €9,500 debited → €15,500 available
    const existingEur = await ctx.db
      .query("companyBalances")
      .withIndex("by_companyId_and_currency", (q: any) => q.eq("companyId", companyId).eq("currency", "EUR"))
      .unique();
    if (!existingEur) {
      await ctx.db.insert("companyBalances", {
        companyId,
        currency: "EUR",
        availableCents: 1550000,
        totalCreditedCents: 2500000,
        totalDebitedCents: 950000,
      });
    }

    // ─── Ledger entries ───
    await ctx.db.insert("balanceEntries", {
      companyId, type: "credit", amountCents: 5000000, currency: "USD",
      reason: "Initial treasury deposit — USDC", occurredAt: now - 30 * day,
    });
    await ctx.db.insert("balanceEntries", {
      companyId, type: "credit", amountCents: 3500000, currency: "USD",
      reason: "Customer payments — March batch", occurredAt: now - 15 * day,
    });
    await ctx.db.insert("balanceEntries", {
      companyId, type: "debit", amountCents: 3200000, currency: "USD",
      reason: "March payroll settlement", occurredAt: now - 5 * day,
    });
    await ctx.db.insert("balanceEntries", {
      companyId, type: "credit", amountCents: 2500000, currency: "EUR",
      reason: "Initial EURC deposit", occurredAt: now - 25 * day,
    });
    await ctx.db.insert("balanceEntries", {
      companyId, type: "debit", amountCents: 950000, currency: "EUR",
      reason: "March contractor payment — EURC", occurredAt: now - 5 * day,
    });

    // ─── Employees (realistic salaries in cents) ───
    const employees = [
      { displayName: "Elena Vasquez", role: "Lead Engineer", employmentType: "full-time" as const, email: "elena@arcdemo.co", salaryCents: 1100000, asset: "USDC" },
      { displayName: "Marcus Chen", role: "Product Designer", employmentType: "full-time" as const, salaryCents: 850000, asset: "USDC" },
      { displayName: "Aria Nakamura", role: "Backend Dev", employmentType: "contractor" as const, salaryCents: 750000, asset: "USDC" },
      { displayName: "James Whitfield", role: "DevOps", employmentType: "full-time" as const, salaryCents: 900000, asset: "USDC" },
      { displayName: "Sofia Reyes", role: "Data Analyst", employmentType: "part-time" as const, salaryCents: 450000, asset: "USDC" },
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
        payoutAsset: emp.asset,
        compensationModel: "salary" as const,
        payoutAmountCents: emp.salaryCents,
        payoutFrequency: "monthly" as const,
        nextPaymentDate: now + 15 * day,
      });
      empIds.push(id);
    }

    // ─── Customers ───
    const custIds = [];
    const customers = [
      { displayName: "Northwind Labs", customerType: "company" as const, email: "billing@northwind.io" },
      { displayName: "Synthex AI", customerType: "app" as const, email: "ops@synthex.ai" },
      { displayName: "AutoAgent-7", customerType: "agent" as const },
    ];

    for (const cust of customers) {
      const id = await ctx.db.insert("customers", {
        companyId,
        displayName: cust.displayName,
        customerType: cust.customerType,
        pricingModel: "usage" as const,
        billingState: "active" as const,
        walletReady: true,
        email: cust.email,
      });
      custIds.push(id);
    }

    // ─── Products ───
    const products = [
      { name: "API Access", billingUnit: "1K requests", priceCents: 5000, currency: "USD" as const },
      { name: "Pro License", billingUnit: "license", priceCents: 1500000, currency: "USD" as const },
      { name: "Event Pass", billingUnit: "ticket", priceCents: 2500000, currency: "USD" as const },
    ];

    for (const prod of products) {
      await ctx.db.insert("products", {
        companyId,
        name: prod.name,
        billingUnit: prod.billingUnit,
        pricingModel: "per-unit" as const,
        unitPriceCents: prod.priceCents,
        currency: prod.currency,
        settlementAsset: prod.currency === "EUR" ? "EURC" : "USDC",
        privacyMode: "standard" as const,
        refundPolicy: "no-refund" as const,
        isActive: true,
      });
    }

    // ─── Employee Payments (settled March + draft/approved April) ───
    // March settled — all 5 employees
    for (let i = 0; i < 5; i++) {
      await ctx.db.insert("employeePayments", {
        companyId,
        employeeId: empIds[i],
        type: "salary",
        amountCents: employees[i].salaryCents,
        currency: "USD",
        status: "settled",
        description: `March salary — ${employees[i].displayName}`,
        settledAt: now - 5 * day,
      });
    }

    // April — 3 draft, 1 approved
    for (let i = 0; i < 3; i++) {
      await ctx.db.insert("employeePayments", {
        companyId,
        employeeId: empIds[i],
        type: "salary",
        amountCents: employees[i].salaryCents,
        currency: "USD",
        status: "draft",
        description: `April salary — ${employees[i].displayName}`,
        scheduledDate: now + 15 * day,
      });
    }
    await ctx.db.insert("employeePayments", {
      companyId,
      employeeId: empIds[3],
      type: "salary",
      amountCents: employees[3].salaryCents,
      currency: "USD",
      status: "approved",
      description: `April salary — ${employees[3].displayName}`,
      scheduledDate: now + 15 * day,
    });

    // Bonus payment
    await ctx.db.insert("employeePayments", {
      companyId,
      employeeId: empIds[0],
      type: "bonus",
      amountCents: 250000,
      currency: "USD",
      status: "settled",
      description: "Q1 performance bonus — Elena Vasquez",
      settledAt: now - 3 * day,
    });

    // ─── Customer Payments (paid, pending, overdue) ───
    // Paid — Northwind Labs (today!)
    await ctx.db.insert("customerPayments", {
      companyId,
      customerId: custIds[0],
      mode: "invoice" as const,
      amountCents: 1500000,
      currency: "USD",
      status: "paid",
      description: "Northwind Labs — March invoice",
      paidAt: now - 2 * day,
    });
    await ctx.db.insert("customerPayments", {
      companyId,
      customerId: custIds[0],
      mode: "usage" as const,
      amountCents: 350000,
      currency: "USD",
      status: "paid",
      description: "Northwind Labs — API usage March",
      paidAt: now,
    });

    // Paid today — Synthex AI
    await ctx.db.insert("customerPayments", {
      companyId,
      customerId: custIds[1],
      mode: "usage" as const,
      amountCents: 180000,
      currency: "USD",
      status: "paid",
      description: "Synthex AI — API usage settlement",
      paidAt: now,
    });

    // Pending — AutoAgent-7
    await ctx.db.insert("customerPayments", {
      companyId,
      customerId: custIds[2],
      mode: "usage" as const,
      amountCents: 75000,
      currency: "USD",
      status: "pending",
      description: "AutoAgent-7 — metered session fees",
    });

    // Pending EUR
    await ctx.db.insert("customerPayments", {
      companyId,
      customerId: custIds[1],
      mode: "invoice" as const,
      amountCents: 420000,
      currency: "EUR",
      status: "sent",
      description: "Synthex AI — EU operations invoice (EURC)",
    });

    // Overdue
    await ctx.db.insert("customerPayments", {
      companyId,
      customerId: custIds[2],
      mode: "invoice" as const,
      amountCents: 250000,
      currency: "USD",
      status: "overdue",
      description: "AutoAgent-7 — February invoice (overdue)",
      dueDate: now - 10 * day,
    });

    // ─── Credit (advance) request ───
    await ctx.db.insert("creditRequests", {
      companyId,
      employeeId: empIds[2],
      requestedCents: 375000,
      interestRateBps: 500,
      interestCents: 18750,
      netCents: 356250,
      status: "pending" as const,
      requestedAt: now - 1 * day,
    });

    return {
      companyId,
      employees: empIds.length,
      customers: custIds.length,
      products: products.length,
      message: "Full demo seeded: $53K USDC + €15.5K EURC treasury, 5 employees, 3 customers, 6 customer payments, 1 advance request",
    };
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
