/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function createTestCompanyAndEmployee(t: ReturnType<typeof convexTest>) {
  const companyId = await t.mutation(api.companies.create, {
    name: "Test Corp",
    slug: "test-pay-" + Math.random().toString(36).slice(2),
    ownerWallet: "0xtest",
  });
  const employeeId = await t.mutation(api.employees.create, {
    companyId,
    displayName: "Test Emp",
    role: "Eng",
    employmentType: "full-time",
    compensationModel: "salary",
    payoutAsset: "USDC",
    payoutAmountCents: 100000,
    payoutFrequency: "monthly",
    walletVerified: true,
    privacyLevel: "pseudonymous",
    status: "active",
  });
  return { companyId, employeeId };
}

async function createTestCompanyAndCustomer(t: ReturnType<typeof convexTest>) {
  const companyId = await t.mutation(api.companies.create, {
    name: "Test Corp",
    slug: "test-cpay-" + Math.random().toString(36).slice(2),
    ownerWallet: "0xtest",
  });
  const customerId = await t.mutation(api.customers.create, {
    companyId,
    displayName: "Test Customer",
    customerType: "company",
    pricingModel: "invoice",
    billingState: "active",
    walletReady: true,
  });
  return { companyId, customerId };
}

describe("employee payments", () => {
  test("create with draft status", async () => {
    const t = convexTest(schema, modules);
    const { companyId, employeeId } = await createTestCompanyAndEmployee(t);
    const id = await t.mutation(api.employeePayments.create, {
      companyId,
      employeeId,
      type: "salary",
      amountCents: 100000,
      currency: "USD",
      description: "Test salary",
    });
    const payment = await t.query(api.employeePayments.getById, { id });
    expect(payment!.status).toBe("draft");
    expect(payment!.amountCents).toBe(100000);
  });

  test("list by company", async () => {
    const t = convexTest(schema, modules);
    const { companyId, employeeId } = await createTestCompanyAndEmployee(t);
    await t.mutation(api.employeePayments.create, {
      companyId,
      employeeId,
      type: "salary",
      amountCents: 100000,
      currency: "USD",
    });
    await t.mutation(api.employeePayments.create, {
      companyId,
      employeeId,
      type: "bonus",
      amountCents: 50000,
      currency: "USD",
    });
    const list = await t.query(api.employeePayments.listByCompany, {
      companyId,
    });
    expect(list).toHaveLength(2);
  });

  test("update status to approved", async () => {
    const t = convexTest(schema, modules);
    const { companyId, employeeId } = await createTestCompanyAndEmployee(t);
    const id = await t.mutation(api.employeePayments.create, {
      companyId,
      employeeId,
      type: "salary",
      amountCents: 100000,
      currency: "USD",
    });
    await t.mutation(api.employeePayments.updateStatus, {
      id,
      status: "approved",
    });
    const updated = await t.query(api.employeePayments.getById, { id });
    expect(updated!.status).toBe("approved");
  });

  test("list by employee", async () => {
    const t = convexTest(schema, modules);
    const { companyId, employeeId } = await createTestCompanyAndEmployee(t);
    await t.mutation(api.employeePayments.create, {
      companyId,
      employeeId,
      type: "salary",
      amountCents: 100000,
      currency: "USD",
    });
    const list = await t.query(api.employeePayments.listByEmployee, {
      employeeId,
    });
    expect(list).toHaveLength(1);
  });

  test("remove payment", async () => {
    const t = convexTest(schema, modules);
    const { companyId, employeeId } = await createTestCompanyAndEmployee(t);
    const id = await t.mutation(api.employeePayments.create, {
      companyId,
      employeeId,
      type: "salary",
      amountCents: 100000,
      currency: "USD",
    });
    await t.mutation(api.employeePayments.remove, { id });
    const result = await t.query(api.employeePayments.getById, { id });
    expect(result).toBeNull();
  });
});

describe("customer payments", () => {
  test("create with draft status", async () => {
    const t = convexTest(schema, modules);
    const { companyId, customerId } = await createTestCompanyAndCustomer(t);
    const id = await t.mutation(api.customerPayments.create, {
      companyId,
      customerId,
      mode: "invoice",
      amountCents: 500000,
      currency: "USD",
      description: "Q2 invoice",
    });
    const payment = await t.query(api.customerPayments.getById, { id });
    expect(payment!.status).toBe("draft");
    expect(payment!.mode).toBe("invoice");
  });

  test("list by company with status filter", async () => {
    const t = convexTest(schema, modules);
    const { companyId, customerId } = await createTestCompanyAndCustomer(t);
    const id1 = await t.mutation(api.customerPayments.create, {
      companyId,
      customerId,
      mode: "invoice",
      amountCents: 500000,
      currency: "USD",
    });
    await t.mutation(api.customerPayments.create, {
      companyId,
      customerId,
      mode: "usage",
      amountCents: 10000,
      currency: "USD",
    });
    // Mark first as paid
    await t.mutation(api.customerPayments.updateStatus, {
      id: id1,
      status: "paid",
      paidAt: Date.now(),
    });
    const drafts = await t.query(api.customerPayments.listByCompany, {
      companyId,
      status: "draft",
    });
    expect(drafts).toHaveLength(1);
  });

  test("list by customer", async () => {
    const t = convexTest(schema, modules);
    const { companyId, customerId } = await createTestCompanyAndCustomer(t);
    await t.mutation(api.customerPayments.create, {
      companyId,
      customerId,
      mode: "invoice",
      amountCents: 500000,
      currency: "USD",
    });
    const list = await t.query(api.customerPayments.listByCustomer, {
      customerId,
    });
    expect(list).toHaveLength(1);
  });

  test("remove payment", async () => {
    const t = convexTest(schema, modules);
    const { companyId, customerId } = await createTestCompanyAndCustomer(t);
    const id = await t.mutation(api.customerPayments.create, {
      companyId,
      customerId,
      mode: "one-time",
      amountCents: 35000,
      currency: "USD",
    });
    await t.mutation(api.customerPayments.remove, { id });
    const result = await t.query(api.customerPayments.getById, { id });
    expect(result).toBeNull();
  });
});
