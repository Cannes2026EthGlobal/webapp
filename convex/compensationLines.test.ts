/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function setup(t: ReturnType<typeof convexTest>) {
  const companyId = await t.mutation(api.companies.create, {
    name: "Test Corp",
    slug: "test-comp-" + Math.random().toString(36).slice(2),
    ownerWallet: "0xtest",
  });
  const employeeId = await t.mutation(api.employees.create, {
    companyId,
    displayName: "Test Emp",
    role: "Eng",
    employmentType: "full-time",
    walletVerified: true,
    privacyLevel: "pseudonymous",
    status: "active",
  });
  return { companyId, employeeId };
}

describe("compensationLines", () => {
  test("create and get by id", async () => {
    const t = convexTest(schema, modules);
    const { companyId, employeeId } = await setup(t);
    const id = await t.mutation(api.compensationLines.create, {
      employeeId,
      companyId,
      name: "Base Salary",

      amountCents: 1000000,
      asset: "USDC",
      frequency: "monthly",
      isActive: true,
    });
    const line = await t.query(api.compensationLines.getById, { id });
    expect(line).toMatchObject({
      name: "Base Salary",

      amountCents: 1000000,
      isActive: true,
    });
  });

  test("list by employee returns multiple lines", async () => {
    const t = convexTest(schema, modules);
    const { companyId, employeeId } = await setup(t);
    await t.mutation(api.compensationLines.create, {
      employeeId,
      companyId,
      name: "Base Salary",

      amountCents: 1000000,
      asset: "USDC",
      frequency: "monthly",
      isActive: true,
    });
    await t.mutation(api.compensationLines.create, {
      employeeId,
      companyId,
      name: "Consulting Retainer",

      amountCents: 300000,
      asset: "USDC",
      frequency: "monthly",
      isActive: true,
    });
    const lines = await t.query(api.compensationLines.listByEmployee, {
      employeeId,
    });
    expect(lines).toHaveLength(2);
  });

  test("list active filters inactive lines", async () => {
    const t = convexTest(schema, modules);
    const { companyId, employeeId } = await setup(t);
    await t.mutation(api.compensationLines.create, {
      employeeId,
      companyId,
      name: "Active",

      amountCents: 1000000,
      asset: "USDC",
      frequency: "monthly",
      isActive: true,
    });
    await t.mutation(api.compensationLines.create, {
      employeeId,
      companyId,
      name: "Inactive",

      amountCents: 200000,
      asset: "USDC",
      frequency: "monthly",
      isActive: false,
    });
    const active = await t.query(api.compensationLines.listActiveByEmployee, {
      employeeId,
    });
    expect(active).toHaveLength(1);
    expect(active[0].name).toBe("Active");
  });

  test("update compensation line", async () => {
    const t = convexTest(schema, modules);
    const { companyId, employeeId } = await setup(t);
    const id = await t.mutation(api.compensationLines.create, {
      employeeId,
      companyId,
      name: "Old Name",

      amountCents: 500000,
      asset: "USDC",
      frequency: "monthly",
      isActive: true,
    });
    await t.mutation(api.compensationLines.update, {
      id,
      name: "New Name",
      amountCents: 600000,
    });
    const updated = await t.query(api.compensationLines.getById, { id });
    expect(updated!.name).toBe("New Name");
    expect(updated!.amountCents).toBe(600000);
  });

  test("toggle active", async () => {
    const t = convexTest(schema, modules);
    const { companyId, employeeId } = await setup(t);
    const id = await t.mutation(api.compensationLines.create, {
      employeeId,
      companyId,
      name: "Salary",

      amountCents: 1000000,
      asset: "USDC",
      frequency: "monthly",
      isActive: true,
    });
    await t.mutation(api.compensationLines.toggleActive, {
      id,
      isActive: false,
    });
    const line = await t.query(api.compensationLines.getById, { id });
    expect(line!.isActive).toBe(false);
  });

  test("remove compensation line", async () => {
    const t = convexTest(schema, modules);
    const { companyId, employeeId } = await setup(t);
    const id = await t.mutation(api.compensationLines.create, {
      employeeId,
      companyId,
      name: "Temp",

      amountCents: 100000,
      asset: "USDC",
      frequency: "monthly",
      isActive: true,
    });
    await t.mutation(api.compensationLines.remove, { id });
    const result = await t.query(api.compensationLines.getById, { id });
    expect(result).toBeNull();
  });

  test("create payment with compensation line reference", async () => {
    const t = convexTest(schema, modules);
    const { companyId, employeeId } = await setup(t);
    // Need treasury for potential future settlement
    await t.mutation(api.balances.credit, {
      companyId,
      amountCents: 10000000,
      currency: "USD",
      reason: "Fund",
    });
    const lineId = await t.mutation(api.compensationLines.create, {
      employeeId,
      companyId,
      name: "Base Salary",

      amountCents: 1000000,
      asset: "USDC",
      frequency: "monthly",
      isActive: true,
    });
    const paymentId = await t.mutation(api.employeePayments.create, {
      companyId,
      employeeId,
      type: "salary",
      amountCents: 1000000,
      currency: "USD",
      description: "April salary",
      compensationLineId: lineId,
    });
    const payment = await t.query(api.employeePayments.getById, {
      id: paymentId,
    });
    expect(payment!.compensationLineId).toBe(lineId);
  });
});
