"use client";

import { useQuery } from "convex/react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { api } from "@/convex/_generated/api";
import { useCompany } from "@/hooks/use-company";
import { formatCents } from "@/lib/format";

import { PageHeader } from "@/components/page-header";
import { CompanyGuard } from "@/components/company-guard";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { HugeiconsIcon } from "@hugeicons/react";
import { ChartUpIcon, ChartDownIcon } from "@hugeicons/core-free-icons";
import { Skeleton } from "@/components/ui/skeleton";

function OverviewContent() {
  const { companyId, company } = useCompany();
  const stats = useQuery(
    api.overview.stats,
    companyId ? { companyId } : "skip"
  );

  if (!stats) {
    return (
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      </div>
    );
  }

  const cards = [
    {
      title: "Treasury available",
      value: formatCents(stats.treasuryAvailableCents),
      trend: stats.treasuryAvailableCents > 0 ? "Funded" : "Empty",
      direction: "up" as const,
      summary: "Operating balances across all settlement assets.",
      note: company?.name ?? "Workspace",
    },
    {
      title: "Payroll due",
      value: formatCents(stats.payrollDueCents),
      trend: `${stats.payrollDueCount} due`,
      direction: "down" as const,
      summary: "Draft and approved employee payments pending settlement.",
      note: `${stats.activeEmployees} active employees`,
    },
    {
      title: "Pending receivables",
      value: formatCents(stats.receivablesCents),
      trend: `${stats.receivablesCount} pending`,
      direction: "up" as const,
      summary: "Invoices and payments awaiting settlement from customers.",
      note: "Includes sent and pending statuses",
    },
    {
      title: "Usage revenue today",
      value: formatCents(stats.usageRevenueTodayCents),
      trend: stats.usageRevenueTodayCents > 0 ? "Active" : "No activity",
      direction: "up" as const,
      summary: "Customer payments settled today.",
      note: "Real-time from Convex",
    },
  ];

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
        {cards.map((card) => {
          const icon =
            card.direction === "up" ? ChartUpIcon : ChartDownIcon;
          return (
            <Card key={card.title} className="@container/card">
              <CardHeader>
                <CardDescription>{card.title}</CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                  {card.value}
                </CardTitle>
                <CardAction>
                  <Badge variant="outline">
                    <HugeiconsIcon icon={icon} strokeWidth={2} />
                    {card.trend}
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardFooter className="flex-col items-start gap-1.5 text-sm">
                <div className="line-clamp-2 flex gap-2 font-medium">
                  {card.summary}
                </div>
                <div className="text-muted-foreground">{card.note}</div>
              </CardFooter>
            </Card>
          );
        })}
      </div>
      <SettlementChart />
      <RecentActivity />
    </div>
  );
}

const chartConfig = {
  inbound: {
    label: "Inbound",
    color: "var(--chart-1)",
  },
  outbound: {
    label: "Outbound",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

function SettlementChart() {
  const { companyId } = useCompany();
  const chartData = useQuery(
    api.overview.settlementChart,
    companyId ? { companyId } : "skip"
  );

  if (!chartData || chartData.length === 0) {
    return null;
  }

  // Convert cents to dollars for display
  const data = chartData.map((d) => ({
    date: d.date,
    inbound: d.inbound / 100,
    outbound: d.outbound / 100,
  }));

  return (
    <div className="px-4 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Settlement Flows</CardTitle>
          <CardDescription>
            Inbound collections vs outbound settlements
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="fillInbound" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="fillOutbound" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value: string) => {
                  const d = new Date(value);
                  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                }}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent />}
              />
              <Area
                dataKey="inbound"
                type="natural"
                fill="url(#fillInbound)"
                stroke="var(--chart-1)"
                stackId="a"
              />
              <Area
                dataKey="outbound"
                type="natural"
                fill="url(#fillOutbound)"
                stroke="var(--chart-2)"
                stackId="b"
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function RecentActivity() {
  const { companyId } = useCompany();
  const employeePayments = useQuery(
    api.employeePayments.listByCompany,
    companyId ? { companyId } : "skip"
  );
  const customerPayments = useQuery(
    api.customerPayments.listByCompany,
    companyId ? { companyId } : "skip"
  );

  if (!employeePayments || !customerPayments) {
    return (
      <div className="px-4 lg:px-6">
        <Skeleton className="h-64" />
      </div>
    );
  }

  const allPayments = [
    ...employeePayments.map((p) => ({
      id: p._id,
      type: "outbound" as const,
      description: p.description ?? `${p.type} payment`,
      amount: p.amountCents,
      status: p.status,
      time: p._creationTime,
    })),
    ...customerPayments.map((p) => ({
      id: p._id,
      type: "inbound" as const,
      description: p.description ?? `${p.mode} payment`,
      amount: p.amountCents,
      status: p.status,
      time: p._creationTime,
    })),
  ]
    .sort((a, b) => b.time - a.time)
    .slice(0, 12);

  return (
    <div className="px-4 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>
            Latest payment activity across inbound and outbound flows
          </CardDescription>
        </CardHeader>
        <div className="px-6 pb-6">
          <div className="divide-y">
            {allPayments.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No payment activity yet
              </p>
            )}
            {allPayments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between py-3"
              >
                <div className="flex items-center gap-3">
                  <Badge
                    variant={
                      payment.type === "inbound" ? "default" : "secondary"
                    }
                    className="w-20 justify-center text-xs"
                  >
                    {payment.type === "inbound" ? "Inbound" : "Outbound"}
                  </Badge>
                  <span className="text-sm">{payment.description}</span>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={payment.status} />
                  <span className="text-sm font-medium tabular-nums">
                    {payment.type === "inbound" ? "+" : "-"}
                    {formatCents(payment.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "settled" || status === "paid"
      ? "default"
      : status === "failed" || status === "overdue" || status === "cancelled"
        ? "destructive"
        : "outline";
  return (
    <Badge variant={variant} className="text-xs capitalize">
      {status}
    </Badge>
  );
}

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Overview"
        description="Operator workspace for Arc Counting"
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <CompanyGuard>
            <OverviewContent />
          </CompanyGuard>
        </div>
      </div>
    </>
  );
}
