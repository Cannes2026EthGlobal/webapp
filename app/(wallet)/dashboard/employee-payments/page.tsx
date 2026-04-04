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
import { Checkbox } from "@/components/ui/checkbox";

type PaymentStatus = "draft" | "approved" | "queued" | "settled" | "failed";
type PaymentType = "salary" | "freelance" | "bonus" | "reimbursement" | "credit";

interface Payment {
  _id: Id<"employeePayments">;
  _creationTime: number;
  employeeId: Id<"employees">;
  type: PaymentType;
  amountCents: number;
  status: PaymentStatus;
  description?: string;
  scheduledDate?: number;
  settledAt?: number;
  txHash?: string;
  txExplorerUrl?: string;
  batchId?: string;
}

function EmployeePaymentsContent({
  showCreate,
  setShowCreate,
}: {
  showCreate: boolean;
  setShowCreate: (v: boolean) => void;
}) {
  const { companyId } = useCompany();
  const payments = useQuery(
    api.employeePayments.listByCompany,
    companyId ? { companyId } : "skip"
  );
  const employees = useQuery(
    api.employees.listByCompany,
    companyId ? { companyId } : "skip"
  );
  const createPayment = useMutation(api.employeePayments.create);
  const updateStatus = useMutation(api.employeePayments.updateStatus);
  const removePayment = useMutation(api.employeePayments.remove);

  const [selectedDrafts, setSelectedDrafts] = useState<Set<Id<"employeePayments">>>(
    new Set()
  );

  const [paymentForm, setPaymentForm] = useState({
    employeeId: "",
    type: "salary" as PaymentType,
    amountCents: 0,
    description: "",
    scheduledDate: "",
  });

  if (!payments || !employees) {
    return (
      <div className="p-4 lg:p-6">
        <Skeleton className="h-96" />
      </div>
    );
  }

  const employeeMap = new Map(employees.map((e) => [e._id, e]));

  // Summary calculations
  const settledTotal = payments
    .filter((p) => p.status === "settled")
    .reduce((s, p) => s + p.amountCents, 0);
  const pendingTotal = payments
    .filter((p) => ["draft", "approved", "queued"].includes(p.status))
    .reduce((s, p) => s + p.amountCents, 0);
  const failedCount = payments.filter((p) => p.status === "failed").length;

  // Status groups
  const statusGroups: Record<string, Payment[]> = {
    all: payments as Payment[],
    draft: payments.filter((p) => p.status === "draft") as Payment[],
    approved: payments.filter((p) => p.status === "approved") as Payment[],
    queued: payments.filter((p) => p.status === "queued") as Payment[],
    settled: payments.filter((p) => p.status === "settled") as Payment[],
    failed: payments.filter((p) => p.status === "failed") as Payment[],
  };

  const handleCreatePayment = async () => {
    if (!companyId || !paymentForm.employeeId || !paymentForm.amountCents) return;
    try {
      await createPayment({
        companyId,
        employeeId: paymentForm.employeeId as Id<"employees">,
        type: paymentForm.type,
        amountCents: paymentForm.amountCents,
        currency: "USD",
        description: paymentForm.description || undefined,
        scheduledDate: paymentForm.scheduledDate
          ? new Date(paymentForm.scheduledDate).getTime()
          : undefined,
      });
      toast.success("Payment created as draft");
      setShowCreate(false);
      setPaymentForm({
        employeeId: "",
        type: "salary",
        amountCents: 0,
        description: "",
        scheduledDate: "",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create payment");
    }
  };

  const handleTransition = async (
    id: Id<"employeePayments">,
    status: PaymentStatus
  ) => {
    try {
      await updateStatus({
        id,
        status,
        ...(status === "settled" ? { settledAt: Date.now() } : {}),
      });
      toast.success(
        status === "settled"
          ? "Payment settled — treasury debited"
          : `Payment moved to ${status}`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update status");
    }
  };

  const handleRemove = async (id: Id<"employeePayments">) => {
    try {
      await removePayment({ id });
      toast.success("Payment removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove payment");
    }
  };

  const handleBatchApprove = async () => {
    const ids = Array.from(selectedDrafts);
    try {
      await Promise.all(ids.map((id) => updateStatus({ id, status: "approved" })));
      toast.success(`${ids.length} payment${ids.length !== 1 ? "s" : ""} approved`);
      setSelectedDrafts(new Set());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to batch approve");
    }
  };

  const toggleDraftSelection = (id: Id<"employeePayments">) => {
    setSelectedDrafts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAllDrafts = (drafts: Payment[]) => {
    setSelectedDrafts((prev) => {
      const allSelected = drafts.every((d) => prev.has(d._id));
      if (allSelected) {
        return new Set();
      }
      return new Set(drafts.map((d) => d._id));
    });
  };

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      {/* ─── Payment Summary ─── */}
      <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total paid out</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatCents(settledTotal)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {payments.filter((p) => p.status === "settled").length} payment
              {payments.filter((p) => p.status === "settled").length !== 1
                ? "s"
                : ""}{" "}
              settled
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatCents(pendingTotal)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Draft, approved, or queued for settlement
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Failed</CardDescription>
            <CardTitle className="text-2xl tabular-nums text-destructive">
              {failedCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {failedCount === 0
                ? "No failed payments"
                : "Needs retry or removal"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Payments Table ─── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Outbound Payments</CardTitle>
              <CardDescription>
                Salaries, freelance payouts, bonuses, reimbursements, and credits
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              New payment
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">
                All ({statusGroups.all.length})
              </TabsTrigger>
              <TabsTrigger value="draft">
                Draft ({statusGroups.draft.length})
              </TabsTrigger>
              <TabsTrigger value="approved">
                Approved ({statusGroups.approved.length})
              </TabsTrigger>
              <TabsTrigger value="queued">
                Queued ({statusGroups.queued.length})
              </TabsTrigger>
              <TabsTrigger value="settled">
                Settled ({statusGroups.settled.length})
              </TabsTrigger>
              <TabsTrigger value="failed">
                Failed ({statusGroups.failed.length})
              </TabsTrigger>
            </TabsList>

            {(
              ["all", "draft", "approved", "queued", "settled", "failed"] as const
            ).map((tab) => (
              <TabsContent key={tab} value={tab}>
                <PaymentsTable
                  payments={statusGroups[tab]}
                  employeeMap={employeeMap}
                  selectedDrafts={selectedDrafts}
                  onToggleSelect={toggleDraftSelection}
                  onToggleAllDrafts={toggleAllDrafts}
                  onBatchApprove={handleBatchApprove}
                  onTransition={handleTransition}
                  onRemove={handleRemove}
                />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* ─── Create Payment Dialog ─── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
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
                      {emp.displayName}
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
                      type: v as PaymentType,
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
            <div className="grid gap-2">
              <Label htmlFor="scheduledDate">Scheduled date (optional)</Label>
              <Input
                id="scheduledDate"
                type="date"
                value={paymentForm.scheduledDate}
                onChange={(e) =>
                  setPaymentForm({
                    ...paymentForm,
                    scheduledDate: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreatePayment()}>
              Create payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PaymentsTable({
  payments,
  employeeMap,
  selectedDrafts,
  onToggleSelect,
  onToggleAllDrafts,
  onBatchApprove,
  onTransition,
  onRemove,
}: {
  payments: Payment[];
  employeeMap: Map<string, { displayName: string }>;
  selectedDrafts: Set<Id<"employeePayments">>;
  onToggleSelect: (id: Id<"employeePayments">) => void;
  onToggleAllDrafts: (drafts: Payment[]) => void;
  onBatchApprove: () => void;
  onTransition: (id: Id<"employeePayments">, status: PaymentStatus) => void;
  onRemove: (id: Id<"employeePayments">) => void;
}) {
  if (payments.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No payments in this category
      </p>
    );
  }

  const drafts = payments.filter((p) => p.status === "draft");
  const hasDrafts = drafts.length > 0;
  const allDraftsSelected =
    hasDrafts && drafts.every((d) => selectedDrafts.has(d._id));
  const someDraftsSelected =
    hasDrafts && drafts.some((d) => selectedDrafts.has(d._id));

  return (
    <div className="flex flex-col gap-2">
      {someDraftsSelected && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
          <span className="text-sm text-muted-foreground">
            {selectedDrafts.size} selected
          </span>
          <Button size="sm" onClick={() => void onBatchApprove()}>
            Approve selected
          </Button>
        </div>
      )}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {hasDrafts && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allDraftsSelected}
                    onCheckedChange={() => onToggleAllDrafts(drafts)}
                  />
                </TableHead>
              )}
              <TableHead>Employee</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Date</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p._id}>
                {hasDrafts && (
                  <TableCell>
                    {p.status === "draft" ? (
                      <Checkbox
                        checked={selectedDrafts.has(p._id)}
                        onCheckedChange={() => onToggleSelect(p._id)}
                      />
                    ) : null}
                  </TableCell>
                )}
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
                  <StatusBadge status={p.status} />
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
                  <div className="flex gap-1">
                    {p.status === "draft" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void onTransition(p._id, "approved")}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void onRemove(p._id)}
                        >
                          Remove
                        </Button>
                      </>
                    )}
                    {p.status === "approved" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void onTransition(p._id, "queued")}
                        >
                          Queue
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void onTransition(p._id, "draft")}
                        >
                          Revert
                        </Button>
                      </>
                    )}
                    {p.status === "queued" && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => void onTransition(p._id, "settled")}
                      >
                        Mark settled
                      </Button>
                    )}
                    {p.status === "failed" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void onTransition(p._id, "draft")}
                        >
                          Retry
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void onRemove(p._id)}
                        >
                          Remove
                        </Button>
                      </>
                    )}
                    {p.status === "settled" && p.txExplorerUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                      >
                        <a
                          href={p.txExplorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View tx
                        </a>
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: PaymentStatus }) {
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

export default function EmployeePaymentsPage() {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <>
      <PageHeader
        title="Employee Payments"
        description="Outbound settlement desk for payroll, freelance payouts, and reimbursements"
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <CompanyGuard>
            <EmployeePaymentsContent
              showCreate={showCreate}
              setShowCreate={setShowCreate}
            />
          </CompanyGuard>
        </div>
      </div>
    </>
  );
}
