"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCompany } from "@/hooks/use-company";
import { formatCents, formatDate } from "@/lib/format";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

export function PayrollContent() {
  const { companyId } = useCompany();
  const employees = useQuery(
    api.employees.listByCompany,
    companyId ? { companyId } : "skip"
  );
  const payments = useQuery(
    api.employeePayments.listByCompany,
    companyId ? { companyId } : "skip"
  );
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

  const createPayment = useMutation(api.employeePayments.create);
  const updatePaymentStatus = useMutation(api.employeePayments.updateStatus);
  const removePayment = useMutation(api.employeePayments.remove);
  const updateSettings = useMutation(api.advanceSettings.upsert);
  const approveRequest = useMutation(api.advanceRequests.approve);
  const denyRequest = useMutation(api.advanceRequests.deny);

  const [showCreatePayment, setShowCreatePayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    employeeId: "",
    type: "salary" as const,
    amountCents: 0,
    description: "",
  });

  if (!companyId || !employees || !payments || !forecast || !settings) {
    return (
      <div className="p-4 lg:p-6">
        <Skeleton className="h-96" />
      </div>
    );
  }

  const employeeMap = new Map(employees.map((e) => [e._id, e]));

  const statusGroups = {
    all: payments,
    draft: payments.filter((p) => p.status === "draft"),
    approved: payments.filter((p) => p.status === "approved"),
    queued: payments.filter((p) => p.status === "queued"),
    settled: payments.filter((p) => p.status === "settled"),
    failed: payments.filter((p) => p.status === "failed"),
  };

  const handleCreatePayment = async () => {
    if (!companyId || !paymentForm.employeeId || !paymentForm.amountCents) return;
    await createPayment({
      companyId,
      employeeId: paymentForm.employeeId as Id<"employees">,
      type: paymentForm.type,
      amountCents: paymentForm.amountCents,
      currency: "USD",
      description: paymentForm.description || undefined,
    });
    setShowCreatePayment(false);
    setPaymentForm({
      employeeId: "",
      type: "salary",
      amountCents: 0,
      description: "",
    });
  };

  const handleToggle = async (enabled: boolean) => {
    await updateSettings({ companyId, enabled });
    toast.success(enabled ? "Credits enabled" : "Credits disabled");
  };

  const handleApprove = async (id: string) => {
    try {
      await approveRequest({ id: id as any });
      toast.success("Credit approved — payment created");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDeny = async (id: string) => {
    await denyRequest({ id: id as any, denyReason: "Denied by operator" });
    toast.success("Credit denied");
  };

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      {/* ─── Payment Summary ─── */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Draft</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatCents(
                statusGroups.draft.reduce((s, p) => s + p.amountCents, 0)
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {statusGroups.draft.length} payment
              {statusGroups.draft.length !== 1 ? "s" : ""} awaiting approval
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Approved / Queued</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatCents(
                [...statusGroups.approved, ...statusGroups.queued].reduce(
                  (s, p) => s + p.amountCents,
                  0
                )
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {statusGroups.approved.length + statusGroups.queued.length}{" "}
              payment
              {statusGroups.approved.length + statusGroups.queued.length !== 1
                ? "s"
                : ""}{" "}
              pending settlement
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Settled</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatCents(
                statusGroups.settled.reduce((s, p) => s + p.amountCents, 0)
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {statusGroups.settled.length} payment
              {statusGroups.settled.length !== 1 ? "s" : ""} completed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Payment Runs ─── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Payment runs</CardTitle>
              <CardDescription>
                Outbound settlement desk for payroll, freelance, bonuses, and
                credits
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowCreatePayment(true)}>
              New payment
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">All ({statusGroups.all.length})</TabsTrigger>
              <TabsTrigger value="draft">
                Draft ({statusGroups.draft.length})
              </TabsTrigger>
              <TabsTrigger value="approved">
                Approved ({statusGroups.approved.length})
              </TabsTrigger>
              <TabsTrigger value="settled">
                Settled ({statusGroups.settled.length})
              </TabsTrigger>
            </TabsList>

            {(["all", "draft", "approved", "settled"] as const).map((tab) => (
              <TabsContent key={tab} value={tab}>
                <PaymentsTable
                  payments={statusGroups[tab]}
                  employeeMap={employeeMap}
                  onTransition={async (id, status) => {
                    try {
                      await updatePaymentStatus({
                        id,
                        status,
                        ...(status === "settled" ? { settledAt: Date.now() } : {}),
                      });
                      toast.success(`Payment ${status}`);
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Failed to update status");
                    }
                  }}
                  onRemove={async (id) => {
                    try {
                      await removePayment({ id });
                      toast.success("Payment removed");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Failed to remove");
                    }
                  }}
                />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* ─── 3-month Forecast ─── */}
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
                  <TableHead>Credit Deduction</TableHead>
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
                      {entry.hasActiveCredit ? (
                        <span className="text-destructive">
                          -{formatCents(entry.creditDeductionCents)}
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

      {/* ─── Credits Section ─── */}
      <div className="pt-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-3">
          Salary Credits
        </h2>

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
              <CardDescription>Outstanding Credits</CardDescription>
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
              <p className="text-xs text-muted-foreground">from credits</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Credit Status</CardDescription>
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

        {/* Credit Settings */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-sm">Credit Settings</CardTitle>
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
                <Label className="text-xs">Max Credit (% of paycheck)</Label>
                <Input
                  type="number"
                  min="10"
                  max="100"
                  value={settings.maxCreditPercent}
                  onChange={(e) =>
                    updateSettings({
                      companyId,
                      maxCreditPercent: parseInt(e.target.value),
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

        {/* Pending credit requests */}
        {pendingRequests && pendingRequests.length > 0 && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-sm">Pending Credit Requests</CardTitle>
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
      </div>

      {/* ─── Create Payment Dialog ─── */}
      <Dialog open={showCreatePayment} onOpenChange={setShowCreatePayment}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create payment</DialogTitle>
            <DialogDescription>
              Add a new outbound payment for an employee.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Employee</Label>
              <Select
                value={paymentForm.employeeId}
                onValueChange={(v) =>
                  setPaymentForm({ ...paymentForm, employeeId: v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp._id} value={emp._id}>
                      {emp.displayName} - {emp.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Payment type</Label>
                <Select
                  value={paymentForm.type}
                  onValueChange={(v) =>
                    setPaymentForm({
                      ...paymentForm,
                      type: v as typeof paymentForm.type,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="salary">Salary</SelectItem>
                    <SelectItem value="freelance">Freelance</SelectItem>
                    <SelectItem value="bonus">Bonus</SelectItem>
                    <SelectItem value="reimbursement">Reimbursement</SelectItem>
                    <SelectItem value="credit">Credit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="paymentAmount">Amount (USD)</Label>
                <Input
                  id="paymentAmount"
                  type="number"
                  value={paymentForm.amountCents / 100 || ""}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      amountCents: Math.round(
                        parseFloat(e.target.value || "0") * 100
                      ),
                    })
                  }
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="paymentDescription">Description (optional)</Label>
              <Input
                id="paymentDescription"
                value={paymentForm.description}
                onChange={(e) =>
                  setPaymentForm({ ...paymentForm, description: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreatePayment(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreatePayment()}>Create payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PaymentsTable({
  payments,
  employeeMap,
  onTransition,
  onRemove,
}: {
  payments: Array<{
    _id: Id<"employeePayments">;
    _creationTime: number;
    employeeId: Id<"employees">;
    type: string;
    amountCents: number;
    status: string;
    description?: string;
    scheduledDate?: number;
    settledAt?: number;
    txHash?: string;
  }>;
  employeeMap: Map<string, { displayName: string }>;
  onTransition: (id: Id<"employeePayments">, status: "draft" | "approved" | "queued" | "settled" | "failed") => void;
  onRemove: (id: Id<"employeePayments">) => void;
}) {
  if (payments.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No payments in this category
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Tx</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((p) => (
            <TableRow key={p._id}>
              <TableCell className="font-medium">
                {employeeMap.get(p.employeeId)?.displayName ?? "Unknown"}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="capitalize">
                  {p.type}
                </Badge>
              </TableCell>
              <TableCell className="tabular-nums">
                {formatCents(p.amountCents)}
              </TableCell>
              <TableCell>
                <PaymentStatusBadge status={p.status} />
              </TableCell>
              <TableCell className="max-w-48 truncate text-muted-foreground">
                {p.description ?? "-"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {p.settledAt
                  ? formatDate(p.settledAt)
                  : p.scheduledDate
                    ? formatDate(p.scheduledDate)
                    : formatDate(p._creationTime)}
              </TableCell>
              <TableCell>
                {p.txHash ? (
                  <a
                    href={`https://testnet.arcscan.app/tx/${p.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-muted-foreground hover:text-foreground hover:underline"
                  >
                    {p.txHash.slice(0, 6)}…{p.txHash.slice(-4)}
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {p.status === "draft" && (
                    <Button variant="outline" size="sm" onClick={() => onTransition(p._id, "approved")}>
                      Approve
                    </Button>
                  )}
                  {p.status === "approved" && (
                    <Button variant="outline" size="sm" onClick={() => onTransition(p._id, "queued")}>
                      Queue
                    </Button>
                  )}
                  {p.status === "queued" && (
                    <Button variant="default" size="sm" onClick={() => onTransition(p._id, "settled")}>
                      Settle
                    </Button>
                  )}
                  {p.status === "failed" && (
                    <Button variant="outline" size="sm" onClick={() => onTransition(p._id, "draft")}>
                      Retry
                    </Button>
                  )}
                  {(p.status === "draft" || p.status === "failed") && (
                    <Button variant="ghost" size="sm" onClick={() => onRemove(p._id)}>
                      Remove
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
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

function PaymentStatusBadge({ status }: { status: string }) {
  const variant =
    status === "settled"
      ? "default"
      : status === "failed"
        ? "destructive"
        : status === "approved" || status === "queued"
          ? "secondary"
          : "outline";
  return (
    <Badge variant={variant} className="capitalize">
      {status}
    </Badge>
  );
}

export default function PayrollPage() {
  return (
    <CompanyGuard>
      <PageHeader title="Payroll" description="Payment runs, salary forecast, and credit management" />
      <PayrollContent />
    </CompanyGuard>
  );
}
