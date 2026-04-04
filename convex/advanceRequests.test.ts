/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function setupCompanyAndEmployee(t: ReturnType<typeof convexTest>) {
  const companyId = await t.mutation(api.companies.create, {
    name: "Test Co",
    slug: "test-co",
    ownerWallet: "0xTEST",
  });

  const employeeId = await t.mutation(api.employees.create, {
    companyId,
    displayName: "Alice",
    role: "Engineer",
    employmentType: "full-time",
    compensationModel: "salary",
    payoutAsset: "USDC",
    payoutAmountCents: 1000000,
    payoutFrequency: "monthly",
    walletVerified: true,
    privacyLevel: "verified",
    status: "active",
  });

  await t.mutation(api.balances.credit, {
    companyId,
    amountCents: 5000000,
    currency: "USD",
    reason: "Initial treasury",
  });

  return { companyId, employeeId };
}

describe("advanceRequests", () => {
  test("employee can request an advance", async () => {
    const t = convexTest(schema, modules);
    const { companyId, employeeId } = await setupCompanyAndEmployee(t);

    const requestId = await t.mutation(api.advanceRequests.request, {
      companyId,
      employeeId,
      requestedAmountCents: 500000,
      currency: "USD",
    });

    const requests = await t.query(api.advanceRequests.listByEmployee, {
      employeeId,
    });
    expect(requests).toHaveLength(1);
    expect(requests[0].status).toBe("pending");
    expect(requests[0].requestedAmountCents).toBe(500000);
    expect(requests[0].interestAmountCents).toBe(10000);
    expect(requests[0].netAmountCents).toBe(490000);
  });

  test("cannot request more than max % of paycheck", async () => {
    const t = convexTest(schema, modules);
    const { companyId, employeeId } = await setupCompanyAndEmployee(t);

    await expect(
      t.mutation(api.advanceRequests.request, {
        companyId,
        employeeId,
        requestedAmountCents: 900000,
        currency: "USD",
      })
    ).rejects.toThrow("Maximum advance");
  });

  test("cannot have two pending requests", async () => {
    const t = convexTest(schema, modules);
    const { companyId, employeeId } = await setupCompanyAndEmployee(t);

    await t.mutation(api.advanceRequests.request, {
      companyId,
      employeeId,
      requestedAmountCents: 300000,
      currency: "USD",
    });

    await expect(
      t.mutation(api.advanceRequests.request, {
        companyId,
        employeeId,
        requestedAmountCents: 200000,
        currency: "USD",
      })
    ).rejects.toThrow("already have a pending");
  });

  test("approve creates an employee payment", async () => {
    const t = convexTest(schema, modules);
    const { companyId, employeeId } = await setupCompanyAndEmployee(t);

    const requestId = await t.mutation(api.advanceRequests.request, {
      companyId,
      employeeId,
      requestedAmountCents: 500000,
      currency: "USD",
    });

    await t.mutation(api.advanceRequests.approve, { id: requestId });

    const requests = await t.query(api.advanceRequests.listByEmployee, {
      employeeId,
    });
    expect(requests[0].status).toBe("approved");
    expect(requests[0].advancePaymentId).toBeTruthy();

    const payments = await t.query(api.employeePayments.listByEmployee, {
      employeeId,
    });
    const advancePayment = payments.find((p) => p.type === "advance");
    expect(advancePayment).toBeTruthy();
    expect(advancePayment!.amountCents).toBe(490000);
    expect(advancePayment!.status).toBe("approved");
  });

  test("deny sets status and reason", async () => {
    const t = convexTest(schema, modules);
    const { companyId, employeeId } = await setupCompanyAndEmployee(t);

    const requestId = await t.mutation(api.advanceRequests.request, {
      companyId,
      employeeId,
      requestedAmountCents: 500000,
      currency: "USD",
    });

    await t.mutation(api.advanceRequests.deny, {
      id: requestId,
      denyReason: "Budget constraints",
    });

    const requests = await t.query(api.advanceRequests.listByEmployee, {
      employeeId,
    });
    expect(requests[0].status).toBe("denied");
    expect(requests[0].denyReason).toBe("Budget constraints");
  });
});

describe("advanceSettings", () => {
  test("returns defaults when no settings exist", async () => {
    const t = convexTest(schema, modules);
    const companyId = await t.mutation(api.companies.create, {
      name: "Default Co",
      slug: "default-co",
      ownerWallet: "0xDEF",
    });

    const settings = await t.query(api.advanceSettings.getForCompany, {
      companyId,
    });
    expect(settings.enabled).toBe(true);
    expect(settings.interestRateBps).toBe(200);
    expect(settings.maxAdvancePercent).toBe(80);
  });

  test("upsert creates and updates settings", async () => {
    const t = convexTest(schema, modules);
    const companyId = await t.mutation(api.companies.create, {
      name: "Settings Co",
      slug: "settings-co",
      ownerWallet: "0xSET",
    });

    await t.mutation(api.advanceSettings.upsert, {
      companyId,
      interestRateBps: 500,
    });

    const settings = await t.query(api.advanceSettings.getForCompany, {
      companyId,
    });
    expect(settings.interestRateBps).toBe(500);
    expect(settings.enabled).toBe(true);
  });
});
