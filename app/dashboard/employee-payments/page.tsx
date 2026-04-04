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

function EmployeePaymentsContent({ showCreate, setShowCreate }: { showCreate: boolean; setShowCreate: (v: boolean) => void }) {
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
  const [formData, setFormData] = useState({
    employeeId: "",
    type: "salary" as const,
    amountCents: 0,
    description: "",
  });

  if (!payments || !employees) {
    return (
      <div className="p-4 lg:p-6">
        <Skeleton className="h-96" />
      </div>
    );
  }

  const employeeMap = new Map(employees.map((e) => [e._id, e]));

  const handleCreate = async () => {
    if (!companyId || !formData.employeeId || !formData.amountCents) return;
    await createPayment({
      companyId,
      employeeId: formData.employeeId as Id<"employees">,
      type: formData.type,
      amountCents: formData.amountCents,
      currency: "USD",
      description: formData.description || undefined,
    });
    setShowCreate(false);
    setFormData({
      employeeId: "",
      type: "salary",
      amountCents: 0,
      description: "",
    });
  };

  const statusGroups = {
    all: payments,
    draft: payments.filter((p) => p.status === "draft"),
    approved: payments.filter((p) => p.status === "approved"),
    queued: payments.filter((p) => p.status === "queued"),
    settled: payments.filter((p) => p.status === "settled"),
    failed: payments.filter((p) => p.status === "failed"),
  };

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-3">
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

      <Card>
        <CardHeader>
          <CardTitle>Payment runs</CardTitle>
          <CardDescription>
            Outbound settlement desk for payroll, freelance, bonuses, and
            advances
          </CardDescription>
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
                      await updateStatus({
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
                value={formData.employeeId}
                onValueChange={(v) =>
                  setFormData({ ...formData, employeeId: v })
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
                  value={formData.type}
                  onValueChange={(v) =>
                    setFormData({
                      ...formData,
                      type: v as typeof formData.type,
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
                    <SelectItem value="advance">Advance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="amount">Amount (USD)</Label>
                <Input
                  id="amount"
                  type="number"
                  value={formData.amountCents / 100 || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      amountCents: Math.round(
                        parseFloat(e.target.value || "0") * 100
                      ),
                    })
                  }
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreate()}>Create payment</Button>
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

export default function EmployeePaymentsPage() {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <>
      <PageHeader
        title="Employee Payments"
        description="Outbound settlement desk for payroll and freelance payouts"
        action={{
          label: "New payment",
          onClick: () => setShowCreate(true),
        }}
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <CompanyGuard>
            <EmployeePaymentsContent showCreate={showCreate} setShowCreate={setShowCreate} />
          </CompanyGuard>
        </div>
      </div>
    </>
  );
}
