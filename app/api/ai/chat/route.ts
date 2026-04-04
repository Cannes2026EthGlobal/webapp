import { streamText, tool, convertToModelMessages, stepCountIs } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// ─── Helper to cast string → Convex Id ───
const cId = (s: string) => s as Id<"companies">;
const eId = (s: string) => s as Id<"employees">;
const cuId = (s: string) => s as Id<"customers">;
const pId = (s: string) => s as Id<"products">;
const utId = (s: string) => s as Id<"usageTabs">;
const crId = (s: string) => s as Id<"creditRequests">;

// ─── Read tools ───

const readTools = {
  get_dashboard_stats: tool({
    description: "Get company dashboard stats: treasury, payroll due, receivables, usage revenue, active employees",
    inputSchema: z.object({ companyId: z.string() }),
    execute: async (args) => convex.query(api.overview.stats, { companyId: cId(args.companyId) }),
  }),

  get_treasury_balance: tool({
    description: "Get company treasury balance (available, credited, debited)",
    inputSchema: z.object({ companyId: z.string(), currency: z.enum(["USD", "EUR"]) }),
    execute: async (args) => convex.query(api.balances.getForCompany, { companyId: cId(args.companyId), currency: args.currency }),
  }),

  get_balance_ledger: tool({
    description: "Get recent treasury ledger entries (credits and debits with reasons)",
    inputSchema: z.object({ companyId: z.string() }),
    execute: async (args) => convex.query(api.balances.getEntriesForCompany, { companyId: cId(args.companyId) }),
  }),

  get_settlement_chart: tool({
    description: "Get daily inbound/outbound settlement chart data",
    inputSchema: z.object({ companyId: z.string() }),
    execute: async (args) => convex.query(api.overview.settlementChart, { companyId: cId(args.companyId) }),
  }),

  list_employees: tool({
    description: "List all employees for a company, optionally filtered by status",
    inputSchema: z.object({
      companyId: z.string(),
      status: z.enum(["active", "inactive"]).optional(),
    }),
    execute: async (args) => convex.query(api.employees.listByCompany, { companyId: cId(args.companyId), status: args.status }),
  }),

  get_employee: tool({
    description: "Get full details of a specific employee",
    inputSchema: z.object({ id: z.string() }),
    execute: async (args) => convex.query(api.employees.getById, { id: eId(args.id) }),
  }),

  list_compensation_lines: tool({
    description: "List compensation lines (salary items) for an employee or whole company",
    inputSchema: z.object({ employeeId: z.string().optional(), companyId: z.string().optional() }),
    execute: async (args) => {
      if (args.employeeId) return convex.query(api.compensationLines.listByEmployee, { employeeId: eId(args.employeeId) });
      if (args.companyId) return convex.query(api.compensationLines.listByCompany, { companyId: cId(args.companyId) });
      return { error: "Provide either employeeId or companyId" };
    },
  }),

  list_customers: tool({
    description: "List all customers for a company, optionally filtered by billing state",
    inputSchema: z.object({
      companyId: z.string(),
      billingState: z.enum(["active", "overdue", "paused", "churned"]).optional(),
    }),
    execute: async (args) => convex.query(api.customers.listByCompany, { companyId: cId(args.companyId), billingState: args.billingState }),
  }),

  get_customer: tool({
    description: "Get full details of a specific customer",
    inputSchema: z.object({ id: z.string() }),
    execute: async (args) => convex.query(api.customers.getById, { id: cuId(args.id) }),
  }),

  list_products: tool({
    description: "List all products for a company, optionally only active ones",
    inputSchema: z.object({ companyId: z.string(), activeOnly: z.boolean().optional() }),
    execute: async (args) => convex.query(api.products.listByCompany, { companyId: cId(args.companyId), activeOnly: args.activeOnly }),
  }),

  get_product: tool({
    description: "Get full details of a specific product",
    inputSchema: z.object({ id: z.string() }),
    execute: async (args) => convex.query(api.products.getById, { id: pId(args.id) }),
  }),

  list_employee_payments: tool({
    description: "List employee (outbound) payments, optionally filtered by status",
    inputSchema: z.object({
      companyId: z.string(),
      status: z.enum(["draft", "approved", "queued", "settled", "failed"]).optional(),
    }),
    execute: async (args) => convex.query(api.employeePayments.listByCompany, { companyId: cId(args.companyId), status: args.status }),
  }),

  list_customer_payments: tool({
    description: "List customer (inbound) payments, optionally filtered by status",
    inputSchema: z.object({
      companyId: z.string(),
      status: z.enum(["draft", "sent", "pending", "paid", "overdue", "cancelled"]).optional(),
    }),
    execute: async (args) => convex.query(api.customerPayments.listByCompany, { companyId: cId(args.companyId), status: args.status }),
  }),

  list_payments_by_employee: tool({
    description: "List all payments for a specific employee",
    inputSchema: z.object({ employeeId: z.string() }),
    execute: async (args) => convex.query(api.employeePayments.listByEmployee, { employeeId: eId(args.employeeId) }),
  }),

  list_payments_by_customer: tool({
    description: "List all payments from a specific customer",
    inputSchema: z.object({ customerId: z.string() }),
    execute: async (args) => convex.query(api.customerPayments.listByCustomer, { customerId: cuId(args.customerId) }),
  }),

  list_usage_tabs: tool({
    description: "List usage billing tabs, optionally filtered by status (open, billed, paid)",
    inputSchema: z.object({
      companyId: z.string(),
      status: z.enum(["open", "billed", "paid"]).optional(),
    }),
    execute: async (args) => convex.query(api.usageTabs.listByCompany, { companyId: cId(args.companyId), status: args.status }),
  }),

  get_usage_tab_entries: tool({
    description: "Get detailed usage entries for a specific usage tab",
    inputSchema: z.object({ tabId: z.string() }),
    execute: async (args) => convex.query(api.usageTabs.getEntries, { tabId: utId(args.tabId) }),
  }),

  get_payroll_forecast: tool({
    description: "Get 3-month payroll forecast with per-employee breakdown",
    inputSchema: z.object({ companyId: z.string() }),
    execute: async (args) => convex.query(api.payrollForecast.upcoming, { companyId: cId(args.companyId) }),
  }),

  get_advance_summary: tool({
    description: "Get salary advance/credit request summary",
    inputSchema: z.object({ companyId: z.string() }),
    execute: async (args) => convex.query(api.payrollForecast.advanceSummary, { companyId: cId(args.companyId) }),
  }),

  list_checkout_links: tool({
    description: "List all checkout links for a company",
    inputSchema: z.object({ companyId: z.string() }),
    execute: async (args) => convex.query(api.checkoutLinks.listByCompany, { companyId: cId(args.companyId) }),
  }),

  list_advance_requests: tool({
    description: "List salary advance/credit requests, optionally filtered by status",
    inputSchema: z.object({
      companyId: z.string(),
      status: z.enum(["pending", "approved", "denied", "settled", "deducted", "cancelled"]).optional(),
    }),
    execute: async (args) => convex.query(api.advanceRequests.listByCompany, { companyId: cId(args.companyId), status: args.status }),
  }),
};

// ─── Write tools (require human confirmation) ───

const writeTools = {
  propose_create_employee: tool({
    description: "Propose creating a new employee. Returns a proposal for user confirmation.",
    inputSchema: z.object({
      companyId: z.string(),
      displayName: z.string(),
      role: z.string(),
      employmentType: z.enum(["full-time", "part-time", "contractor", "freelance"]),
      walletAddress: z.string().optional(),
      privacyLevel: z.enum(["pseudonymous", "verified", "shielded"]).optional(),
      email: z.string().optional(),
    }),
    execute: async (params) => ({
      _action: "create_employee" as const,
      _requiresConfirmation: true as const,
      ...params,
      privacyLevel: params.privacyLevel ?? "pseudonymous",
    }),
  }),

  propose_create_customer: tool({
    description: "Propose creating a new customer. Returns a proposal for user confirmation.",
    inputSchema: z.object({
      companyId: z.string(),
      displayName: z.string(),
      customerType: z.enum(["company", "app", "agent", "buyer"]),
      pricingModel: z.enum(["usage", "invoice", "one-time", "subscription"]),
      billingState: z.enum(["active", "overdue", "paused", "churned"]).optional(),
      walletAddress: z.string().optional(),
      email: z.string().optional(),
    }),
    execute: async (params) => ({
      _action: "create_customer" as const,
      _requiresConfirmation: true as const,
      ...params,
      billingState: params.billingState ?? "active",
    }),
  }),

  propose_create_product: tool({
    description: "Propose creating a new product. Returns a proposal for user confirmation.",
    inputSchema: z.object({
      companyId: z.string(),
      name: z.string(),
      description: z.string().optional(),
      billingUnit: z.string(),
      pricingModel: z.enum(["per-unit", "pay-as-you-go"]),
      unitPriceCents: z.number(),
      currency: z.enum(["USD", "EUR"]).optional(),
      settlementAsset: z.string().optional(),
      privacyMode: z.enum(["standard", "shielded", "pseudonymous"]).optional(),
      refundPolicy: z.enum(["no-refund", "partial", "full"]).optional(),
    }),
    execute: async (params) => ({
      _action: "create_product" as const,
      _requiresConfirmation: true as const,
      ...params,
      currency: params.currency ?? "USD",
      settlementAsset: params.settlementAsset ?? "USDC",
      privacyMode: params.privacyMode ?? "standard",
      refundPolicy: params.refundPolicy ?? "no-refund",
    }),
  }),

  propose_create_employee_payment: tool({
    description: "Propose creating an employee payment (salary, bonus, etc). Returns a proposal for user confirmation.",
    inputSchema: z.object({
      companyId: z.string(),
      employeeId: z.string(),
      type: z.enum(["salary", "freelance", "bonus", "reimbursement", "credit"]),
      amountCents: z.number().describe("Amount in cents (50000 = $500.00)"),
      currency: z.enum(["USD", "EUR"]).optional(),
      description: z.string().optional(),
    }),
    execute: async (params) => ({
      _action: "create_employee_payment" as const,
      _requiresConfirmation: true as const,
      ...params,
      currency: params.currency ?? "USD",
    }),
  }),

  propose_create_customer_payment: tool({
    description: "Propose creating a customer payment/invoice. Returns a proposal for user confirmation.",
    inputSchema: z.object({
      companyId: z.string(),
      customerId: z.string().optional(),
      productId: z.string().optional(),
      mode: z.enum(["usage", "invoice", "one-time", "checkout"]),
      amountCents: z.number().describe("Amount in cents"),
      currency: z.enum(["USD", "EUR"]).optional(),
      description: z.string().optional(),
    }),
    execute: async (params) => ({
      _action: "create_customer_payment" as const,
      _requiresConfirmation: true as const,
      ...params,
      currency: params.currency ?? "USD",
    }),
  }),

  propose_update_payment_status: tool({
    description: "Propose updating a payment status (approve, settle, mark paid). Returns a proposal for user confirmation.",
    inputSchema: z.object({
      paymentId: z.string(),
      paymentType: z.enum(["employee", "customer"]),
      newStatus: z.string(),
    }),
    execute: async (params) => ({
      _action: "update_payment_status" as const,
      _requiresConfirmation: true as const,
      ...params,
    }),
  }),

  propose_update_employee: tool({
    description: "Propose updating an employee's details. Returns a proposal for user confirmation.",
    inputSchema: z.object({
      id: z.string(),
      displayName: z.string().optional(),
      role: z.string().optional(),
      status: z.enum(["active", "inactive"]).optional(),
      walletAddress: z.string().optional(),
      email: z.string().optional(),
    }),
    execute: async (params) => ({
      _action: "update_employee" as const,
      _requiresConfirmation: true as const,
      ...params,
    }),
  }),

  propose_update_customer: tool({
    description: "Propose updating a customer's details. Returns a proposal for user confirmation.",
    inputSchema: z.object({
      id: z.string(),
      displayName: z.string().optional(),
      billingState: z.enum(["active", "overdue", "paused", "churned"]).optional(),
      walletAddress: z.string().optional(),
      email: z.string().optional(),
    }),
    execute: async (params) => ({
      _action: "update_customer" as const,
      _requiresConfirmation: true as const,
      ...params,
    }),
  }),

  propose_approve_advance: tool({
    description: "Propose approving a salary advance request. Returns a proposal for user confirmation.",
    inputSchema: z.object({ id: z.string() }),
    execute: async (params) => ({
      _action: "approve_advance" as const,
      _requiresConfirmation: true as const,
      id: params.id,
    }),
  }),

  propose_deny_advance: tool({
    description: "Propose denying a salary advance request. Returns a proposal for user confirmation.",
    inputSchema: z.object({ id: z.string(), denyReason: z.string().optional() }),
    execute: async (params) => ({
      _action: "deny_advance" as const,
      _requiresConfirmation: true as const,
      ...params,
    }),
  }),
};

const SYSTEM_PROMPT = `You are Arc, the AI assistant for Arc Counting — a SaaS accounting platform for private payment, payroll, invoicing, and real-time usage settlement.

You have access to tools that let you read all company data and propose write operations. You help operators manage their business by answering questions, analyzing data, and helping with operations.

IMPORTANT RULES:
1. You ALWAYS have the companyId available from the conversation context. Use it for all tool calls.
2. For READ operations (queries), execute tools directly and present results clearly.
3. For WRITE operations (mutations), ALWAYS use the "propose_" tools. These return proposals that the user must confirm before execution. Never claim you've made a change — always say you're proposing it for their approval.
4. Format monetary values as dollars (divide cents by 100). For example, 50000 cents = $500.00.
5. Be concise but thorough. Use tables and structured formats when presenting lists.
6. Keep blockchain details secondary — focus on business operations.
7. Protect privacy — don't expose sensitive identity fields unless specifically asked.

You are calm, precise, and operator-focused. Think of yourself as a financial operations co-pilot.`;

export async function POST(req: Request) {
  const { messages, companyId: cidParam } = await req.json();

  if (!cidParam) {
    return new Response(JSON.stringify({ error: "Missing companyId" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const systemWithContext = `${SYSTEM_PROMPT}\n\nCurrent company ID: ${cidParam}\nAlways use this companyId for tool calls unless the user specifies a different one.`;

  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: systemWithContext,
    messages: modelMessages,
    tools: { ...readTools, ...writeTools },
    stopWhen: stepCountIs(10),
  });

  return result.toUIMessageStreamResponse();
}
