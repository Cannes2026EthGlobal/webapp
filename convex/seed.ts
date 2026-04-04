import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const seedDemoData = mutation({
  args: {
    walletAddress: v.string(),
    payrollContractAddress: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get or create user record for this wallet
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_walletAddress", (q) =>
        q.eq("walletAddress", args.walletAddress)
      )
      .unique();

    const userId =
      existingUser?._id ??
      (await ctx.db.insert("users", { walletAddress: args.walletAddress }));

    // Check if already seeded (any company membership for this user)
    const existingMembership = await ctx.db
      .query("companyMembers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (existingMembership) {
      return { companyId: existingMembership.companyId, alreadySeeded: true };
    }

    // Generate a unique slug per wallet to avoid conflicts
    const slugSuffix = args.walletAddress.slice(-6).toLowerCase();
    const slug = `arc-demo-${slugSuffix}`;

    // Create company
    const companyId = await ctx.db.insert("companies", {
      name: "Arc Demo Co",
      slug,
      ownerId: userId,
      industry: "Technology",
      website: "https://arcdemo.co",
      payrollContractAddress: args.payrollContractAddress,
    });

    // Create business profile (gates dashboard access)
    const existingProfile = await ctx.db
      .query("businessProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!existingProfile) {
      await ctx.db.insert("businessProfiles", {
        userId,
        businessName: "Arc Demo Co",
        industry: "Technology",
        website: "https://arcdemo.co",
        payrollContractAddress: args.payrollContractAddress,
      });
    }

    // Create owner membership
    await ctx.db.insert("companyMembers", {
      userId,
      companyId,
      role: "owner",
    });

    // Seed employees
    const day = 86400000;
    const now = Date.now();
    // Salaries are tiny (0–1 USDC) so the demo contract doesn't need much funding
    const empWallet = "0xba232D9C9A551a60ff20F9f6AA3BBb21FE55F909";
    const employeeData = [
      { displayName: "Elena Vasquez", role: "Lead Engineer", employmentType: "full-time" as const, walletVerified: true, privacyLevel: "verified" as const, status: "active" as const, email: "elena@arcdemo.co", walletAddress: empWallet, startDate: now - 730 * day, payoutAmountCents: 95, payoutFrequency: "monthly" as const },
      { displayName: "Marcus Chen", role: "Product Designer", employmentType: "full-time" as const, walletVerified: true, privacyLevel: "pseudonymous" as const, status: "active" as const, walletAddress: empWallet, startDate: now - 548 * day, payoutAmountCents: 80, payoutFrequency: "monthly" as const },
      { displayName: "Aria Nakamura", role: "Backend Developer", employmentType: "contractor" as const, walletVerified: true, privacyLevel: "shielded" as const, status: "active" as const, walletAddress: empWallet, startDate: now - 365 * day, payoutAmountCents: 70, payoutFrequency: "biweekly" as const },
      { displayName: "James Whitfield", role: "DevOps", employmentType: "full-time" as const, walletVerified: false, privacyLevel: "pseudonymous" as const, status: "active" as const, walletAddress: empWallet, startDate: now - 912 * day, payoutAmountCents: 85, payoutFrequency: "monthly" as const },
      { displayName: "Sofia Reyes", role: "Data Analyst", employmentType: "part-time" as const, walletVerified: true, privacyLevel: "verified" as const, status: "active" as const, email: "sofia@arcdemo.co", walletAddress: empWallet, startDate: now - 180 * day, payoutAmountCents: 50, payoutFrequency: "biweekly" as const },
      { displayName: "Kai Tanaka", role: "Smart Contract Auditor", employmentType: "freelance" as const, walletVerified: true, privacyLevel: "shielded" as const, status: "active" as const, walletAddress: empWallet, startDate: now - 90 * day, payoutAmountCents: 40, payoutFrequency: "monthly" as const },
      { displayName: "Luna Park", role: "Marketing Lead", employmentType: "full-time" as const, walletVerified: true, privacyLevel: "verified" as const, status: "active" as const, walletAddress: empWallet, startDate: now - 14 * day, payoutAmountCents: 75, payoutFrequency: "monthly" as const },
    ];

    const employeeIds = [];
    for (const emp of employeeData) {
      const id = await ctx.db.insert("employees", { companyId, ...emp });
      employeeIds.push(id);
    }

    // Seed compensation lines (one-to-many per employee)
    const compLines: Array<{
      employeeIndex: number;
      name: string;
      amountCents: number;
      frequency: "monthly" | "biweekly" | "weekly";
      isActive: boolean;
      description?: string;
    }> = [
      { employeeIndex: 0, name: "Base Salary", amountCents: 80, frequency: "monthly", isActive: true },
      { employeeIndex: 0, name: "Housing Allowance", amountCents: 15, frequency: "monthly", isActive: true, description: "Monthly housing stipend" },
      { employeeIndex: 1, name: "Base Salary", amountCents: 80, frequency: "monthly", isActive: true },
      { employeeIndex: 2, name: "Contract Salary", amountCents: 70, frequency: "biweekly", isActive: true },
      { employeeIndex: 3, name: "Base Salary", amountCents: 85, frequency: "monthly", isActive: true },
      { employeeIndex: 4, name: "Part-time Salary", amountCents: 50, frequency: "biweekly", isActive: true },
      { employeeIndex: 5, name: "Retainer", amountCents: 40, frequency: "monthly", isActive: true },
      { employeeIndex: 6, name: "Base Salary", amountCents: 75, frequency: "monthly", isActive: true },
    ];

    for (const line of compLines) {
      await ctx.db.insert("compensationLines", {
        employeeId: employeeIds[line.employeeIndex],
        companyId,
        name: line.name,
        description: line.description,
        amountCents: line.amountCents,
        asset: "USDC",
        frequency: line.frequency,
        isActive: line.isActive,
      });
    }

    // Seed customers
    const customerData = [
      {
        displayName: "Northwind Labs",
        customerType: "company" as const,
        pricingModel: "invoice" as const,
        billingState: "active" as const,
        walletReady: true,
        email: "billing@northwind.io",
        contactName: "David Kim",
        walletAddress: "0xaaaa...1111",
      },
      {
        displayName: "Synthex AI",
        customerType: "app" as const,
        pricingModel: "usage" as const,
        billingState: "active" as const,
        walletReady: true,
        email: "ops@synthex.ai",
        contactName: "Rachel Moore",
      },
      {
        displayName: "AutoAgent-7",
        customerType: "agent" as const,
        pricingModel: "usage" as const,
        billingState: "active" as const,
        walletReady: true,
        walletAddress: "0xbbbb...2222",
      },
      {
        displayName: "Meridian Events",
        customerType: "buyer" as const,
        pricingModel: "one-time" as const,
        billingState: "active" as const,
        walletReady: false,
        email: "finance@meridian.events",
        contactName: "Priya Sharma",
      },
      {
        displayName: "Helios Protocol",
        customerType: "company" as const,
        pricingModel: "subscription" as const,
        billingState: "overdue" as const,
        walletReady: true,
        email: "accounts@helios.xyz",
        contactName: "Tom Brennan",
      },
      {
        displayName: "Quantum Mesh",
        customerType: "app" as const,
        pricingModel: "usage" as const,
        billingState: "paused" as const,
        walletReady: true,
      },
    ];

    const customerIds = [];
    for (const cust of customerData) {
      const id = await ctx.db.insert("customers", {
        companyId,
        ...cust,
      });
      customerIds.push(id);
    }

    // Seed products
    const productData = [
      {
        name: "Prompt Streaming API",
        description: "Pay-per-token streaming inference",
        billingUnit: "1K tokens",
        pricingModel: "per-unit" as const,
        unitPriceCents: 8,
        currency: "USD" as const,
        settlementAsset: "USDC",
        privacyMode: "standard" as const,
        refundPolicy: "no-refund" as const,
        isActive: true,
      },
      {
        name: "Enterprise License",
        description: "Annual enterprise access license",
        billingUnit: "license",
        pricingModel: "per-unit" as const,
        unitPriceCents: 2400000,
        currency: "USD" as const,
        settlementAsset: "USDC",
        privacyMode: "standard" as const,
        refundPolicy: "partial" as const,
        isActive: true,
      },
      {
        name: "Event Ticket - DevCon",
        description: "Single-use DevCon 2026 admission",
        billingUnit: "ticket",
        pricingModel: "per-unit" as const,
        unitPriceCents: 35000,
        currency: "USD" as const,
        settlementAsset: "USDC",
        privacyMode: "pseudonymous" as const,
        refundPolicy: "full" as const,
        isActive: true,
      },
      {
        name: "Compute Credits",
        description: "GPU compute time billing",
        billingUnit: "GPU-hour",
        pricingModel: "pay-as-you-go" as const,
        unitPriceCents: 250,
        currency: "USD" as const,
        settlementAsset: "USDC",
        privacyMode: "shielded" as const,
        refundPolicy: "no-refund" as const,
        isActive: true,
      },
      {
        name: "Data Pipeline (Deprecated)",
        description: "Legacy data pipeline access",
        billingUnit: "GB processed",
        pricingModel: "per-unit" as const,
        unitPriceCents: 15,
        currency: "USD" as const,
        settlementAsset: "USDC",
        privacyMode: "standard" as const,
        refundPolicy: "no-refund" as const,
        isActive: false,
      },
    ];

    const productIds = [];
    for (const prod of productData) {
      const id = await ctx.db.insert("products", {
        companyId,
        ...prod,
      });
      productIds.push(id);
    }

    // Seed employee payments
    const empPayments = [
      {
        employeeId: employeeIds[0],
        type: "salary" as const,
        amountCents: 95,
        status: "settled" as const,
        description: "March 2026 salary",
        settledAt: now - 4 * day,
      },
      {
        employeeId: employeeIds[0],
        type: "salary" as const,
        amountCents: 95,
        status: "approved" as const,
        description: "April 2026 salary",
        scheduledDate: now + 1 * day,
      },
      {
        employeeId: employeeIds[1],
        type: "salary" as const,
        amountCents: 80,
        status: "approved" as const,
        description: "April 2026 salary",
        scheduledDate: now + 1 * day,
      },
      {
        employeeId: employeeIds[2],
        type: "freelance" as const,
        amountCents: 28,
        status: "draft" as const,
        description: "Sprint 14 contract work (40h)",
      },
      {
        employeeId: employeeIds[3],
        type: "salary" as const,
        amountCents: 85,
        status: "queued" as const,
        description: "April 2026 salary",
        scheduledDate: now + 1 * day,
      },
      {
        employeeId: employeeIds[4],
        type: "salary" as const,
        amountCents: 42,
        status: "draft" as const,
        description: "April 2026 part-time salary",
      },
      {
        employeeId: employeeIds[5],
        type: "freelance" as const,
        amountCents: 40,
        status: "settled" as const,
        description: "Smart contract audit - vault module",
        settledAt: now - 2 * day,
      },
      {
        employeeId: employeeIds[0],
        type: "bonus" as const,
        amountCents: 20,
        status: "draft" as const,
        description: "Q1 2026 performance bonus",
      },
      {
        employeeId: employeeIds[2],
        type: "credit" as const,
        amountCents: 12,
        status: "settled" as const,
        description: "Paycheck credit against April invoice",
        settledAt: now - 1 * day,
      },
    ];

    for (const payment of empPayments) {
      await ctx.db.insert("employeePayments", {
        companyId,
        currency: "USD",
        ...payment,
      });
    }

    // Seed customer payments
    const custPayments = [
      {
        customerId: customerIds[0],
        productId: productIds[1],
        mode: "invoice" as const,
        amountCents: 50,
        status: "pending" as const,
        description: "Enterprise License Q2 2026",
        dueDate: now + 12 * day,
      },
      {
        customerId: customerIds[1],
        mode: "usage" as const,
        amountCents: 10,
        status: "paid" as const,
        description: "March API usage - 156K tokens",
        paidAt: now - 3 * day,
      },
      {
        customerId: customerIds[2],
        mode: "usage" as const,
        amountCents: 4,
        status: "paid" as const,
        description: "Agent inference credits",
        paidAt: now - 1 * day,
      },
      {
        customerId: customerIds[3],
        productId: productIds[2],
        mode: "one-time" as const,
        amountCents: 3,
        status: "sent" as const,
        description: "DevCon 2026 ticket",
        dueDate: now + 7 * day,
      },
      {
        customerId: customerIds[4],
        productId: productIds[1],
        mode: "invoice" as const,
        amountCents: 20,
        status: "overdue" as const,
        description: "Enterprise License renewal",
        dueDate: now - 5 * day,
      },
      {
        customerId: customerIds[1],
        productId: productIds[0],
        mode: "usage" as const,
        amountCents: 7,
        status: "pending" as const,
        description: "April API usage (running)",
      },
      {
        customerId: customerIds[0],
        mode: "checkout" as const,
        amountCents: 3,
        status: "paid" as const,
        description: "Checkout link payment",
        paidAt: now - 6 * day,
      },
    ];

    for (const payment of custPayments) {
      await ctx.db.insert("customerPayments", {
        companyId,
        currency: "USD",
        ...payment,
      });
    }

    // Seed treasury balance (~4 USDC credited, realistic for demo contract)
    await ctx.db.insert("companyBalances", {
      companyId,
      totalCreditedCents: 400,
      totalDebitedCents: 0,
      currency: "USD",
    });

    // Seed a few balance entries
    await ctx.db.insert("balanceEntries", {
      companyId,
      type: "credit",
      amountCents: 50,
      currency: "USD",
      reason: "Enterprise License payment - Northwind Labs",
    });
    await ctx.db.insert("balanceEntries", {
      companyId,
      type: "credit",
      amountCents: 10,
      currency: "USD",
      reason: "Usage payment - Synthex AI",
    });
    await ctx.db.insert("balanceEntries", {
      companyId,
      type: "debit",
      amountCents: 95,
      currency: "USD",
      reason: "Payroll - Elena Vasquez March 2026",
    });

    return { companyId, alreadySeeded: false };
  },
});

/**
 * Seed demo data into an existing company.
 * Called after onboarding when user picks "Fill with demo data".
 */
export const seedCompanyData = mutation({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const { companyId } = args;

    // Check if already has employees (avoid double-seeding)
    const existing = await ctx.db
      .query("employees")
      .withIndex("by_companyId", (q) => q.eq("companyId", companyId))
      .first();
    if (existing) return { alreadySeeded: true };

    const day = 86400000;
    const now = Date.now();
    const empWallet = "0xba232D9C9A551a60ff20F9f6AA3BBb21FE55F909";
    const employeeData = [
      { displayName: "Elena Vasquez", role: "Lead Engineer", employmentType: "full-time" as const, walletVerified: true, privacyLevel: "verified" as const, status: "active" as const, email: "elena@arcdemo.co", walletAddress: empWallet, startDate: now - 730 * day, payoutAmountCents: 95, payoutFrequency: "monthly" as const },
      { displayName: "Marcus Chen", role: "Product Designer", employmentType: "full-time" as const, walletVerified: true, privacyLevel: "pseudonymous" as const, status: "active" as const, walletAddress: empWallet, startDate: now - 548 * day, payoutAmountCents: 80, payoutFrequency: "monthly" as const },
      { displayName: "Aria Nakamura", role: "Backend Developer", employmentType: "contractor" as const, walletVerified: true, privacyLevel: "shielded" as const, status: "active" as const, walletAddress: empWallet, startDate: now - 365 * day, payoutAmountCents: 70, payoutFrequency: "biweekly" as const },
      { displayName: "James Whitfield", role: "DevOps", employmentType: "full-time" as const, walletVerified: false, privacyLevel: "pseudonymous" as const, status: "active" as const, walletAddress: empWallet, startDate: now - 912 * day, payoutAmountCents: 85, payoutFrequency: "monthly" as const },
      { displayName: "Sofia Reyes", role: "Data Analyst", employmentType: "part-time" as const, walletVerified: true, privacyLevel: "verified" as const, status: "active" as const, email: "sofia@arcdemo.co", walletAddress: empWallet, startDate: now - 180 * day, payoutAmountCents: 50, payoutFrequency: "biweekly" as const },
      { displayName: "Kai Tanaka", role: "Smart Contract Auditor", employmentType: "freelance" as const, walletVerified: true, privacyLevel: "shielded" as const, status: "active" as const, walletAddress: empWallet, startDate: now - 90 * day, payoutAmountCents: 40, payoutFrequency: "monthly" as const },
      { displayName: "Luna Park", role: "Marketing Lead", employmentType: "full-time" as const, walletVerified: true, privacyLevel: "verified" as const, status: "active" as const, walletAddress: empWallet, startDate: now - 14 * day, payoutAmountCents: 75, payoutFrequency: "monthly" as const },
    ];

    const employeeIds = [];
    for (const emp of employeeData) {
      const id = await ctx.db.insert("employees", { companyId, ...emp });
      employeeIds.push(id);
    }

    const compLines = [
      { employeeIndex: 0, name: "Base Salary", amountCents: 80, frequency: "monthly" as const, isActive: true },
      { employeeIndex: 0, name: "Housing Allowance", amountCents: 15, frequency: "monthly" as const, isActive: true, description: "Monthly housing stipend" },
      { employeeIndex: 1, name: "Base Salary", amountCents: 80, frequency: "monthly" as const, isActive: true },
      { employeeIndex: 2, name: "Contract Salary", amountCents: 70, frequency: "biweekly" as const, isActive: true },
      { employeeIndex: 3, name: "Base Salary", amountCents: 85, frequency: "monthly" as const, isActive: true },
      { employeeIndex: 4, name: "Part-time Salary", amountCents: 50, frequency: "biweekly" as const, isActive: true },
      { employeeIndex: 5, name: "Retainer", amountCents: 40, frequency: "monthly" as const, isActive: true },
      { employeeIndex: 6, name: "Base Salary", amountCents: 75, frequency: "monthly" as const, isActive: true },
    ];

    const compLineIds = [];
    for (const line of compLines) {
      const id = await ctx.db.insert("compensationLines", {
        employeeId: employeeIds[line.employeeIndex],
        companyId,
        name: line.name,
        description: line.description,
        amountCents: line.amountCents,
        asset: "USDC",
        frequency: line.frequency,
        isActive: line.isActive,
      });
      compLineIds.push(id);
    }

    // Sample splits: Elena Vasquez's Base Salary (index 0) split 75/25
    await ctx.db.insert("compensationSplits", {
      compensationLineId: compLineIds[0],
      employeeId: employeeIds[0],
      walletAddress: empWallet,
      amountCents: 60,
      label: "Main",
    });
    await ctx.db.insert("compensationSplits", {
      compensationLineId: compLineIds[0],
      employeeId: employeeIds[0],
      walletAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
      amountCents: 20,
      label: "Savings",
    });

    const customerData = [
      { displayName: "Northwind Labs", customerType: "company" as const, pricingModel: "invoice" as const, billingState: "active" as const, walletReady: true, email: "billing@northwind.io", contactName: "David Kim", walletAddress: "0xaaaa...1111" },
      { displayName: "Synthex AI", customerType: "app" as const, pricingModel: "usage" as const, billingState: "active" as const, walletReady: true, email: "ops@synthex.ai", contactName: "Rachel Moore" },
      { displayName: "AutoAgent-7", customerType: "agent" as const, pricingModel: "usage" as const, billingState: "active" as const, walletReady: true, walletAddress: "0xbbbb...2222" },
      { displayName: "Meridian Events", customerType: "buyer" as const, pricingModel: "one-time" as const, billingState: "active" as const, walletReady: false, email: "finance@meridian.events", contactName: "Priya Sharma" },
      { displayName: "Helios Protocol", customerType: "company" as const, pricingModel: "subscription" as const, billingState: "overdue" as const, walletReady: true, email: "accounts@helios.xyz", contactName: "Tom Brennan" },
      { displayName: "Quantum Mesh", customerType: "app" as const, pricingModel: "usage" as const, billingState: "paused" as const, walletReady: true },
    ];

    const customerIds = [];
    for (const cust of customerData) {
      const id = await ctx.db.insert("customers", { companyId, ...cust });
      customerIds.push(id);
    }

    const productData = [
      { name: "Prompt Streaming API", description: "Pay-per-token streaming inference", billingUnit: "1K tokens", pricingModel: "per-unit" as const, unitPriceCents: 8, currency: "USD" as const, settlementAsset: "USDC", privacyMode: "standard" as const, refundPolicy: "no-refund" as const, isActive: true },
      { name: "Enterprise License", description: "Annual enterprise access license", billingUnit: "license", pricingModel: "per-unit" as const, unitPriceCents: 2400000, currency: "USD" as const, settlementAsset: "USDC", privacyMode: "standard" as const, refundPolicy: "partial" as const, isActive: true },
      { name: "Event Ticket - DevCon", description: "Single-use DevCon 2026 admission", billingUnit: "ticket", pricingModel: "per-unit" as const, unitPriceCents: 35000, currency: "USD" as const, settlementAsset: "USDC", privacyMode: "pseudonymous" as const, refundPolicy: "full" as const, isActive: true },
      { name: "Compute Credits", description: "GPU compute time billing", billingUnit: "GPU-hour", pricingModel: "pay-as-you-go" as const, unitPriceCents: 250, currency: "USD" as const, settlementAsset: "USDC", privacyMode: "shielded" as const, refundPolicy: "no-refund" as const, isActive: true },
      { name: "Data Pipeline (Deprecated)", description: "Legacy data pipeline access", billingUnit: "GB processed", pricingModel: "per-unit" as const, unitPriceCents: 15, currency: "USD" as const, settlementAsset: "USDC", privacyMode: "standard" as const, refundPolicy: "no-refund" as const, isActive: false },
    ];

    const productIds = [];
    for (const prod of productData) {
      const id = await ctx.db.insert("products", { companyId, ...prod });
      productIds.push(id);
    }

    const empPayments = [
      { employeeId: employeeIds[0], type: "salary" as const, amountCents: 95, status: "settled" as const, description: "March 2026 salary", settledAt: now - 4 * day },
      { employeeId: employeeIds[0], type: "salary" as const, amountCents: 95, status: "approved" as const, description: "April 2026 salary", scheduledDate: now + 1 * day },
      { employeeId: employeeIds[1], type: "salary" as const, amountCents: 80, status: "approved" as const, description: "April 2026 salary", scheduledDate: now + 1 * day },
      { employeeId: employeeIds[2], type: "freelance" as const, amountCents: 28, status: "draft" as const, description: "Sprint 14 contract work (40h)" },
      { employeeId: employeeIds[3], type: "salary" as const, amountCents: 85, status: "queued" as const, description: "April 2026 salary", scheduledDate: now + 1 * day },
      { employeeId: employeeIds[4], type: "salary" as const, amountCents: 42, status: "draft" as const, description: "April 2026 part-time salary" },
      { employeeId: employeeIds[5], type: "freelance" as const, amountCents: 40, status: "settled" as const, description: "Smart contract audit - vault module", settledAt: now - 2 * day },
      { employeeId: employeeIds[0], type: "bonus" as const, amountCents: 20, status: "draft" as const, description: "Q1 2026 performance bonus" },
      { employeeId: employeeIds[2], type: "credit" as const, amountCents: 12, status: "settled" as const, description: "Paycheck credit against April invoice", settledAt: now - 1 * day },
    ];

    for (const payment of empPayments) {
      await ctx.db.insert("employeePayments", { companyId, currency: "USD", ...payment });
    }

    const custPayments = [
      { customerId: customerIds[0], productId: productIds[1], mode: "invoice" as const, amountCents: 50, status: "pending" as const, description: "Enterprise License Q2 2026", dueDate: now + 12 * day },
      { customerId: customerIds[1], mode: "usage" as const, amountCents: 10, status: "paid" as const, description: "March API usage - 156K tokens", paidAt: now - 3 * day },
      { customerId: customerIds[2], mode: "usage" as const, amountCents: 4, status: "paid" as const, description: "Agent inference credits", paidAt: now - 1 * day },
      { customerId: customerIds[3], productId: productIds[2], mode: "one-time" as const, amountCents: 3, status: "sent" as const, description: "DevCon 2026 ticket", dueDate: now + 7 * day },
      { customerId: customerIds[4], productId: productIds[1], mode: "invoice" as const, amountCents: 20, status: "overdue" as const, description: "Enterprise License renewal", dueDate: now - 5 * day },
      { customerId: customerIds[1], productId: productIds[0], mode: "usage" as const, amountCents: 7, status: "pending" as const, description: "April API usage (running)" },
      { customerId: customerIds[0], mode: "checkout" as const, amountCents: 3, status: "paid" as const, description: "Checkout link payment", paidAt: now - 6 * day },
    ];

    for (const payment of custPayments) {
      await ctx.db.insert("customerPayments", { companyId, currency: "USD", ...payment });
    }

    await ctx.db.insert("companyBalances", { companyId, totalCreditedCents: 400, totalDebitedCents: 0, currency: "USD" });
    await ctx.db.insert("balanceEntries", { companyId, type: "credit", amountCents: 50, currency: "USD", reason: "Enterprise License payment - Northwind Labs" });
    await ctx.db.insert("balanceEntries", { companyId, type: "credit", amountCents: 10, currency: "USD", reason: "Usage payment - Synthex AI" });
    await ctx.db.insert("balanceEntries", { companyId, type: "debit", amountCents: 95, currency: "USD", reason: "Payroll - Elena Vasquez March 2026" });

    return { alreadySeeded: false };
  },
});
