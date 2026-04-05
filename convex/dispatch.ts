"use node";

import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { createWalletClient, http, parseUnits, encodeFunctionData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia, baseSepolia } from "viem/chains";

const PRIVATE_KEY = process.env.DISPATCH_PRIVATE_KEY as `0x${string}` | undefined;
const CHAIN = process.env.DISPATCH_CHAIN ?? "arbitrum";
const RPC_URL = process.env.DISPATCH_RPC_URL ?? "https://sepolia-rollup.arbitrum.io/rpc";
const USDC_ADDRESS = (process.env.DISPATCH_USDC_ADDRESS ?? "0xaf88d065e77c8cc2239327c5edb3a432268e5831") as `0x${string}`;

const ERC20_TRANSFER_ABI = [
  {
    type: "function" as const,
    name: "transfer" as const,
    inputs: [
      { name: "to" as const, type: "address" as const },
      { name: "value" as const, type: "uint256" as const },
    ],
    outputs: [{ name: "" as const, type: "bool" as const }],
    stateMutability: "nonpayable" as const,
  },
];

// ─── Internal helpers ───

export const getUndispatchedPayments = internalQuery({
  args: {},
  handler: async (ctx) => {
    const allPaid = await ctx.db.query("customerPayments").take(500);
    return allPaid.filter((p) => p.status === "paid" && !p.dispatched);
  },
});

export const markDispatched = internalMutation({
  args: { paymentIds: v.array(v.id("customerPayments")) },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const id of args.paymentIds) {
      await ctx.db.patch(id, { dispatched: true, dispatchedAt: now });
    }
  },
});

export const createDispatchRecord = internalMutation({
  args: {
    companyId: v.id("companies"),
    destinationAddress: v.string(),
    amountCents: v.number(),
    chain: v.string(),
    paymentIds: v.array(v.id("customerPayments")),
    txHash: v.optional(v.string()),
    status: v.union(v.literal("sent"), v.literal("failed")),
    errorMessage: v.optional(v.string()),
    isReferral: v.optional(v.boolean()),
    referralName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("dispatchRecords", {
      ...args,
      currency: "USD",
    });
  },
});

export const getCompany = internalQuery({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => await ctx.db.get(args.companyId),
});

export const getCheckoutLink = internalQuery({
  args: { linkId: v.id("checkoutLinks") },
  handler: async (ctx, args) => await ctx.db.get(args.linkId),
});

export const listRecent = internalQuery({
  args: {},
  handler: async (ctx) => await ctx.db.query("dispatchRecords").order("desc").take(50),
});

// ─── Send USDC ───

async function sendUsdc(to: string, amountCents: number): Promise<{ txHash: string } | { error: string }> {
  if (!PRIVATE_KEY) return { error: "DISPATCH_PRIVATE_KEY not configured" };
  try {
    const account = privateKeyToAccount(PRIVATE_KEY);
    const chain = CHAIN === "base" ? baseSepolia : arbitrumSepolia;
    const client = createWalletClient({ account, chain, transport: http(RPC_URL) });
    const amount = parseUnits(String(amountCents / 100), 6);
    const txHash = await client.sendTransaction({
      to: USDC_ADDRESS,
      data: encodeFunctionData({
        abi: ERC20_TRANSFER_ABI,
        functionName: "transfer",
        args: [to as `0x${string}`, amount],
      }),
    });
    return { txHash };
  } catch (e: any) {
    return { error: e.message?.slice(0, 200) ?? "Transfer failed" };
  }
}

// ─── Main dispatch ───

export const dispatchAll = action({
  args: {},
  handler: async (ctx): Promise<{
    dispatched: number;
    failed: number;
    transfers: Array<{ to: string; amountCents: number; txHash?: string; error?: string }>;
  }> => {
    if (!PRIVATE_KEY) {
      return { dispatched: 0, failed: 0, transfers: [{ to: "", amountCents: 0, error: "DISPATCH_PRIVATE_KEY not set" }] };
    }

    const payments = await ctx.runQuery(internal.dispatch.getUndispatchedPayments, {});
    if (payments.length === 0) return { dispatched: 0, failed: 0, transfers: [] };

    type Transfer = { destinationAddress: string; amountCents: number; companyId: string; paymentIds: string[]; isReferral?: boolean; referralName?: string };
    const transfers = new Map<string, Transfer>();

    for (const payment of payments) {
      let destination: string | undefined;
      let referralDestination: string | undefined;
      let referralCut = 0;
      let referralName: string | undefined;

      if (payment.checkoutLinkId) {
        const link = await ctx.runQuery(internal.dispatch.getCheckoutLink, { linkId: payment.checkoutLinkId });
        if (link?.recipientAddress) destination = link.recipientAddress;
        if (link?.referralPercentage && link.referralPercentage > 0 && link.referralWalletAddress) {
          referralCut = Math.round((payment.amountCents * link.referralPercentage) / 100);
          referralDestination = link.referralWalletAddress;
          referralName = link.referralName ?? "Referrer";
        }
      }

      if (!destination) {
        const company = await ctx.runQuery(internal.dispatch.getCompany, { companyId: payment.companyId });
        destination = company?.settlementAddress;
      }

      if (!destination) continue;

      const mainAmount = payment.amountCents - referralCut;
      const mainKey = `${payment.companyId}::${destination}`;
      const existing = transfers.get(mainKey);
      if (existing) { existing.amountCents += mainAmount; existing.paymentIds.push(payment._id); }
      else { transfers.set(mainKey, { destinationAddress: destination, amountCents: mainAmount, companyId: payment.companyId, paymentIds: [payment._id] }); }

      if (referralDestination && referralCut > 0) {
        const refKey = `ref::${referralDestination}`;
        const existingRef = transfers.get(refKey);
        if (existingRef) { existingRef.amountCents += referralCut; existingRef.paymentIds.push(payment._id); }
        else { transfers.set(refKey, { destinationAddress: referralDestination, amountCents: referralCut, companyId: payment.companyId, paymentIds: [payment._id], isReferral: true, referralName }); }
      }
    }

    let dispatched = 0;
    let failed = 0;
    const results: Array<{ to: string; amountCents: number; txHash?: string; error?: string }> = [];

    for (const transfer of transfers.values()) {
      if (transfer.amountCents <= 0) continue;
      const result = await sendUsdc(transfer.destinationAddress, transfer.amountCents);
      if ("txHash" in result) {
        await ctx.runMutation(internal.dispatch.createDispatchRecord, {
          companyId: transfer.companyId as any, destinationAddress: transfer.destinationAddress,
          amountCents: transfer.amountCents, chain: CHAIN, paymentIds: transfer.paymentIds as any[],
          txHash: result.txHash, status: "sent", isReferral: transfer.isReferral, referralName: transfer.referralName,
        });
        dispatched++;
        results.push({ to: transfer.destinationAddress, amountCents: transfer.amountCents, txHash: result.txHash });
      } else {
        await ctx.runMutation(internal.dispatch.createDispatchRecord, {
          companyId: transfer.companyId as any, destinationAddress: transfer.destinationAddress,
          amountCents: transfer.amountCents, chain: CHAIN, paymentIds: transfer.paymentIds as any[],
          status: "failed", errorMessage: result.error,
        });
        failed++;
        results.push({ to: transfer.destinationAddress, amountCents: transfer.amountCents, error: result.error });
      }
    }

    await ctx.runMutation(internal.dispatch.markDispatched, { paymentIds: payments.map((p) => p._id) as any[] });
    return { dispatched, failed, transfers: results };
  },
});
