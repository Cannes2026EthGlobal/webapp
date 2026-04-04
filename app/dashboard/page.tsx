"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCompany } from "@/hooks/use-company";
import { useBusinessProfile } from "@/hooks/use-business-profile";
import { usePayrollBalance } from "@/hooks/use-payroll-contract";
import { formatCents, formatUsdc } from "@/lib/format";

import { PageHeader } from "@/components/page-header";
import { CompanyGuard } from "@/components/company-guard";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { HugeiconsIcon } from "@hugeicons/react";
import { ChartUpIcon, ChartDownIcon } from "@hugeicons/core-free-icons";
import { Skeleton } from "@/components/ui/skeleton";

function OverviewContent() {
  const { companyId, company } = useCompany();
  const { payrollContractAddress } = useBusinessProfile();
  const { balanceUsdc, isLoading: onChainLoading } = usePayrollBalance(payrollContractAddress);
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
      value: onChainLoading ? "..." : formatUsdc(balanceUsdc),
      trend: balanceUsdc && balanceUsdc > 0 ? "Funded" : "Empty",
      direction: "up" as const,
    },
    {
      title: "Payroll due",
      value: formatCents(stats.payrollDueCents),
      trend: `${stats.payrollDueCount} due`,
      direction: "down" as const,
    },
    {
      title: "Pending receivables",
      value: formatCents(stats.receivablesCents),
      trend: `${stats.receivablesCount} pending`,
      direction: "up" as const,
    },
    {
      title: "Usage revenue today",
      value: formatCents(stats.usageRevenueTodayCents),
      trend: stats.usageRevenueTodayCents > 0 ? "Active" : "No activity",
      direction: "up" as const,
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
            </Card>
          );
        })}
      </div>
      <RecentActivity />
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
