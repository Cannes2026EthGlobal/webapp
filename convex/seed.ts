import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const seedDemoData = mutation({
  args: { ownerWallet: v.string() },
  handler: async (ctx, args) => {
    // Check if already seeded
    const existing = await ctx.db
      .query("companies")
      .withIndex("by_slug", (q) => q.eq("slug", "arc-demo"))
      .unique();
    if (existing) return { companyId: existing._id, alreadySeeded: true };

    // Create company
    const companyId = await ctx.db.insert("companies", {
      name: "Arc Demo Co",
      slug: "arc-demo",
      ownerWallet: args.ownerWallet,
      industry: "Technology",
      website: "https://arcdemo.co",
    });

    // Seed employees
    const employeeData = [
      { displayName: "Elena Vasquez", role: "Lead Engineer", employmentType: "full-time" as const, walletVerified: true, privacyLevel: "verified" as const, status: "active" as const, email: "elena@arcdemo.co", walletAddress: "0x1234...abcd" },
      { displayName: "Marcus Chen", role: "Product Designer", employmentType: "full-time" as const, walletVerified: true, privacyLevel: "pseudonymous" as const, status: "active" as const },
      { displayName: "Aria Nakamura", role: "Backend Developer", employmentType: "contractor" as const, walletVerified: true, privacyLevel: "shielded" as const, status: "active" as const, walletAddress: "0x5678...efgh" },
      { displayName: "James Whitfield", role: "DevOps", employmentType: "full-time" as const, walletVerified: false, privacyLevel: "pseudonymous" as const, status: "active" as const },
      { displayName: "Sofia Reyes", role: "Data Analyst", employmentType: "part-time" as const, walletVerified: true, privacyLevel: "verified" as const, status: "active" as const, email: "sofia@arcdemo.co" },
      { displayName: "Kai Tanaka", role: "Smart Contract Auditor", employmentType: "freelance" as const, walletVerified: true, privacyLevel: "shielded" as const, status: "active" as const },
      { displayName: "Luna Park", role: "Marketing Lead", employmentType: "full-time" as const, walletVerified: true, privacyLevel: "verified" as const, status: "onboarding" as const },
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
      { employeeIndex: 0, name: "Base Salary", amountCents: 1200000, frequency: "monthly", isActive: true },
      { employeeIndex: 0, name: "Housing Allowance", amountCents: 250000, frequency: "monthly", isActive: true, description: "Monthly housing stipend" },
      { employeeIndex: 1, name: "Base Salary", amountCents: 950000, frequency: "monthly", isActive: true },
      { employeeIndex: 2, name: "Contract Salary", amountCents: 850000, frequency: "biweekly", isActive: true },
      { employeeIndex: 3, name: "Base Salary", amountCents: 1100000, frequency: "monthly", isActive: true },
      { employeeIndex: 4, name: "Part-time Salary", amountCents: 650000, frequency: "biweekly", isActive: true },
      { employeeIndex: 5, name: "Retainer", amountCents: 500000, frequency: "monthly", isActive: true },
      { employeeIndex: 6, name: "Base Salary", amountCents: 900000, frequency: "monthly", isActive: true },
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
        pricingModel: "flat" as const,
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
        pricingModel: "flat" as const,
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
        pricingModel: "tiered" as const,
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

    return { companyId, alreadySeeded: false };
  },
});
