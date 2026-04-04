/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("companies", () => {
  test("create and get by id", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.mutation(api.users.getOrCreateByWallet, { walletAddress: "0xabc" });
    const id = await t.mutation(api.companies.create, {
      name: "Test Corp",
      slug: "test-corp",
      userId,
    });
    const company = await t.query(api.companies.getById, { id });
    expect(company).toMatchObject({
      name: "Test Corp",
      slug: "test-corp",
      ownerId: userId,
    });
  });

  test("enforce unique slugs", async () => {
    const t = convexTest(schema, modules);
    const userId1 = await t.mutation(api.users.getOrCreateByWallet, { walletAddress: "0x1" });
    const userId2 = await t.mutation(api.users.getOrCreateByWallet, { walletAddress: "0x2" });
    await t.mutation(api.companies.create, {
      name: "Corp A",
      slug: "unique-slug",
      userId: userId1,
    });
    await expect(
      t.mutation(api.companies.create, {
        name: "Corp B",
        slug: "unique-slug",
        userId: userId2,
      })
    ).rejects.toThrow("already exists");
  });

  test("get by userId returns member companies", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.mutation(api.users.getOrCreateByWallet, { walletAddress: "0xwallet1" });
    await t.mutation(api.companies.create, {
      name: "Wallet Corp",
      slug: "wallet-corp",
      userId,
    });
    const results = await t.query(api.companies.getByUserId, { userId });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Wallet Corp");
    expect(results[0].role).toBe("owner");
  });

  test("get by slug", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.mutation(api.users.getOrCreateByWallet, { walletAddress: "0x1" });
    await t.mutation(api.companies.create, {
      name: "Slug Corp",
      slug: "slug-corp",
      userId,
    });
    const company = await t.query(api.companies.getBySlug, {
      slug: "slug-corp",
    });
    expect(company).not.toBeNull();
    expect(company!.name).toBe("Slug Corp");
  });

  test("different users see only their own companies", async () => {
    const t = convexTest(schema, modules);
    const userId1 = await t.mutation(api.users.getOrCreateByWallet, { walletAddress: "0xuser1" });
    const userId2 = await t.mutation(api.users.getOrCreateByWallet, { walletAddress: "0xuser2" });
    await t.mutation(api.companies.create, { name: "A", slug: "a", userId: userId1 });
    await t.mutation(api.companies.create, { name: "B", slug: "b", userId: userId2 });
    const user1Companies = await t.query(api.companies.getByUserId, { userId: userId1 });
    const user2Companies = await t.query(api.companies.getByUserId, { userId: userId2 });
    expect(user1Companies).toHaveLength(1);
    expect(user2Companies).toHaveLength(1);
    expect(user1Companies[0].name).toBe("A");
    expect(user2Companies[0].name).toBe("B");
  });

  test("update company", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.mutation(api.users.getOrCreateByWallet, { walletAddress: "0x1" });
    const id = await t.mutation(api.companies.create, {
      name: "Old Name",
      slug: "old",
      userId,
    });
    await t.mutation(api.companies.update, { id, name: "New Name" });
    const updated = await t.query(api.companies.getById, { id });
    expect(updated!.name).toBe("New Name");
  });

  test("remove company also removes memberships", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.mutation(api.users.getOrCreateByWallet, { walletAddress: "0x1" });
    const id = await t.mutation(api.companies.create, {
      name: "Temp",
      slug: "temp",
      userId,
    });
    await t.mutation(api.companies.remove, { id });
    const result = await t.query(api.companies.getById, { id });
    expect(result).toBeNull();
    const companies = await t.query(api.companies.getByUserId, { userId });
    expect(companies).toHaveLength(0);
  });
});
