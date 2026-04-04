/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function createTestCompany(t: ReturnType<typeof convexTest>) {
  return await t.mutation(api.companies.create, {
    name: "Test Corp",
    slug: "test-cust-" + Math.random().toString(36).slice(2),
    ownerWallet: "0xtest",
  });
}

const baseCustomer = {
  displayName: "Northwind Labs",
  customerType: "company" as const,
  pricingModel: "invoice" as const,
  billingState: "active" as const,
  walletReady: true,
  email: "billing@northwind.io",
};

describe("customers", () => {
  test("create and get by id", async () => {
    const t = convexTest(schema, modules);
    const companyId = await createTestCompany(t);
    const id = await t.mutation(api.customers.create, {
      companyId,
      ...baseCustomer,
    });
    const cust = await t.query(api.customers.getById, { id });
    expect(cust).toMatchObject({
      displayName: "Northwind Labs",
      customerType: "company",
    });
  });

  test("list by company", async () => {
    const t = convexTest(schema, modules);
    const companyId = await createTestCompany(t);
    await t.mutation(api.customers.create, { companyId, ...baseCustomer });
    await t.mutation(api.customers.create, {
      companyId,
      ...baseCustomer,
      displayName: "Second",
    });
    const list = await t.query(api.customers.listByCompany, { companyId });
    expect(list).toHaveLength(2);
  });

  test("filter by billing state", async () => {
    const t = convexTest(schema, modules);
    const companyId = await createTestCompany(t);
    await t.mutation(api.customers.create, { companyId, ...baseCustomer });
    await t.mutation(api.customers.create, {
      companyId,
      ...baseCustomer,
      displayName: "Overdue Client",
      billingState: "overdue",
    });
    const overdue = await t.query(api.customers.listByCompany, {
      companyId,
      billingState: "overdue",
    });
    expect(overdue).toHaveLength(1);
    expect(overdue[0].displayName).toBe("Overdue Client");
  });

  test("update customer", async () => {
    const t = convexTest(schema, modules);
    const companyId = await createTestCompany(t);
    const id = await t.mutation(api.customers.create, {
      companyId,
      ...baseCustomer,
    });
    await t.mutation(api.customers.update, {
      id,
      billingState: "paused",
    });
    const updated = await t.query(api.customers.getById, { id });
    expect(updated!.billingState).toBe("paused");
  });

  test("remove customer", async () => {
    const t = convexTest(schema, modules);
    const companyId = await createTestCompany(t);
    const id = await t.mutation(api.customers.create, {
      companyId,
      ...baseCustomer,
    });
    await t.mutation(api.customers.remove, { id });
    const result = await t.query(api.customers.getById, { id });
    expect(result).toBeNull();
  });
});
