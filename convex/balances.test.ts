/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function createTestCompany(t: ReturnType<typeof convexTest>) {
  return await t.mutation(api.companies.create, {
    name: "Test Corp",
    slug: "test-bal-" + Math.random().toString(36).slice(2),
    ownerWallet: "0xtest",
  });
}

describe("balances", () => {
  test("returns zero for new company", async () => {
    const t = convexTest(schema, modules);
    const companyId = await createTestCompany(t);
    const balance = await t.query(api.balances.getForCompany, {
      companyId,
      currency: "USD",
    });
    expect(balance.availableCents).toBe(0);
    expect(balance.totalCreditedCents).toBe(0);
    expect(balance.totalDebitedCents).toBe(0);
  });

  test("credit increases balance", async () => {
    const t = convexTest(schema, modules);
    const companyId = await createTestCompany(t);
    await t.mutation(api.balances.credit, {
      companyId,
      amountCents: 100000,
      currency: "USD",
      reason: "Payment received",
    });
    const balance = await t.query(api.balances.getForCompany, {
      companyId,
      currency: "USD",
    });
    expect(balance.availableCents).toBe(100000);
    expect(balance.totalCreditedCents).toBe(100000);
  });

  test("debit decreases balance", async () => {
    const t = convexTest(schema, modules);
    const companyId = await createTestCompany(t);
    await t.mutation(api.balances.credit, {
      companyId,
      amountCents: 100000,
      currency: "USD",
      reason: "Initial credit",
    });
    await t.mutation(api.balances.debit, {
      companyId,
      amountCents: 30000,
      currency: "USD",
      reason: "Payout",
    });
    const balance = await t.query(api.balances.getForCompany, {
      companyId,
      currency: "USD",
    });
    expect(balance.availableCents).toBe(70000);
  });

  test("debit fails on insufficient balance", async () => {
    const t = convexTest(schema, modules);
    const companyId = await createTestCompany(t);
    await t.mutation(api.balances.credit, {
      companyId,
      amountCents: 50000,
      currency: "USD",
      reason: "Small credit",
    });
    await expect(
      t.mutation(api.balances.debit, {
        companyId,
        amountCents: 100000,
        currency: "USD",
        reason: "Too much",
      })
    ).rejects.toThrow("Insufficient balance");
  });

  test("debit fails with no balance record", async () => {
    const t = convexTest(schema, modules);
    const companyId = await createTestCompany(t);
    await expect(
      t.mutation(api.balances.debit, {
        companyId,
        amountCents: 1,
        currency: "USD",
        reason: "No record",
      })
    ).rejects.toThrow("No balance record");
  });

  test("ledger entries are recorded", async () => {
    const t = convexTest(schema, modules);
    const companyId = await createTestCompany(t);
    await t.mutation(api.balances.credit, {
      companyId,
      amountCents: 100000,
      currency: "USD",
      reason: "Payment A",
    });
    await t.mutation(api.balances.debit, {
      companyId,
      amountCents: 20000,
      currency: "USD",
      reason: "Payout B",
    });
    const entries = await t.query(api.balances.getEntriesForCompany, {
      companyId,
    });
    expect(entries).toHaveLength(2);
    const types = entries.map((e: { type: string }) => e.type);
    expect(types).toContain("credit");
    expect(types).toContain("debit");
  });
});
