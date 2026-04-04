/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function createTestCompany(t: ReturnType<typeof convexTest>) {
  return await t.mutation(api.companies.create, {
    name: "Test Corp",
    slug: "test-emp-" + Math.random().toString(36).slice(2),
    ownerWallet: "0xtest",
  });
}

const baseEmployee = {
  displayName: "Test Employee",
  role: "Engineer",
  employmentType: "full-time" as const,
  compensationModel: "salary" as const,
  payoutAsset: "USDC",
  payoutAmountCents: 1000000,
  payoutFrequency: "monthly" as const,
  walletVerified: true,
  privacyLevel: "pseudonymous" as const,
  status: "active" as const,
};

describe("employees", () => {
  test("create and get by id", async () => {
    const t = convexTest(schema, modules);
    const companyId = await createTestCompany(t);
    const id = await t.mutation(api.employees.create, {
      companyId,
      ...baseEmployee,
    });
    const emp = await t.query(api.employees.getById, { id });
    expect(emp).toMatchObject({
      displayName: "Test Employee",
      role: "Engineer",
      employmentType: "full-time",
    });
  });

  test("list by company", async () => {
    const t = convexTest(schema, modules);
    const companyId = await createTestCompany(t);
    await t.mutation(api.employees.create, { companyId, ...baseEmployee });
    await t.mutation(api.employees.create, {
      companyId,
      ...baseEmployee,
      displayName: "Second",
    });
    const list = await t.query(api.employees.listByCompany, { companyId });
    expect(list).toHaveLength(2);
  });

  test("list by company with status filter", async () => {
    const t = convexTest(schema, modules);
    const companyId = await createTestCompany(t);
    await t.mutation(api.employees.create, { companyId, ...baseEmployee });
    await t.mutation(api.employees.create, {
      companyId,
      ...baseEmployee,
      displayName: "Inactive",
      status: "inactive",
    });
    const active = await t.query(api.employees.listByCompany, {
      companyId,
      status: "active",
    });
    expect(active).toHaveLength(1);
    expect(active[0].displayName).toBe("Test Employee");
  });

  test("update employee", async () => {
    const t = convexTest(schema, modules);
    const companyId = await createTestCompany(t);
    const id = await t.mutation(api.employees.create, {
      companyId,
      ...baseEmployee,
    });
    await t.mutation(api.employees.update, { id, role: "Senior Engineer" });
    const updated = await t.query(api.employees.getById, { id });
    expect(updated!.role).toBe("Senior Engineer");
  });

  test("remove employee", async () => {
    const t = convexTest(schema, modules);
    const companyId = await createTestCompany(t);
    const id = await t.mutation(api.employees.create, {
      companyId,
      ...baseEmployee,
    });
    await t.mutation(api.employees.remove, { id });
    const result = await t.query(api.employees.getById, { id });
    expect(result).toBeNull();
  });
});
