import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-4-20250514";

// Pricing per 1M tokens (in cents)
const INPUT_COST_PER_M = 300; // $3.00 per 1M input tokens
const OUTPUT_COST_PER_M = 1500; // $15.00 per 1M output tokens

function calculateCostCents(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * INPUT_COST_PER_M;
  const outputCost = (outputTokens / 1_000_000) * OUTPUT_COST_PER_M;
  return Math.ceil(inputCost + outputCost);
}

type InsightType =
  | "product_analysis"
  | "customer_importance"
  | "revenue_forecast"
  | "churn_risk"
  | "cashflow_optimization"
  | "payroll_efficiency"
  | "custom";

const SYSTEM_PROMPT = `You are an expert business analyst for Arc Counting, a SaaS accounting platform for private payment, payroll, invoicing, and real-time usage settlement. You analyze business data and provide actionable insights.

Always respond with structured, data-driven analysis. Use specific numbers from the data provided. Format your response in clear sections with headers. Be concise but thorough.

When analyzing, consider:
- Revenue trends and patterns
- Customer behavior and value
- Product performance and pricing optimization
- Operational efficiency
- Risk factors and mitigation strategies
- Growth opportunities`;

const INSIGHT_PROMPTS: Record<InsightType, string> = {
  product_analysis: `Analyze the product portfolio. For each product evaluate:
1. **Revenue Contribution** - which products generate the most revenue?
2. **Pricing Effectiveness** - are unit prices competitive? Any pricing anomalies?
3. **Usage Patterns** - which billing models perform best (per-unit vs pay-as-you-go)?
4. **Product Health Score** - rate each product 1-10 based on activity and revenue
5. **Recommendations** - specific actions to improve product performance

Provide a ranked product scorecard.`,

  customer_importance: `Analyze the customer base and rank customers by importance. Evaluate:
1. **Revenue Impact** - total paid, payment frequency, average transaction size
2. **Engagement Score** - billing state, wallet readiness, usage activity
3. **Customer Segmentation** - group by type (company, app, agent, buyer) and value tier
4. **Lifetime Value Estimate** - project future value based on current patterns
5. **VIP Identification** - who are the top 3 most valuable customers and why?
6. **At-Risk Customers** - who might churn based on billing state or activity?

Provide a customer importance ranking with actionable retention strategies.`,

  revenue_forecast: `Forecast revenue trends based on current data. Analyze:
1. **Current Revenue Run Rate** - monthly/annual based on paid payments
2. **Revenue by Channel** - usage billing vs invoices vs one-time vs checkout
3. **Growth Indicators** - are open tabs/pending payments growing?
4. **Revenue Concentration Risk** - dependency on top customers
5. **30/60/90 Day Forecast** - projected revenue with confidence levels
6. **Revenue Optimization** - specific actions to increase revenue by 20%+

Include scenario analysis: optimistic, realistic, and conservative.`,

  churn_risk: `Assess churn risk across the customer base. Evaluate:
1. **Churn Indicators** - customers with overdue/paused/churned billing states
2. **Payment Failure Patterns** - failed or cancelled payments as early warnings
3. **Engagement Decline** - customers with decreasing usage or activity
4. **Risk Scoring** - score each customer segment for churn probability (low/medium/high)
5. **Early Warning Signals** - what patterns predict churn before it happens?
6. **Retention Playbook** - specific interventions for each risk tier

Quantify the revenue at risk from potential churn.`,

  cashflow_optimization: `Analyze cashflow health and optimization opportunities. Evaluate:
1. **Cash Position** - treasury balance vs obligations
2. **Payroll Burn Rate** - monthly outbound vs inbound ratio
3. **Collection Efficiency** - time from invoice to payment, overdue rates
4. **Liquidity Buffer** - months of runway at current burn rate
5. **Working Capital** - open receivables vs pending payroll
6. **Optimization Actions** - specific steps to improve cashflow by timing, collections, or cost reduction

Provide a cashflow health score (A-F) with justification.`,

  payroll_efficiency: `Analyze payroll operations for efficiency and cost optimization. Evaluate:
1. **Payroll Cost Structure** - breakdown by employment type (full-time, contractor, freelance)
2. **Payment Processing** - success rate, failure rate, average settlement time
3. **Advance Credit Usage** - are employees using salary advances? Impact on treasury
4. **Compensation Analysis** - distribution by role and type
5. **Operational Bottlenecks** - draft vs approved vs settled pipeline health
6. **Cost Savings** - opportunities to reduce payroll overhead or optimize payout timing

Include a payroll efficiency score and specific recommendations.`,

  custom: `Provide a comprehensive business health assessment. Cover:
1. Overall business performance summary
2. Key strengths and weaknesses
3. Most urgent action items
4. Strategic recommendations
5. Risk factors to monitor`,
};

/**
 * POST /api/ai/analyze
 * Run a Claude AI analysis on business data.
 *
 * Body: { companyId, insightType, customPrompt? }
 */
export async function POST(req: NextRequest) {
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const { companyId, insightType, customPrompt } = body as {
      companyId: string;
      insightType: InsightType;
      customPrompt?: string;
    };

    if (!companyId || !insightType) {
      return NextResponse.json(
        { error: "Missing companyId or insightType" },
        { status: 400 }
      );
    }

    // 1. Fetch business context from Convex
    const context = await convex.query(api.aiInsights.getBusinessContext, {
      companyId: companyId as Id<"companies">,
    });

    if (!context.company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // 2. Build the prompt
    const analysisPrompt = insightType === "custom" && customPrompt
      ? customPrompt
      : INSIGHT_PROMPTS[insightType];

    const userMessage = `Here is the business data for "${context.company.name}":

## Company
- Name: ${context.company.name}
- Industry: ${context.company.industry ?? "Not specified"}
- Settlement network: ${context.company.settlementNetwork ?? "Arc"}

## Employees (${context.employees.length} total)
${context.employees.map((e) => `- ${e.displayName} | ${e.role} | ${e.employmentType} | ${e.status}`).join("\n")}

## Customers (${context.customers.length} total)
${context.customers.map((c) => `- ${c.displayName} | ${c.customerType} | ${c.pricingModel} | ${c.billingState}`).join("\n")}

## Products (${context.products.length} total)
${context.products.map((p) => `- ${p.name} | ${p.pricingModel} | $${(p.unitPriceCents / 100).toFixed(4)}/unit (${p.billingUnit}) | ${p.isActive ? "Active" : "Inactive"}`).join("\n")}

## Employee Payments Summary
- Total payments: ${context.employeePaymentsSummary.total}
- Settled: ${context.employeePaymentsSummary.settled} ($${(context.employeePaymentsSummary.totalSettledCents / 100).toFixed(2)})
- Draft: ${context.employeePaymentsSummary.draft}
- Failed: ${context.employeePaymentsSummary.failed}

## Customer Payments Summary
- Total payments: ${context.customerPaymentsSummary.total}
- Paid: ${context.customerPaymentsSummary.paid} ($${(context.customerPaymentsSummary.totalPaidCents / 100).toFixed(2)})
- Pending: ${context.customerPaymentsSummary.pending}
- Overdue: ${context.customerPaymentsSummary.overdue}

## Usage Billing Summary
- Total tabs: ${context.usageTabsSummary.total}
- Open tabs: ${context.usageTabsSummary.open} ($${(context.usageTabsSummary.totalOpenCents / 100).toFixed(2)} pending)
- Paid tabs: ${context.usageTabsSummary.paid} ($${(context.usageTabsSummary.totalPaidCents / 100).toFixed(2)} collected)

## Treasury
- Available balance: $${(context.treasuryBalanceCents / 100).toFixed(2)}

---

${analysisPrompt}`;

    // 3. Call Claude API
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const textContent = response.content.find((c) => c.type === "text");
    const responseText = textContent ? textContent.text : "No analysis generated.";
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const costCents = calculateCostCents(inputTokens, outputTokens);

    // 4. Record usage in Convex
    await convex.mutation(api.aiInsights.recordRequest, {
      companyId: companyId as Id<"companies">,
      insightType,
      prompt: analysisPrompt.slice(0, 500),
      response: responseText,
      inputTokens,
      outputTokens,
      costCents,
      model: MODEL,
    });

    return NextResponse.json({
      analysis: responseText,
      insightType,
      usage: {
        inputTokens,
        outputTokens,
        costCents,
        model: MODEL,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
