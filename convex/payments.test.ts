/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function setupCompanyWithBalance(t: ReturnType<typeof convexTest>) {
  const userId = await t.mutation(api.users.getOrCreateByWallet, { walletAddress: "0xtest" });
  const companyId = await t.mutation(api.companies.create, {
    name: "Test Corp",
    slug: "test-pay-" + Math.random().toString(36).slice(2),
    userId,
  });
  // Seed treasury with funds
  await t.mutation(api.balances.credit, {
    companyId,
    amountCents: 10000000,
    currency: "USD",
    reason: "Initial funding",
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

async function setupCompanyWithCustomer(t: ReturnType<typeof convexTest>) {
  const userId = await t.mutation(api.users.getOrCreateByWallet, { walletAddress: "0xtest" });
  const companyId = await t.mutation(api.companies.create, {
    name: "Test Corp",
    slug: "test-cpay-" + Math.random().toString(36).slice(2),
    userId,
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

describe("employee payments - status workflow", () => {
  test("create with draft status", async () => {
    const t = convexTest(schema, modules);
    const { companyId, employeeId } = await setupCompanyWithBalance(t);
    const id = await t.mutation(api.employeePayments.create, {
      companyId,
      employeeId,
      type: "salary",
      amountCents: 100000,
      currency: "USD",
    });
    const payment = await t.query(api.employeePayments.getById, { id });
    expect(payment!.status).toBe("draft");
  });

  test("draft → approved", async () => {
    const t = convexTest(schema, modules);
    const { companyId, employeeId } = await setupCompanyWithBalance(t);
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
    const payment = await t.query(api.employeePayments.getById, { id });
    expect(payment!.status).toBe("approved");
  });

  test("approved → queued", async () => {
    const t = convexTest(schema, modules);
    const { companyId, employeeId } = await setupCompanyWithBalance(t);
    const id = await t.mutation(api.employeePayments.create, {
      companyId,
      employeeId,
      type: "salary",
      amountCents: 100000,
      currency: "USD",
    });
    await t.mutation(api.employeePayments.updateStatus, { id, status: "approved" });
    await t.mutation(api.employeePayments.updateStatus, { id, status: "queued" });
    const payment = await t.query(api.employeePayments.getById, { id });
    expect(payment!.status).toBe("queued");
  });

  test("queued → settled debits treasury", async () => {
    const t = convexTest(schema, modules);
    const { companyId, employeeId } = await setupCompanyWithBalance(t);
    const id = await t.mutation(api.employeePayments.create, {
      companyId,
      employeeId,
      type: "salary",
      amountCents: 500000,
      currency: "USD",
    });
    await t.mutation(api.employeePayments.updateStatus, { id, status: "approved" });
    await t.mutation(api.employeePayments.updateStatus, { id, status: "queued" });

    const balanceBefore = await t.query(api.balances.getForCompany, {
      companyId,
      currency: "USD",
    });

    await t.mutation(api.employeePayments.updateStatus, {
      id,
      status: "settled",
      settledAt: Date.now(),
    });

    const balanceAfter = await t.query(api.balances.getForCompany, {
      companyId,
      currency: "USD",
    });
    expect(balanceAfter.availableCents).toBe(
      balanceBefore.availableCents - 500000
    );

    const payment = await t.query(api.employeePayments.getById, { id });
    expect(payment!.status).toBe("settled");
  });

  test("invalid transition draft → settled throws", async () => {
    const t = convexTest(schema, modules);
    const { companyId, employeeId } = await setupCompanyWithBalance(t);
    const id = await t.mutation(api.employeePayments.create, {
      companyId,
      employeeId,
      type: "salary",
      amountCents: 100000,
      currency: "USD",
    });
    await expect(
      t.mutation(api.employeePayments.updateStatus, { id, status: "settled" })
    ).rejects.toThrow("Invalid transition");
  });

  test("invalid transition draft → queued throws", async () => {
    const t = convexTest(schema, modules);
    const { companyId, employeeId } = await setupCompanyWithBalance(t);
    const id = await t.mutation(api.employeePayments.create, {
      companyId,
      employeeId,
      type: "salary",
      amountCents: 100000,
      currency: "USD",
    });
    await expect(
      t.mutation(api.employeePayments.updateStatus, { id, status: "queued" })
    ).rejects.toThrow("Invalid transition");
  });

  test("can only edit draft payments", async () => {
    const t = convexTest(schema, modules);
    const { companyId, employeeId } = await setupCompanyWithBalance(t);
    const id = await t.mutation(api.employeePayments.create, {
      companyId,
      employeeId,
      type: "salary",
      amountCents: 100000,
      currency: "USD",
    });
    await t.mutation(api.employeePayments.updateStatus, { id, status: "approved" });
    await expect(
      t.mutation(api.employeePayments.update, { id, amountCents: 200000 })
    ).rejects.toThrow("Can only edit payments in draft status");
  });

  test("can only remove draft or failed payments", async () => {
    const t = convexTest(schema, modules);
    const { companyId, employeeId } = await setupCompanyWithBalance(t);
    const id = await t.mutation(api.employeePayments.create, {
      companyId,
      employeeId,
      type: "salary",
      amountCents: 100000,
      currency: "USD",
    });
    await t.mutation(api.employeePayments.updateStatus, { id, status: "approved" });
    await expect(
      t.mutation(api.employeePayments.remove, { id })
    ).rejects.toThrow("Can only remove draft or failed");
  });

  test("list by employee", async () => {
    const t = convexTest(schema, modules);
    const { companyId, employeeId } = await setupCompanyWithBalance(t);
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
});

describe("customer payments - status workflow", () => {
  test("create with draft status", async () => {
    const t = convexTest(schema, modules);
    const { companyId, customerId } = await setupCompanyWithCustomer(t);
    const id = await t.mutation(api.customerPayments.create, {
      companyId,
      customerId,
      mode: "invoice",
      amountCents: 500000,
      currency: "USD",
    });
    const payment = await t.query(api.customerPayments.getById, { id });
    expect(payment!.status).toBe("draft");
  });

  test("draft → sent → pending → paid credits treasury", async () => {
    const t = convexTest(schema, modules);
    const { companyId, customerId } = await setupCompanyWithCustomer(t);
    const id = await t.mutation(api.customerPayments.create, {
      companyId,
      customerId,
      mode: "invoice",
      amountCents: 500000,
      currency: "USD",
    });

    await t.mutation(api.customerPayments.updateStatus, { id, status: "sent" });
    await t.mutation(api.customerPayments.updateStatus, { id, status: "pending" });

    const balanceBefore = await t.query(api.balances.getForCompany, {
      companyId,
      currency: "USD",
    });

    await t.mutation(api.customerPayments.updateStatus, {
      id,
      status: "paid",
      paidAt: Date.now(),
    });

    const balanceAfter = await t.query(api.balances.getForCompany, {
      companyId,
      currency: "USD",
    });
    expect(balanceAfter.availableCents).toBe(
      balanceBefore.availableCents + 500000
    );
  });

  test("invalid transition draft → paid throws", async () => {
    const t = convexTest(schema, modules);
    const { companyId, customerId } = await setupCompanyWithCustomer(t);
    const id = await t.mutation(api.customerPayments.create, {
      companyId,
      customerId,
      mode: "invoice",
      amountCents: 500000,
      currency: "USD",
    });
    await expect(
      t.mutation(api.customerPayments.updateStatus, {
        id,
        status: "paid",
        paidAt: Date.now(),
      })
    ).rejects.toThrow("Invalid transition");
  });

  test("can cancel and reopen", async () => {
    const t = convexTest(schema, modules);
    const { companyId, customerId } = await setupCompanyWithCustomer(t);
    const id = await t.mutation(api.customerPayments.create, {
      companyId,
      customerId,
      mode: "invoice",
      amountCents: 500000,
      currency: "USD",
    });
    await t.mutation(api.customerPayments.updateStatus, { id, status: "sent" });
    await t.mutation(api.customerPayments.updateStatus, { id, status: "cancelled" });
    const cancelled = await t.query(api.customerPayments.getById, { id });
    expect(cancelled!.status).toBe("cancelled");

    await t.mutation(api.customerPayments.updateStatus, { id, status: "draft" });
    const reopened = await t.query(api.customerPayments.getById, { id });
    expect(reopened!.status).toBe("draft");
  });

  test("can only remove draft or cancelled", async () => {
    const t = convexTest(schema, modules);
    const { companyId, customerId } = await setupCompanyWithCustomer(t);
    const id = await t.mutation(api.customerPayments.create, {
      companyId,
      customerId,
      mode: "invoice",
      amountCents: 500000,
      currency: "USD",
    });
    await t.mutation(api.customerPayments.updateStatus, { id, status: "sent" });
    await expect(
      t.mutation(api.customerPayments.remove, { id })
    ).rejects.toThrow("Can only remove draft or cancelled");
  });

  test("list by customer", async () => {
    const t = convexTest(schema, modules);
    const { companyId, customerId } = await setupCompanyWithCustomer(t);
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
});
