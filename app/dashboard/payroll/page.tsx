"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCompany } from "@/hooks/use-company";
import { formatCents, formatDate } from "@/lib/format";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { CompanyGuard } from "@/components/company-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

function PayrollContent() {
  const { companyId } = useCompany();
  const forecast = useQuery(
    api.payrollForecast.upcoming,
    companyId ? { companyId } : "skip"
  );
  const advanceSummary = useQuery(
    api.payrollForecast.advanceSummary,
    companyId ? { companyId } : "skip"
  );
  const settings = useQuery(
    api.advanceSettings.getForCompany,
    companyId ? { companyId } : "skip"
  );
  const pendingRequests = useQuery(
    api.advanceRequests.listByCompany,
    companyId ? { companyId, status: "pending" as const } : "skip"
  );
  const updateSettings = useMutation(api.advanceSettings.upsert);
  const approveRequest = useMutation(api.advanceRequests.approve);
  const denyRequest = useMutation(api.advanceRequests.deny);

  if (!companyId || !forecast || !settings) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const handleToggle = async (enabled: boolean) => {
    await updateSettings({ companyId, enabled });
    toast.success(enabled ? "Advances enabled" : "Advances disabled");
  };

  const handleApprove = async (id: string) => {
    try {
      await approveRequest({ id: id as any });
      toast.success("Advance approved — payment created");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDeny = async (id: string) => {
    await denyRequest({ id: id as any, denyReason: "Denied by operator" });
    toast.success("Advance denied");
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending Requests</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{advanceSummary?.pendingCount ?? 0}</p>
            <p className="text-xs text-muted-foreground">
              {formatCents(advanceSummary?.pendingTotalCents ?? 0)} total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Outstanding Advances</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{advanceSummary?.outstandingCount ?? 0}</p>
            <p className="text-xs text-muted-foreground">
              {formatCents(advanceSummary?.outstandingTotalCents ?? 0)} to deduct
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Interest Earned</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatCents(advanceSummary?.totalInterestEarnedCents ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground">from advances</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Advance Status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Switch
                checked={settings.enabled && !settings.autoDisabled}
                onCheckedChange={handleToggle}
                disabled={!!settings.autoDisabled}
              />
              <span className="text-sm">
                {settings.autoDisabled
                  ? "Auto-disabled (low treasury)"
                  : settings.enabled
                    ? "Enabled"
                    : "Disabled"}
              </span>
            </div>
            {settings.autoDisabled && (
              <p className="mt-1 text-xs text-destructive">
                Treasury below {settings.autoDisableThresholdMonths}-month payroll threshold
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Advance Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">Interest Rate (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={(settings.interestRateBps / 100).toFixed(1)}
                onChange={(e) =>
                  updateSettings({
                    companyId,
                    interestRateBps: Math.round(parseFloat(e.target.value) * 100),
                  })
                }
              />
            </div>
            <div>
              <Label className="text-xs">Max Advance (% of paycheck)</Label>
              <Input
                type="number"
                min="10"
                max="100"
                value={settings.maxAdvancePercent}
                onChange={(e) =>
                  updateSettings({
                    companyId,
                    maxAdvancePercent: parseInt(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <Label className="text-xs">Auto-disable threshold (months)</Label>
              <Input
                type="number"
                min="1"
                max="12"
                value={settings.autoDisableThresholdMonths}
                onChange={(e) =>
                  updateSettings({
                    companyId,
                    autoDisableThresholdMonths: parseInt(e.target.value),
                  })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pending advance requests */}
      {pendingRequests && pendingRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Pending Advance Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Interest</TableHead>
                  <TableHead>Net Payout</TableHead>
                  <TableHead>Against Paycheck</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRequests.map((req) => (
                  <PendingRequestRow
                    key={req._id}
                    request={req}
                    onApprove={() => handleApprove(req._id)}
                    onDeny={() => handleDeny(req._id)}
                  />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* 3-month forecast */}
      {forecast.map((month) => (
        <Card key={month.month}>
          <CardHeader>
            <CardTitle className="text-sm">{month.month}</CardTitle>
            <CardDescription>
              {month.employeeCount} employees · {formatCents(month.totalSalaryCents)} total
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Gross</TableHead>
                  <TableHead>Advance Deduction</TableHead>
                  <TableHead>Net Payout</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {month.entries.map((entry) => (
                  <TableRow key={entry.employeeId}>
                    <TableCell className="font-medium">{entry.displayName}</TableCell>
                    <TableCell className="text-muted-foreground">{entry.role}</TableCell>
                    <TableCell>{formatCents(entry.payoutAmountCents)}</TableCell>
                    <TableCell>
                      {entry.hasActiveAdvance ? (
                        <span className="text-destructive">
                          -{formatCents(entry.advanceDeductionCents)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCents(entry.netPayoutCents)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PendingRequestRow({
  request,
  onApprove,
  onDeny,
}: {
  request: any;
  onApprove: () => void;
  onDeny: () => void;
}) {
  const employee = useQuery(api.employees.getById, {
    id: request.employeeId,
  });

  return (
    <TableRow>
      <TableCell className="font-medium">
        {employee?.displayName ?? "..."}
      </TableCell>
      <TableCell>{formatCents(request.requestedAmountCents)}</TableCell>
      <TableCell className="text-destructive">
        -{formatCents(request.interestAmountCents)}
      </TableCell>
      <TableCell>{formatCents(request.netAmountCents)}</TableCell>
      <TableCell className="text-muted-foreground">
        {formatCents(request.nextPaycheckAmountCents)} on{" "}
        {formatDate(request.nextPaycheckDate)}
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button size="sm" onClick={onApprove}>
            Approve
          </Button>
          <Button size="sm" variant="outline" onClick={onDeny}>
            Deny
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// Exported for use in the employees page tab
export { PayrollContent };

export default function PayrollPage() {
  return (
    <CompanyGuard>
      <PageHeader title="Payroll Forecast" description="Upcoming salaries, advance requests, and deduction schedule" />
      <PayrollContent />
    </CompanyGuard>
  );
}
