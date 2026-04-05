"use client";

import { useState, useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import ReactMarkdown from "react-markdown";
import { api } from "@/convex/_generated/api";
import { useCompany } from "@/hooks/use-company";
import { formatCents } from "@/lib/format";

import { PageHeader } from "@/components/page-header";
import { CompanyGuard } from "@/components/company-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

type InsightType =
  | "product_analysis"
  | "customer_importance"
  | "revenue_forecast"
  | "churn_risk"
  | "cashflow_optimization"
  | "payroll_efficiency"
  | "chat"
  | "custom";

const INSIGHT_CARDS: {
  type: InsightType;
  title: string;
  description: string;
}[] = [
  {
    type: "product_analysis",
    title: "Product Performance",
    description:
      "Evaluate product revenue contribution, pricing effectiveness, and health scores",
  },
  {
    type: "customer_importance",
    title: "Customer Importance",
    description:
      "Rank customers by value, segment by type, and identify VIPs and at-risk accounts",
  },
  {
    type: "revenue_forecast",
    title: "Revenue Forecast",
    description:
      "Project 30/60/90 day revenue with scenario analysis and growth indicators",
  },
  {
    type: "churn_risk",
    title: "Churn Risk Assessment",
    description:
      "Score churn probability per segment, identify early warning signals, and retention playbook",
  },
  {
    type: "cashflow_optimization",
    title: "Cashflow Optimization",
    description:
      "Analyze cash position, burn rate, collection efficiency, and liquidity buffer",
  },
  {
    type: "payroll_efficiency",
    title: "Payroll Efficiency",
    description:
      "Evaluate payroll cost structure, processing success rates, and cost savings opportunities",
  },
];

function AIInsightsContent() {
  const { companyId } = useCompany();
  const [activeAnalysis, setActiveAnalysis] = useState<InsightType | null>(null);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [analysisUsage, setAnalysisUsage] = useState<{
    inputTokens: number;
    outputTokens: number;
    costCents: number;
    model: string;
  } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBilling, setIsBilling] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  const usageSummary = useQuery(
    api.aiInsights.getUsageSummary,
    companyId ? { companyId } : "skip"
  );
  const recentRequests = useQuery(
    api.aiInsights.listRequests,
    companyId ? { companyId } : "skip"
  );
  const bills = useQuery(
    api.aiInsights.listBills,
    companyId ? { companyId } : "skip"
  );

  // Hydrate latest analysis from DB on mount/refresh
  useEffect(() => {
    if (recentRequests && recentRequests.length > 0 && !activeAnalysis && !isAnalyzing) {
      const latest = recentRequests[0];
      setActiveAnalysis(latest.insightType);
      setAnalysisResult(latest.response);
      setAnalysisUsage({
        inputTokens: latest.inputTokens,
        outputTokens: latest.outputTokens,
        costCents: latest.costCents,
        model: latest.model,
      });
    }
  }, [recentRequests]); // eslint-disable-line react-hooks/exhaustive-deps

  const runAnalysis = useCallback(
    async (type: InsightType) => {
      if (!companyId || isAnalyzing) return;
      setActiveAnalysis(type);
      setIsAnalyzing(true);
      setError(null);
      setAnalysisResult(null);
      setAnalysisUsage(null);

      try {
        const res = await fetch("/api/ai/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyId, insightType: type }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Analysis failed");
        setAnalysisResult(data.analysis);
        setAnalysisUsage(data.usage);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setIsAnalyzing(false);
      }
    },
    [companyId, isAnalyzing]
  );

  const handleBillUsage = useCallback(async () => {
    if (!companyId || isBilling) return;
    setIsBilling(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/bill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Billing failed");
      setCheckoutUrl(data.checkoutUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setIsBilling(false);
    }
  }, [companyId, isBilling]);

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      {/* Usage summary cards */}
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Total AI Requests</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {usageSummary?.totalRequests ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Total Tokens Used</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {(
                (usageSummary?.totalInputTokens ?? 0) +
                (usageSummary?.totalOutputTokens ?? 0)
              ).toLocaleString()}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="text-xs">
                In: {(usageSummary?.totalInputTokens ?? 0).toLocaleString()} / Out:{" "}
                {(usageSummary?.totalOutputTokens ?? 0).toLocaleString()}
              </Badge>
            </CardAction>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Total AI Cost</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {formatCents(usageSummary?.totalCostCents ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Unbilled Usage</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {formatCents(usageSummary?.unbilledCostCents ?? 0)}
            </CardTitle>
            <CardAction>
              {(usageSummary?.unbilledCostCents ?? 0) > 0 ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleBillUsage}
                  disabled={isBilling}
                >
                  {isBilling ? "Creating bill..." : "Pay now"}
                </Button>
              ) : (
                <Badge variant="outline" className="text-xs">
                  All paid
                </Badge>
              )}
            </CardAction>
          </CardHeader>
        </Card>
      </div>

      {/* Checkout URL notification */}
      {checkoutUrl && (
        <div className="mx-4 lg:mx-6">
          <Card className="border-green-500/30 bg-green-500/5">
            <CardHeader>
              <CardTitle className="text-base">Payment Link Ready</CardTitle>
              <CardDescription>
                Pay for your AI usage via WalletConnect Pay. Funds go to the
                platform owner.
              </CardDescription>
              <CardAction>
                <Button
                  size="sm"
                  onClick={() => window.open(checkoutUrl, "_blank")}
                >
                  Open Checkout
                </Button>
              </CardAction>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="mx-4 lg:mx-6">
          <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader>
              <CardDescription className="text-destructive">
                {error}
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Analysis tools grid */}
      <div className="px-4 lg:px-6">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Analysis Tools
        </h2>
        <div className="grid grid-cols-1 gap-3 @xl/main:grid-cols-2 @5xl/main:grid-cols-3">
          {INSIGHT_CARDS.map((card) => (
            <Card
              key={card.type}
              className={
                activeAnalysis === card.type
                  ? "ring-2 ring-primary"
                  : "hover:border-primary/30 transition-colors"
              }
            >
              <CardHeader>
                <CardTitle className="text-base">{card.title}</CardTitle>
                <CardDescription className="text-xs">
                  {card.description}
                </CardDescription>
                <CardAction>
                  <Button
                    size="sm"
                    variant={activeAnalysis === card.type ? "default" : "outline"}
                    onClick={() => runAnalysis(card.type)}
                    disabled={isAnalyzing}
                  >
                    {isAnalyzing && activeAnalysis === card.type
                      ? "Analyzing..."
                      : "Run"}
                  </Button>
                </CardAction>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>

      {/* Analysis result */}
      {(analysisResult || isAnalyzing) && (
        <div className="px-4 lg:px-6">
          <Card>
            <CardHeader>
              <CardTitle>
                {INSIGHT_CARDS.find((c) => c.type === activeAnalysis)?.title ??
                  "Analysis"}
              </CardTitle>
              {analysisUsage && (
                <CardAction>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-xs">
                      {analysisUsage.model}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {formatCents(analysisUsage.costCents)}
                    </Badge>
                  </div>
                </CardAction>
              )}
            </CardHeader>
            <CardContent>
              {isAnalyzing ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-4/6" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed">
                  <ReactMarkdown>{analysisResult ?? ""}</ReactMarkdown>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Separator className="mx-4 lg:mx-6" />

      {/* Recent requests */}
      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent AI Requests</CardTitle>
            <CardDescription>
              History of AI-powered analysis requests and their costs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {(!recentRequests || recentRequests.length === 0) && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No AI analysis requests yet. Run an analysis above to get
                  started.
                </p>
              )}
              {recentRequests?.map((req) => (
                <button
                  key={req._id}
                  className="flex w-full items-center justify-between py-3 text-left transition-colors hover:bg-muted/50"
                  onClick={() => {
                    setActiveAnalysis(req.insightType);
                    setAnalysisResult(req.response);
                    setAnalysisUsage({
                      inputTokens: req.inputTokens,
                      outputTokens: req.outputTokens,
                      costCents: req.costCents,
                      model: req.model,
                    });
                    scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs capitalize">
                      {req.insightType.replace(/_/g, " ")}
                    </Badge>
                    <span className="max-w-md truncate text-sm text-muted-foreground">
                      {req.prompt.slice(0, 80)}...
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {(req.inputTokens + req.outputTokens).toLocaleString()} tokens
                    </span>
                    <Badge variant="secondary" className="text-xs tabular-nums">
                      {formatCents(req.costCents)}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Billing history — always show, with pending bills highlighted */}
      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle>AI Usage Invoices</CardTitle>
            <CardDescription>
              Payment history and outstanding invoices for AI usage (analysis + chat)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(!bills || bills.length === 0) ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No invoices yet. AI usage will be billed when you click &quot;Pay now&quot; above.
              </p>
            ) : (
              <div className="divide-y">
                {bills.map((bill) => {
                  const isPending = bill.status === "pending" || bill.status === "billed";
                  return (
                  <div
                    key={bill._id}
                    className={`flex items-center justify-between py-3 ${isPending ? "bg-amber-500/5 -mx-6 px-6" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={
                          bill.status === "paid"
                            ? "default"
                            : bill.status === "billed"
                              ? "outline"
                              : "destructive"
                        }
                        className="text-xs capitalize"
                      >
                        {bill.status === "pending" ? "Unpaid" : bill.status === "billed" ? "Awaiting Payment" : bill.status}
                      </Badge>
                      <span className="text-sm">
                        {bill.totalRequests} requests &middot;{" "}
                        {(
                          bill.totalInputTokens + bill.totalOutputTokens
                        ).toLocaleString()}{" "}
                        tokens
                      </span>
                      {bill.billedAt && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(bill.billedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium tabular-nums">
                        {formatCents(bill.totalCostCents)}
                      </span>
                      {isPending && bill.checkoutUrl && (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() =>
                            window.open(bill.checkoutUrl!, "_blank")
                          }
                        >
                          Pay Now
                        </Button>
                      )}
                      {isPending && !bill.checkoutUrl && (
                        <Badge variant="secondary" className="text-xs">
                          No checkout link
                        </Badge>
                      )}
                      {bill.status === "paid" && bill.paidAt && (
                        <span className="text-xs text-muted-foreground">
                          Paid {new Date(bill.paidAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AiNav() {
  const pathname = usePathname();
  const tabs = [
    { label: "Agents", href: "/dashboard/agents" },
    { label: "AI Insights", href: "/dashboard/ai-insights" },
    { label: "AI Chat", href: "/dashboard/ai-chat" },
  ];
  return (
    <div className="flex gap-1 border-b px-4 lg:px-6">
      {tabs.map((tab) => (
        <a
          key={tab.href}
          href={tab.href}
          className={`px-3 py-2 text-sm font-medium transition-colors ${
            pathname === tab.href
              ? "border-b-2 border-primary text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {tab.label}
        </a>
      ))}
    </div>
  );
}

export default function AIInsightsPage() {
  return (
    <>
      <PageHeader
        title="AI & Agents"
        description="Agent billing, AI insights, and AI-powered business chat"
      />
      <AiNav />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <CompanyGuard>
            <AIInsightsContent />
          </CompanyGuard>
        </div>
      </div>
    </>
  );
}
