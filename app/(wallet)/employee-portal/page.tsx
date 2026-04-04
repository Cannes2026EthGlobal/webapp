"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { useAppKitAccount } from "@reown/appkit/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatCents, formatDate, formatRelativeDate } from "@/lib/format";
import { toast } from "sonner";

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft02Icon,
  Money01Icon,
  Calendar03Icon,
  CreditCardIcon,
} from "@hugeicons/core-free-icons";

/* ─── Status badge helper ─── */

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "settled" || status === "paid" || status === "deducted"
      ? "default"
      : status === "failed" || status === "denied" || status === "cancelled"
        ? "destructive"
        : "outline";
  return (
    <Badge variant={variant} className="text-xs capitalize">
      {status}
    </Badge>
  );
}

/* ─── Entry point ─── */

export default function EmployeePortalPage() {
  const { address } = useAppKitAccount();

  if (!address) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Employee Portal</CardTitle>
            <CardDescription>
              Connect your wallet to view your salary information and request
              credits.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return <EmployeePortalContent walletAddress={address} />;
}

/* ─── Main content (wallet connected) ─── */

function EmployeePortalContent({ walletAddress }: { walletAddress: string }) {
  const employees = useQuery(api.employees.listByWalletAddress, {
    walletAddress,
  });

  if (!employees) {
    return (
      <div className="min-h-screen bg-background">
        <PortalHeader walletAddress={walletAddress} />
        <div className="p-4 lg:p-6 space-y-4">
          <Skeleton className="h-36" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PortalHeader walletAddress={walletAddress} />
      <div className="p-4 lg:p-6">
        {employees.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <p className="text-muted-foreground">
              No employee records found for this wallet address.
            </p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/">Back to home</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-10">
            {employees.map((employee) => (
              <CompanySection key={employee._id} employee={employee} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Header ─── */

function PortalHeader({ walletAddress }: { walletAddress: string }) {
  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center gap-4 px-4 lg:px-6">
        <Button asChild variant="ghost" size="sm">
          <Link href="/">
            <HugeiconsIcon icon={ArrowLeft02Icon} size={16} strokeWidth={2} />
            Home
          </Link>
        </Button>
        <Separator
          orientation="vertical"
          className="data-[orientation=vertical]:h-4"
        />
        <div className="flex flex-col">
          <h1 className="text-base font-medium">Employee Portal</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="outline">Arc Testnet</Badge>
          <code className="hidden text-xs text-muted-foreground sm:inline">
            {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
          </code>
        </div>
      </div>
    </header>
  );
}

/* ─── Per-company section ─── */

function CompanySection({ employee }: { employee: any }) {
  const companyId = employee.companyId;

  const compLines = useQuery(api.compensationLines.listActiveByEmployee, {
    employeeId: employee._id,
  });
  const allSplits = useQuery(api.compensationSplits.listByEmployee, {
    employeeId: employee._id,
  });
  const payments = useQuery(api.employeePayments.listByEmployee, {
    employeeId: employee._id,
  });
  const settings = useQuery(api.advanceSettings.getForCompany, { companyId });
  const activeCredits = useQuery(api.advanceRequests.getActiveForEmployee, {
    employeeId: employee._id,
  });
  const creditHistory = useQuery(api.advanceRequests.listByEmployee, {
    employeeId: employee._id,
  });

  // totalCompensationCents comes from the enriched listByWalletAddress query
  const totalCompCents = employee.totalCompensationCents ?? 0;
  const settledPayments =
    payments?.filter((p: any) => p.status === "settled") ?? [];
  const totalPaidCents = settledPayments.reduce(
    (s: number, p: any) => s + p.amountCents,
    0
  );
  const pendingPayments =
    payments?.filter(
      (p: any) =>
        p.status === "draft" || p.status === "approved" || p.status === "queued"
    ) ?? [];
  const pendingTotalCents = pendingPayments.reduce(
    (s: number, p: any) => s + p.amountCents,
    0
  );

  const creditsEnabled = settings && settings.enabled && !settings.autoDisabled;
  const maxPercent = settings?.maxCreditPercent ?? 80;
  const maxCreditCents = Math.floor((totalCompCents * maxPercent) / 100);

  return (
    <div className="space-y-4">
      {/* Company name heading */}
      <div>
        <h2 className="text-lg font-semibold">{employee.companyName}</h2>
        <p className="text-sm text-muted-foreground">
          {employee.role} · {employee.employmentType}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 @container/section sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Total compensation</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {formatCents(totalCompCents)}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                {compLines?.length ?? 0} line{(compLines?.length ?? 0) !== 1 ? "s" : ""}
              </Badge>
            </CardAction>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Total received</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {formatCents(totalPaidCents)}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                {settledPayments.length} settled
              </Badge>
            </CardAction>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Pending payments</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {formatCents(pendingTotalCents)}
            </CardTitle>
            <CardAction>
              <Badge variant={pendingPayments.length > 0 ? "secondary" : "outline"}>
                {pendingPayments.length} pending
              </Badge>
            </CardAction>
          </CardHeader>
        </Card>
      </div>

      {/* Two-column grid: compensation + credit request */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Compensation breakdown with splits */}
        <CompensationWithSplitsCard
          compLines={compLines}
          allSplits={allSplits}
          totalCompCents={totalCompCents}
          employeeWallet={employee.walletAddress}
        />

        {/* Salary credit request */}
        <CreditRequestCard
          employee={employee}
          companyId={companyId}
          settings={settings}
          creditsEnabled={!!creditsEnabled}
          maxCreditCents={maxCreditCents}
          activeCredits={activeCredits}
        />
      </div>

      {/* Payment history + Credit history tabs */}
      <Card>
        <Tabs defaultValue="payments">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>History</CardTitle>
                <CardDescription>
                  Payment records and credit requests
                </CardDescription>
              </div>
              <TabsList>
                <TabsTrigger value="payments">
                  Payments ({payments?.length ?? 0})
                </TabsTrigger>
                <TabsTrigger value="credits">
                  Credits ({creditHistory?.length ?? 0})
                </TabsTrigger>
              </TabsList>
            </div>
          </CardHeader>
          <CardContent>
            <TabsContent value="payments" className="mt-0">
              <PaymentHistoryTable payments={payments} />
            </TabsContent>
            <TabsContent value="credits" className="mt-0">
              <CreditHistoryTable credits={creditHistory} />
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}

/* ─── Credit request card ─── */

function CreditRequestCard({
  employee,
  companyId,
  settings,
  creditsEnabled,
  maxCreditCents,
  activeCredits,
}: {
  employee: any;
  companyId: Id<"companies">;
  settings: any;
  creditsEnabled: boolean;
  maxCreditCents: number;
  activeCredits: any[] | undefined;
}) {
  const requestCredit = useMutation(api.advanceRequests.request);
  const cancelCredit = useMutation(api.advanceRequests.cancel);
  const [amount, setAmount] = useState("");

  const interestBps = settings?.interestRateBps ?? 200;
  const maxPercent = settings?.maxCreditPercent ?? 80;

  // ─── Eligibility checks (mirrors backend validation) ───
  const isInactive = employee.status !== "active";
  const isPerEmployeeDisabled = employee.notes?.startsWith("[no-credit]");
  const isCompanyDisabled = !creditsEnabled;
  const isTreasuryLow = !!settings?.autoDisabled;
  const hasPendingCredit = activeCredits?.some(
    (a: any) => a.status === "pending"
  );
  const hasOutstandingCredit = activeCredits?.some(
    (a: any) => a.status === "approved" || a.status === "settled"
  );
  const hasActiveCredit = (activeCredits?.length ?? 0) > 0;
  const noPayoutConfigured = (employee.totalCompensationCents ?? 0) === 0;

  // Overall: can the employee request right now?
  const canRequest =
    !isInactive &&
    !isPerEmployeeDisabled &&
    !isCompanyDisabled &&
    !isTreasuryLow &&
    !hasPendingCredit &&
    !hasOutstandingCredit &&
    !noPayoutConfigured;

  // Compute days until next paycheck (same logic as backend)
  const now = Date.now();
  let nextPaycheckMs: number;
  if (employee.nextPaymentDate && employee.nextPaymentDate > now) {
    nextPaycheckMs = employee.nextPaymentDate;
  } else {
    const d = new Date();
    nextPaycheckMs = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
  }
  const daysUntilPaycheck = Math.max(
    1,
    Math.ceil((nextPaycheckMs - now) / 86_400_000)
  );

  // Amount validation
  const parsedCents = amount ? Math.round(parseFloat(amount) * 100) : 0;
  const exceedsMax = parsedCents > maxCreditCents;

  const handleRequest = async () => {
    if (isNaN(parsedCents) || parsedCents <= 0 || exceedsMax) return;
    try {
      await requestCredit({
        companyId,
        employeeId: employee._id,
        requestedAmountCents: parsedCents,
        currency: "USD",
      });
      toast.success("Credit request submitted");
      setAmount("");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // Prorate annual interest over actual days until paycheck
  const interestPreview = amount
    ? Math.ceil(
        (parseFloat(amount) * 100 * interestBps * daysUntilPaycheck) /
          (10000 * 365)
      )
    : 0;

  // Build warnings list
  const warnings: string[] = [];
  if (isInactive) warnings.push("Your employment status is inactive.");
  if (isPerEmployeeDisabled)
    warnings.push("Credit requests have been disabled for your account.");
  if (isCompanyDisabled && !isTreasuryLow)
    warnings.push("Credit requests are disabled company-wide.");
  if (isTreasuryLow)
    warnings.push("Credits temporarily suspended — company treasury is low.");
  if (noPayoutConfigured)
    warnings.push(
      "No payout amount configured — contact your employer to set up compensation."
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Salary Credit</CardTitle>
        <CardDescription>
          {canRequest
            ? `${interestBps / 100}% APR · ${daysUntilPaycheck}d until paycheck · Up to ${formatCents(maxCreditCents)} (${maxPercent}% of paycheck)`
            : "Credit requests are not available"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="mb-4 space-y-2">
            {warnings.map((w, i) => (
              <div
                key={i}
                className="rounded-lg border border-destructive/50 bg-destructive/5 p-3"
              >
                <p className="text-xs text-destructive">{w}</p>
              </div>
            ))}
          </div>
        )}

        {/* Active credits display */}
        {hasActiveCredit ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {hasPendingCredit
                ? "You have a pending credit request:"
                : "You have an outstanding credit:"}
            </p>
            {activeCredits?.map((adv: any) => (
              <div
                key={adv._id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div>
                  <p className="text-sm font-medium tabular-nums">
                    {formatCents(adv.requestedAmountCents)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Net: {formatCents(adv.netAmountCents)} · Interest:{" "}
                    {formatCents(adv.interestAmountCents)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={adv.status} />
                  {adv.status === "pending" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => cancelCredit({ id: adv._id })}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {hasOutstandingCredit && (
              <p className="text-xs text-muted-foreground">
                This credit will be deducted from your next paycheck. You can
                request a new credit after it has been deducted.
              </p>
            )}
          </div>
        ) : canRequest ? (
          <div className="space-y-3">
            {/* Limits info */}
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
              <p>
                Maximum credit: {formatCents(maxCreditCents)} ({maxPercent}% of
                your {formatCents(employee.totalCompensationCents ?? 0)} paycheck)
              </p>
              <p>
                Interest: {interestBps / 100}% annual rate, prorated over{" "}
                {daysUntilPaycheck} day{daysUntilPaycheck !== 1 ? "s" : ""}{" "}
                until your next paycheck
              </p>
            </div>

            <div className="grid gap-2">
              <Label className="text-xs">Amount (USD)</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max={(maxCreditCents / 100).toFixed(2)}
                placeholder={`Max ${(maxCreditCents / 100).toFixed(2)}`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {exceedsMax && (
                <p className="text-xs text-destructive">
                  Exceeds maximum of {formatCents(maxCreditCents)} ({maxPercent}
                  % of your paycheck)
                </p>
              )}
            </div>
            {amount && parseFloat(amount) > 0 && !exceedsMax && (
              <div className="rounded-lg bg-muted p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Requested</span>
                  <span className="tabular-nums">
                    ${parseFloat(amount).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-destructive">
                  <span>
                    Interest ({interestBps / 100}% APR × {daysUntilPaycheck}d)
                  </span>
                  <span className="tabular-nums">
                    -${(interestPreview / 100).toFixed(2)}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between font-medium">
                  <span>You receive</span>
                  <span className="tabular-nums">
                    $
                    {(parseFloat(amount) - interestPreview / 100).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
            <Button
              onClick={handleRequest}
              className="w-full"
              disabled={!amount || exceedsMax || parsedCents <= 0}
            >
              Request Credit
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/* ─── Payment history table ─── */

function PaymentHistoryTable({ payments }: { payments: any[] | undefined }) {
  if (!payments || payments.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No payment history
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Tx</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((p: any) => (
            <TableRow key={p._id}>
              <TableCell>
                <Badge variant="secondary" className="text-xs capitalize">
                  {p.type}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">
                {p.description ?? "-"}
              </TableCell>
              <TableCell className="font-medium tabular-nums">
                {formatCents(p.amountCents)}
              </TableCell>
              <TableCell>
                <StatusBadge status={p.status} />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {p.settledAt
                  ? formatDate(p.settledAt)
                  : formatDate(p._creationTime)}
              </TableCell>
              <TableCell>
                {p.txHash ? (
                  p.txExplorerUrl ? (
                    <a
                      href={p.txExplorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-mono text-primary hover:underline"
                    >
                      {p.txHash.slice(0, 8)}...
                    </a>
                  ) : (
                    <span className="text-xs font-mono text-muted-foreground">
                      {p.txHash.slice(0, 8)}...
                    </span>
                  )
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/* ─── Credit history table ─── */

function CreditHistoryTable({ credits }: { credits: any[] | undefined }) {
  if (!credits || credits.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No credit history
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Requested</TableHead>
            <TableHead>Interest</TableHead>
            <TableHead>Net</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {credits.map((adv: any) => (
            <TableRow key={adv._id}>
              <TableCell className="font-medium tabular-nums">
                {formatCents(adv.requestedAmountCents)}
              </TableCell>
              <TableCell className="text-destructive tabular-nums">
                -{formatCents(adv.interestAmountCents)}
              </TableCell>
              <TableCell className="tabular-nums">
                {formatCents(adv.netAmountCents)}
              </TableCell>
              <TableCell>
                <StatusBadge status={adv.status} />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(adv._creationTime)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/* ─── Compensation card with splits ─── */

function CompensationWithSplitsCard({
  compLines,
  allSplits,
  totalCompCents,
  employeeWallet,
}: {
  compLines: any[] | undefined;
  allSplits: any[] | undefined;
  totalCompCents: number;
  employeeWallet?: string;
}) {
  const [editingLineId, setEditingLineId] = useState<
    Id<"compensationLines"> | null
  >(null);

  // Group splits by compensationLineId
  const splitsByLine = new Map<string, any[]>();
  if (allSplits) {
    for (const s of allSplits) {
      const arr = splitsByLine.get(s.compensationLineId) ?? [];
      arr.push(s);
      splitsByLine.set(s.compensationLineId, arr);
    }
  }

  const editingLine = compLines?.find((l: any) => l._id === editingLineId);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Compensation</CardTitle>
          <CardDescription>Active compensation lines and payout splits</CardDescription>
        </CardHeader>
        <CardContent>
          {!compLines ? (
            <Skeleton className="h-20" />
          ) : compLines.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No active compensation lines
            </p>
          ) : (
            <div className="space-y-3">
              {compLines.map((line: any) => {
                const lineSplits = splitsByLine.get(line._id);
                const hasSplits = lineSplits && lineSplits.length > 0;
                return (
                  <div key={line._id} className="rounded-lg border">
                    <div className="flex items-center justify-between p-3">
                      <div>
                        <p className="text-sm font-medium">{line.name}</p>
                        {line.description && (
                          <p className="text-xs text-muted-foreground">
                            {line.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="text-sm font-medium tabular-nums">
                            {formatCents(line.amountCents)}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {line.frequency} · {line.asset}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingLineId(line._id)}
                        >
                          {hasSplits ? "Edit split" : "Split"}
                        </Button>
                      </div>
                    </div>
                    {hasSplits && (
                      <div className="border-t bg-muted/30 px-3 py-2 space-y-1">
                        {lineSplits.map((s: any) => (
                          <div
                            key={s._id}
                            className="flex items-center justify-between text-xs"
                          >
                            <span className="text-muted-foreground">
                              {s.label || "Wallet"}{" "}
                              <code className="font-mono">
                                {s.walletAddress.slice(0, 6)}...
                                {s.walletAddress.slice(-4)}
                              </code>
                            </span>
                            <span className="tabular-nums font-medium">
                              {formatCents(s.amountCents)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              <Separator />
              <div className="flex items-center justify-between px-3">
                <p className="text-sm font-medium">Total</p>
                <p className="text-sm font-semibold tabular-nums">
                  {formatCents(totalCompCents)}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {editingLine && (
        <SplitEditorDialog
          line={editingLine}
          existingSplits={splitsByLine.get(editingLineId!) ?? []}
          employeeWallet={employeeWallet}
          open={!!editingLineId}
          onOpenChange={(open) => {
            if (!open) setEditingLineId(null);
          }}
        />
      )}
    </>
  );
}

/* ─── Split editor dialog ─── */

function SplitEditorDialog({
  line,
  existingSplits,
  employeeWallet,
  open,
  onOpenChange,
}: {
  line: any;
  existingSplits: any[];
  employeeWallet?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const setSplits = useMutation(api.compensationSplits.setSplits);

  const [rows, setRows] = useState<
    Array<{ walletAddress: string; amountCents: number; label: string }>
  >(() => {
    if (existingSplits.length > 0) {
      return existingSplits.map((s: any) => ({
        walletAddress: s.walletAddress,
        amountCents: s.amountCents,
        label: s.label ?? "",
      }));
    }
    // Default: one row with full amount to primary wallet
    return [
      {
        walletAddress: employeeWallet ?? "",
        amountCents: line.amountCents,
        label: "Main",
      },
    ];
  });

  const sum = rows.reduce((s, r) => s + r.amountCents, 0);
  const isValid =
    sum === line.amountCents &&
    rows.length > 0 &&
    rows.every((r) => r.amountCents > 0 && r.walletAddress.trim());
  const remaining = line.amountCents - sum;

  const updateRow = (
    idx: number,
    field: string,
    value: string | number
  ) => {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r))
    );
  };

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      { walletAddress: "", amountCents: 0, label: "" },
    ]);
  };

  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!isValid) return;
    try {
      await setSplits({
        compensationLineId: line._id,
        splits: rows.map((r) => ({
          walletAddress: r.walletAddress,
          amountCents: r.amountCents,
          label: r.label || undefined,
        })),
      });
      toast.success("Payout split saved");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleReset = async () => {
    try {
      await setSplits({
        compensationLineId: line._id,
        splits: [],
      });
      toast.success("Split removed — full amount to primary wallet");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Split payout</DialogTitle>
          <DialogDescription>
            {line.name} — {formatCents(line.amountCents)} / {line.frequency}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {rows.map((row, idx) => (
            <div key={idx} className="grid gap-2 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Split {idx + 1}</Label>
                {rows.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-destructive"
                    onClick={() => removeRow(idx)}
                  >
                    Remove
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Label</Label>
                  <Input
                    placeholder="Main"
                    value={row.label}
                    onChange={(e) => updateRow(idx, "label", e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Amount (USD)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={row.amountCents ? (row.amountCents / 100).toFixed(2) : ""}
                    onChange={(e) =>
                      updateRow(
                        idx,
                        "amountCents",
                        Math.round(parseFloat(e.target.value || "0") * 100)
                      )
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Wallet address</Label>
                  <Input
                    placeholder="0x..."
                    className="font-mono text-xs"
                    value={row.walletAddress}
                    onChange={(e) =>
                      updateRow(idx, "walletAddress", e.target.value)
                    }
                  />
                </div>
              </div>
            </div>
          ))}

          <Button variant="outline" size="sm" onClick={addRow} className="w-full">
            Add address
          </Button>

          {/* Running total */}
          <div
            className={`rounded-lg p-3 text-sm ${
              remaining === 0
                ? "bg-muted"
                : "bg-destructive/5 border border-destructive/50"
            }`}
          >
            <div className="flex justify-between">
              <span>Split total</span>
              <span className="tabular-nums font-medium">
                {formatCents(sum)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Line total</span>
              <span className="tabular-nums">{formatCents(line.amountCents)}</span>
            </div>
            {remaining !== 0 && (
              <div className="flex justify-between text-destructive mt-1">
                <span>Remaining</span>
                <span className="tabular-nums font-medium">
                  {formatCents(Math.abs(remaining))}
                  {remaining > 0 ? " under" : " over"}
                </span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          {existingSplits.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleReset}>
              Reset to single wallet
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!isValid}>
              Save split
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
