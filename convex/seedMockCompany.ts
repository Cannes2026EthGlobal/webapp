import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { creditBalance, debitBalance } from "./balances";

export const create = mutation({
  args: {
    wallet: v.string(),
    companyName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const name = args.companyName ?? "Mock Corp";
    const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    // Get or create user
    let user = await ctx.db
      .query("users")
      .withIndex("by_walletAddress", (q) => q.eq("walletAddress", args.wallet))
      .unique();
    if (!user) {
      const userId = await ctx.db.insert("users", { walletAddress: args.wallet });
      user = (await ctx.db.get(userId))!;
    }

    const companyId = await ctx.db.insert("companies", {
      name,
      slug,
      ownerId: user._id,
      industry: "Technology",
      website: `https://${slug}.example.com`,
    });

    // Create membership
    await ctx.db.insert("companyMembers", {
      userId: user._id,
      companyId,
      role: "owner",
    });

    const now = Date.now();
    const day = 86400000;

    // ─── Employees ───
    const employees = [
      { displayName: "Alice Martin", role: "Lead Engineer", employmentType: "full-time" as const, status: "active" as const, email: "alice@example.com", walletAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" },
      { displayName: "Bob Johnson", role: "Product Designer", employmentType: "full-time" as const, status: "active" as const, email: "bob@example.com" },
      { displayName: "Carol Williams", role: "Backend Dev", employmentType: "contractor" as const, status: "active" as const, walletAddress: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" },
      { displayName: "David Lee", role: "DevOps", employmentType: "full-time" as const, status: "active" as const },
      { displayName: "Eva Garcia", role: "Data Analyst", employmentType: "part-time" as const, status: "active" as const },
    ];

    const employeeIds = [];
    for (const emp of employees) {
      const id = await ctx.db.insert("employees", {
        companyId,
        ...emp,
        walletVerified: !!emp.walletAddress,
        privacyLevel: "verified" as const,
      });
      employeeIds.push(id);
    }

    // ─── Compensation Lines ───
    for (const line of [
      { idx: 0, name: "Base Salary", amountCents: 95, frequency: "monthly" as const },
      { idx: 1, name: "Base Salary", amountCents: 80, frequency: "monthly" as const },
      { idx: 2, name: "Contract Rate", amountCents: 70, frequency: "biweekly" as const },
      { idx: 3, name: "Base Salary", amountCents: 85, frequency: "monthly" as const },
      { idx: 4, name: "Part-time Salary", amountCents: 50, frequency: "biweekly" as const },
    ]) {
      await ctx.db.insert("compensationLines", {
        employeeId: employeeIds[line.idx],
        companyId,
        name: line.name,
        amountCents: line.amountCents,
        asset: "USDC",
        frequency: line.frequency,
        isActive: true,
      });
    }

    // ─── Customers ───
    const customers = [
      { displayName: "Acme Labs", customerType: "company" as const, pricingModel: "invoice" as const, billingState: "active" as const, walletReady: true, email: "billing@acme.io", contactName: "John Doe" },
      { displayName: "Neural AI", customerType: "app" as const, pricingModel: "usage" as const, billingState: "active" as const, walletReady: true, email: "ops@neural.ai" },
      { displayName: "Bot-42", customerType: "agent" as const, pricingModel: "usage" as const, billingState: "active" as const, walletReady: true },
    ];

    const customerIds = [];
    for (const cust of customers) {
      const id = await ctx.db.insert("customers", { companyId, ...cust });
      customerIds.push(id);
    }

    // ─── Products ───
    const products = [
      { name: "API Access", billingUnit: "1K requests", pricingModel: "per-unit" as const, unitPriceCents: 50, description: "Pay-per-use API access" },
      { name: "Pro License", billingUnit: "license", pricingModel: "per-unit" as const, unitPriceCents: 1500000, description: "Annual pro license" },
      { name: "Event Pass", billingUnit: "ticket", pricingModel: "per-unit" as const, unitPriceCents: 25000, description: "Conference admission" },
    ];

    const productIds = [];
    for (const prod of products) {
      const id = await ctx.db.insert("products", {
        companyId,
        ...prod,
        currency: "USD" as const,
        settlementAsset: "USDC",
        privacyMode: "standard" as const,
        refundPolicy: "no-refund" as const,
        isActive: true,
      });
      productIds.push(id);
    }

    // ─── Employee Payments ───
    const empPayments = [
      { idx: 0, type: "salary" as const, amountCents: 95, status: "settled" as const, description: "March salary", settledAt: now - 5 * day },
      { idx: 1, type: "salary" as const, amountCents: 80, status: "settled" as const, description: "March salary", settledAt: now - 5 * day },
      { idx: 3, type: "salary" as const, amountCents: 85, status: "settled" as const, description: "March salary", settledAt: now - 5 * day },
      { idx: 0, type: "salary" as const, amountCents: 95, status: "approved" as const, description: "April salary", scheduledDate: now + 2 * day },
      { idx: 1, type: "salary" as const, amountCents: 80, status: "approved" as const, description: "April salary", scheduledDate: now + 2 * day },
      { idx: 2, type: "freelance" as const, amountCents: 70, status: "draft" as const, description: "Sprint 12 contract work" },
      { idx: 0, type: "credit" as const, amountCents: 47, status: "settled" as const, description: "Salary credit (2% interest deducted)", settledAt: now - 1 * day },
    ];

    for (const p of empPayments) {
      await ctx.db.insert("employeePayments", {
        companyId,
        employeeId: employeeIds[p.idx],
        type: p.type,
        amountCents: p.amountCents,
        currency: "USD" as const,
        status: p.status,
        description: p.description,
        settledAt: p.settledAt,
        scheduledDate: p.scheduledDate,
      });
    }

    // ─── Customer Payments ───
    const custPayments = [
      { custIdx: 0, prodIdx: 1, mode: "invoice" as const, amountCents: 1500000, status: "paid" as const, description: "Pro License Q1", paidAt: now - 10 * day },
      { custIdx: 1, prodIdx: 0, mode: "usage" as const, amountCents: 87500, status: "paid" as const, description: "Feb API usage", paidAt: now - 3 * day },
      { custIdx: 1, prodIdx: 0, mode: "usage" as const, amountCents: 62000, status: "pending" as const, description: "March API usage (running)" },
      { custIdx: 2, prodIdx: null, mode: "usage" as const, amountCents: 12500, status: "paid" as const, description: "Agent compute credits", paidAt: now - 1 * day },
      { custIdx: 0, prodIdx: 1, mode: "invoice" as const, amountCents: 1500000, status: "sent" as const, description: "Pro License Q2", dueDate: now + 15 * day },
    ];

    for (const p of custPayments) {
      await ctx.db.insert("customerPayments", {
        companyId,
        customerId: customerIds[p.custIdx],
        productId: p.prodIdx !== null ? productIds[p.prodIdx] : undefined,
        mode: p.mode,
        amountCents: p.amountCents,
        currency: "USD" as const,
        status: p.status,
        description: p.description,
        paidAt: p.paidAt,
        dueDate: p.dueDate,
      });
    }

    // ─── Balance Ledger ───
    for (const p of empPayments.filter((p) => p.status === "settled")) {
      await debitBalance(ctx, {
        companyId,
        amountCents: p.amountCents,
        currency: "USD",
        reason: `Payroll: ${employees[p.idx].displayName} — ${p.description}`,
      });
    }

    for (const p of custPayments.filter((p) => p.status === "paid")) {
      await creditBalance(ctx, {
        companyId,
        amountCents: p.amountCents,
        currency: "USD",
        reason: `Payment: ${customers[p.custIdx].displayName} — ${p.description}`,
      });
    }

    await creditBalance(ctx, {
      companyId,
      amountCents: 5000000,
      currency: "USD",
      reason: "Initial treasury deposit — 50,000 USDC",
    });

    // ─── Credit Settings ───
    await ctx.db.insert("creditSettings", {
      companyId,
      enabled: true,
      interestRateBps: 200,
      maxCreditPercent: 80,
      autoDisableThresholdMonths: 2,
      autoDisabled: false,
    });

    return { companyId, name, slug };
  },
});
