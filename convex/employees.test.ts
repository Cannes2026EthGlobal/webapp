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
    slug: "test-emp-" + Math.random().toString(36).slice(2),
    userId,
  });
}

const baseEmployee = {
  displayName: "Test Employee",
  role: "Engineer",
  employmentType: "full-time" as const,
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

  test("list returns totalCompensationCents from comp lines", async () => {
    const t = convexTest(schema, modules);
    const companyId = await createTestCompany(t);
    const empId = await t.mutation(api.employees.create, {
      companyId,
      ...baseEmployee,
    });
    await t.mutation(api.compensationLines.create, {
      employeeId: empId,
      companyId,
      name: "Base Salary",

      amountCents: 1000000,
      asset: "USDC",
      frequency: "monthly",
      isActive: true,
    });
    await t.mutation(api.compensationLines.create, {
      employeeId: empId,
      companyId,
      name: "Bonus",

      amountCents: 200000,
      asset: "USDC",
      frequency: "monthly",
      isActive: true,
    });
    const list = await t.query(api.employees.listByCompany, { companyId });
    expect(list[0].totalCompensationCents).toBe(1200000);
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

  test("remove employee cascades compensation lines", async () => {
    const t = convexTest(schema, modules);
    const companyId = await createTestCompany(t);
    const id = await t.mutation(api.employees.create, {
      companyId,
      ...baseEmployee,
    });
    await t.mutation(api.compensationLines.create, {
      employeeId: id,
      companyId,
      name: "Base Salary",

      amountCents: 1000000,
      asset: "USDC",
      frequency: "monthly",
      isActive: true,
    });
    await t.mutation(api.employees.remove, { id });
    const result = await t.query(api.employees.getById, { id });
    expect(result).toBeNull();
    const lines = await t.query(api.compensationLines.listByEmployee, {
      employeeId: id,
    });
    expect(lines).toHaveLength(0);
  });
});
