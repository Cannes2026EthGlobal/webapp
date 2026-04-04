import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const http = httpRouter();

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Api-Key",
  };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}

function err(message: string, status: number): Response {
  return json({ error: message }, status);
}

async function hashKey(key: string): Promise<string> {
  const data = new TextEncoder().encode(key);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// CORS preflight
http.route({
  pathPrefix: "/api/v1/",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }),
});

// POST /api/v1/payments — create a customer payment
http.route({
  path: "/api/v1/payments",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const apiKey = req.headers.get("X-Api-Key");
    if (!apiKey) return err("Missing X-Api-Key header", 401);

    const keyHash = await hashKey(apiKey);
    const auth = await ctx.runQuery(internal.apiKeys.validateKeyHash, { keyHash });
    if (!auth) return err("Invalid or revoked API key", 401);

    await ctx.runMutation(internal.apiKeys.touchLastUsed, { id: auth.apiKeyId });

    const body = await req.json();
    const { amount, currency, description, mode } = body as {
      amount: number;
      currency?: string;
      description?: string;
      mode?: string;
    };

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return err("amount must be a positive number (in dollars)", 400);
    }

    const amountCents = Math.round(amount * 100);
    const cur = currency === "EUR" ? "EUR" as const : "USD" as const;
    const paymentMode = mode === "usage" ? "usage" as const
      : mode === "one-time" ? "one-time" as const
      : mode === "checkout" ? "checkout" as const
      : "invoice" as const;

    const paymentId: Id<"customerPayments"> = await ctx.runMutation(api.customerPayments.create, {
      companyId: auth.companyId,
      mode: paymentMode,
      amountCents,
      currency: cur,
      description: description ?? "API payment",
      referenceId: `arc::${auth.companyId}::${Date.now()}`,
    });

    return json({
      paymentId,
      amount,
      currency: cur,
      mode: paymentMode,
      status: "draft",
    }, 201);
  }),
});

// GET /api/v1/payments — list payments for this company
http.route({
  path: "/api/v1/payments",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const apiKey = req.headers.get("X-Api-Key");
    if (!apiKey) return err("Missing X-Api-Key header", 401);

    const keyHash = await hashKey(apiKey);
    const auth = await ctx.runQuery(internal.apiKeys.validateKeyHash, { keyHash });
    if (!auth) return err("Invalid or revoked API key", 401);

    const url = new URL(req.url);
    const status = url.searchParams.get("status") as any;

    const payments = await ctx.runQuery(api.customerPayments.listByCompany, {
      companyId: auth.companyId,
      ...(status ? { status } : {}),
    });

    return json({ data: payments });
  }),
});

// GET /api/v1/balance — get company balance
http.route({
  path: "/api/v1/balance",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const apiKey = req.headers.get("X-Api-Key");
    if (!apiKey) return err("Missing X-Api-Key header", 401);

    const keyHash = await hashKey(apiKey);
    const auth = await ctx.runQuery(internal.apiKeys.validateKeyHash, { keyHash });
    if (!auth) return err("Invalid or revoked API key", 401);

    const balance = await ctx.runQuery(api.balances.getForCompany, {
      companyId: auth.companyId,
      currency: "USD",
    });

    return json(balance);
  }),
});

export default http;
