/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function createTestCompany(t: ReturnType<typeof convexTest>) {
  const userId = await t.mutation(api.users.getOrCreateByWallet, { walletAddress: "0xtest" });
  return await t.mutation(api.companies.create, {
    name: "Test Corp",
    slug: "test-prod-" + Math.random().toString(36).slice(2),
    userId,
  });
}

const baseProduct = {
  name: "API Access",
  billingUnit: "request",
  pricingModel: "per-unit" as const,
  unitPriceCents: 1,
  currency: "USD" as const,
  settlementAsset: "USDC",
  privacyMode: "standard" as const,
  refundPolicy: "no-refund" as const,
  isActive: true,
};

describe("products", () => {
  test("create and get by id", async () => {
    const t = convexTest(schema, modules);
    const companyId = await createTestCompany(t);
    const id = await t.mutation(api.products.create, {
      companyId,
      ...baseProduct,
    });
    const prod = await t.query(api.products.getById, { id });
    expect(prod).toMatchObject({
      name: "API Access",
      billingUnit: "request",
    });
  });

  test("list by company", async () => {
    const t = convexTest(schema, modules);
    const companyId = await createTestCompany(t);
    await t.mutation(api.products.create, { companyId, ...baseProduct });
    await t.mutation(api.products.create, {
      companyId,
      ...baseProduct,
      name: "Second Product",
    });
    const list = await t.query(api.products.listByCompany, { companyId });
    expect(list).toHaveLength(2);
  });

  test("filter active only", async () => {
    const t = convexTest(schema, modules);
    const companyId = await createTestCompany(t);
    await t.mutation(api.products.create, { companyId, ...baseProduct });
    await t.mutation(api.products.create, {
      companyId,
      ...baseProduct,
      name: "Inactive",
      isActive: false,
    });
    const active = await t.query(api.products.listByCompany, {
      companyId,
      activeOnly: true,
    });
    expect(active).toHaveLength(1);
    expect(active[0].name).toBe("API Access");
  });

  test("update product", async () => {
    const t = convexTest(schema, modules);
    const companyId = await createTestCompany(t);
    const id = await t.mutation(api.products.create, {
      companyId,
      ...baseProduct,
    });
    await t.mutation(api.products.update, { id, name: "Premium API" });
    const updated = await t.query(api.products.getById, { id });
    expect(updated!.name).toBe("Premium API");
  });

  test("remove product", async () => {
    const t = convexTest(schema, modules);
    const companyId = await createTestCompany(t);
    const id = await t.mutation(api.products.create, {
      companyId,
      ...baseProduct,
    });
    await t.mutation(api.products.remove, { id });
    const result = await t.query(api.products.getById, { id });
    expect(result).toBeNull();
  });
});
