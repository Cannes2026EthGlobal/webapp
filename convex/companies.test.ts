/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("companies", () => {
  test("create and get by id", async () => {
    const t = convexTest(schema, modules);
    const id = await t.mutation(api.companies.create, {
      name: "Test Corp",
      slug: "test-corp",
      ownerWallet: "0xabc",
    });
    const company = await t.query(api.companies.getById, { id });
    expect(company).toMatchObject({
      name: "Test Corp",
      slug: "test-corp",
      ownerWallet: "0xabc",
    });
  });

  test("enforce unique slugs", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.companies.create, {
      name: "Corp A",
      slug: "unique-slug",
      ownerWallet: "0x1",
    });
    await expect(
      t.mutation(api.companies.create, {
        name: "Corp B",
        slug: "unique-slug",
        ownerWallet: "0x2",
      })
    ).rejects.toThrow("already exists");
  });

  test("get by wallet", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.companies.create, {
      name: "Wallet Corp",
      slug: "wallet-corp",
      ownerWallet: "0xwallet1",
    });
    const results = await t.query(api.companies.getByWallet, {
      wallet: "0xwallet1",
    });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Wallet Corp");
  });

  test("get by slug", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.companies.create, {
      name: "Slug Corp",
      slug: "slug-corp",
      ownerWallet: "0x1",
    });
    const company = await t.query(api.companies.getBySlug, {
      slug: "slug-corp",
    });
    expect(company).not.toBeNull();
    expect(company!.name).toBe("Slug Corp");
  });

  test("list companies", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.companies.create, {
      name: "A",
      slug: "a",
      ownerWallet: "0x1",
    });
    await t.mutation(api.companies.create, {
      name: "B",
      slug: "b",
      ownerWallet: "0x2",
    });
    const all = await t.query(api.companies.list);
    expect(all).toHaveLength(2);
  });

  test("update company", async () => {
    const t = convexTest(schema, modules);
    const id = await t.mutation(api.companies.create, {
      name: "Old Name",
      slug: "old",
      ownerWallet: "0x1",
    });
    await t.mutation(api.companies.update, { id, name: "New Name" });
    const updated = await t.query(api.companies.getById, { id });
    expect(updated!.name).toBe("New Name");
  });

  test("remove company", async () => {
    const t = convexTest(schema, modules);
    const id = await t.mutation(api.companies.create, {
      name: "Temp",
      slug: "temp",
      ownerWallet: "0x1",
    });
    await t.mutation(api.companies.remove, { id });
    const result = await t.query(api.companies.getById, { id });
    expect(result).toBeNull();
  });
});
