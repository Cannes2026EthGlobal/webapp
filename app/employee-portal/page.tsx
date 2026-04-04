"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useAppKitAccount } from "@reown/appkit/react";
import { api } from "@/convex/_generated/api";
import { formatCents, formatDate } from "@/lib/format";
import { toast } from "sonner";

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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function statusColor(status: string) {
  switch (status) {
    case "pending":
      return "secondary";
    case "approved":
    case "settled":
      return "default";
    case "denied":
    case "cancelled":
      return "destructive";
    case "deducted":
      return "outline";
    default:
      return "secondary";
  }
}

export default function EmployeePortalPage() {
  const { address } = useAppKitAccount();

  if (!address) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Employee Portal</CardTitle>
            <CardDescription>
              Connect your wallet to view your salary information and request credits.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return <EmployeePortalContent walletAddress={address} />;
}

function EmployeePortalContent({ walletAddress }: { walletAddress: string }) {
  const employees = useQuery(api.employees.listByWalletAddress, { walletAddress });

  if (!employees) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4">
        <h1 className="text-lg font-semibold">Employee Portal</h1>
        <p className="text-sm text-muted-foreground font-mono">{walletAddress}</p>
      </header>
      <div className="p-6 space-y-8">
        {employees.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No employee records found for this wallet address.
          </p>
        )}
        {employees.map((employee) => (
          <div key={employee._id} className="space-y-4">
            <h2 className="text-base font-semibold">{employee.companyName}</h2>
            <EmployeeSalaryCard employee={employee} companyId={employee.companyId} />
          </div>
        ))}
      </div>
    </div>
  );
}

function EmployeeSalaryCard({
  employee,
  companyId,
}: {
  employee: any;
  companyId: any;
}) {
  const settings = useQuery(api.advanceSettings.getForCompany, { companyId });
  const activeCredits = useQuery(api.advanceRequests.getActiveForEmployee, {
    employeeId: employee._id,
  });
  const creditHistory = useQuery(api.advanceRequests.listByEmployee, {
    employeeId: employee._id,
  });
  const requestCredit = useMutation(api.advanceRequests.request);
  const cancelCredit = useMutation(api.advanceRequests.cancel);

  const [amount, setAmount] = useState("");

  const creditsEnabled = settings && settings.enabled && !settings.autoDisabled;
  const maxPercent = settings?.maxCreditPercent ?? 80;
  const interestBps = settings?.interestRateBps ?? 200;
  const maxAmountCents = Math.floor(
    (employee.payoutAmountCents * maxPercent) / 100
  );
  const hasActiveCredit = (activeCredits?.length ?? 0) > 0;

  const handleRequest = async () => {
    const cents = Math.round(parseFloat(amount) * 100);
    if (isNaN(cents) || cents <= 0) return;

    try {
      await requestCredit({
        companyId,
        employeeId: employee._id,
        requestedAmountCents: cents,
        currency: "USD",
      });
      toast.success("Credit request submitted");
      setAmount("");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const interestPreview = amount
    ? Math.ceil((parseFloat(amount) * 100 * interestBps) / 10000)
    : 0;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Salary info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{employee.displayName}</CardTitle>
          <CardDescription>{employee.role}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Salary</span>
            <span className="font-medium">
              {formatCents(employee.payoutAmountCents)} / {employee.payoutFrequency}
            </span>
          </div>
          {employee.nextPaymentDate && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Next paycheck</span>
              <span>{formatDate(employee.nextPaymentDate)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Credit eligible</span>
            <span>
              {creditsEnabled ? `Up to ${formatCents(maxAmountCents)}` : "Disabled"}
            </span>
          </div>
          {settings?.autoDisabled && (
            <p className="text-xs text-destructive">
              Credits temporarily disabled — company treasury is low.
            </p>
          )}
        </CardContent>
      </Card>

      {/\* Request credit \*/}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Request Credit</CardTitle>
          <CardDescription>
            {interestBps / 100}% interest deducted upfront. Repaid from next paycheck.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {hasActiveCredit ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                You have an active credit:
              </p>
              {activeCredits?.map((adv: any) => (
                <div
                  key={adv._id}
                  className="flex items-center justify-between rounded border p-2 text-sm"
                >
                  <div>
                    <span className="font-medium">
                      {formatCents(adv.requestedAmountCents)}
                    </span>
                    <span className="text-muted-foreground ml-2">
                      (net {formatCents(adv.netAmountCents)})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusColor(adv.status) as any}>
                      {adv.status}
                    </Badge>
                    {adv.status === "pending" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => cancelCredit({ id: adv._id })}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : creditsEnabled ? (
            <div className="space-y-2">
              <div>
                <Label className="text-xs">Amount (USD)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={(maxAmountCents / 100).toFixed(2)}
                  placeholder={`Max ${(maxAmountCents / 100).toFixed(2)}`}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              {amount && parseFloat(amount) > 0 && (
                <div className="rounded bg-muted p-2 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span>Requested</span>
                    <span>${parseFloat(amount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-destructive">
                    <span>Interest ({interestBps / 100}%)</span>
                    <span>-${(interestPreview / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-medium border-t pt-1">
                    <span>You receive</span>
                    <span>
                      ${(parseFloat(amount) - interestPreview / 100).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
              <Button onClick={handleRequest} className="w-full" disabled={!amount}>
                Request Credit
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Credit requests are currently disabled.
            </p>
          )}
        </CardContent>
      </Card>

      {/* History */}
      {creditHistory && creditHistory.length > 0 && (
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Credit History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Amount</TableHead>
                  <TableHead>Interest</TableHead>
                  <TableHead>Net</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {creditHistory.map((adv: any) => (
                  <TableRow key={adv._id}>
                    <TableCell>{formatCents(adv.requestedAmountCents)}</TableCell>
                    <TableCell className="text-destructive">
                      -{formatCents(adv.interestAmountCents)}
                    </TableCell>
                    <TableCell>{formatCents(adv.netAmountCents)}</TableCell>
                    <TableCell>
                      <Badge variant={statusColor(adv.status) as any}>
                        {adv.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(adv._creationTime)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
