"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCompany } from "@/hooks/use-company";
import { formatCents, formatDate, formatDateShort } from "@/lib/format";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

import { PayrollContent } from "@/app/(wallet)/dashboard/payroll/page";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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

function EmployeesContent({
  showCreate,
  setShowCreate,
  showCreatePayment,
  setShowCreatePayment,
}: {
  showCreate: boolean;
  setShowCreate: (v: boolean) => void;
  showCreatePayment: boolean;
  setShowCreatePayment: (v: boolean) => void;
}) {
  const router = useRouter();
  const { companyId } = useCompany();
  const employees = useQuery(
    api.employees.listByCompany,
    companyId ? { companyId } : "skip"
  );
  const payments = useQuery(
    api.employeePayments.listByCompany,
    companyId ? { companyId } : "skip"
  );
  const createEmployee = useMutation(api.employees.create);
  const removeEmployee = useMutation(api.employees.remove);
  const updateEmployee = useMutation(api.employees.update);
  const createPayment = useMutation(api.employeePayments.create);
  const updatePaymentStatus = useMutation(api.employeePayments.updateStatus);
  const removePayment = useMutation(api.employeePayments.remove);

  const [deleteTarget, setDeleteTarget] = useState<{ id: Id<"employees">; name: string } | null>(null);

  const [formData, setFormData] = useState({
    displayName: "",
    role: "",
    employmentType: "full-time" as const,
    email: "",
    walletAddress: "",
    compensationModel: "salary" as "salary" | "hourly" | "per-task" | "milestone",
    payoutAmountCents: 0,
    payoutFrequency: "monthly" as "monthly" | "biweekly" | "weekly" | "per-task",
    payoutAsset: "USDC",
  });

  const [paymentForm, setPaymentForm] = useState({
    employeeId: "",
    type: "salary" as const,
    amountCents: 0,
    currency: "USD" as "USD" | "EUR",
    description: "",
  });

  if (!employees || !payments) {
    return (
      <div className="p-4 lg:p-6">
        <Skeleton className="h-96" />
      </div>
    );
  }

  const employeeMap = new Map(employees.map((e) => [e._id, e]));

  const handleCreate = async () => {
    if (!companyId || !formData.displayName || !formData.role || !formData.walletAddress) return;
    await createEmployee({
      companyId,
      displayName: formData.displayName,
      role: formData.role,
      employmentType: formData.employmentType,
      walletVerified: !!formData.walletAddress,
      privacyLevel: "pseudonymous",
      status: "active",
      email: formData.email || undefined,
      walletAddress: formData.walletAddress,
      compensationModel: formData.compensationModel,
      payoutAmountCents: formData.payoutAmountCents,
      payoutFrequency: formData.payoutFrequency,
      payoutAsset: formData.payoutAsset,
    });
    setShowCreate(false);
    setFormData({
      displayName: "",
      role: "",
      employmentType: "full-time",
      email: "",
      walletAddress: "",
      compensationModel: "salary",
      payoutAmountCents: 0,
      payoutFrequency: "monthly",
      payoutAsset: "USDC",
    });
    toast.success("Employee added");
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await removeEmployee({ id: deleteTarget.id });
    toast.success(`${deleteTarget.name} removed`);
    setDeleteTarget(null);
  };

  // Advance toggle uses the notes field: "[no-advance]" prefix means disabled
  const isAdvanceEnabled = (notes?: string) => !notes?.startsWith("[no-advance]");
  const toggleAdvance = async (id: Id<"employees">, currentNotes?: string) => {
    if (isAdvanceEnabled(currentNotes)) {
      await updateEmployee({ id, notes: `[no-advance]${currentNotes ?? ""}` });
      toast.success("Salary in advance disabled for this employee");
    } else {
      const cleaned = (currentNotes ?? "").replace("[no-advance]", "").trim();
      await updateEmployee({ id, notes: cleaned || "" });
      toast.success("Salary in advance enabled for this employee");
    }
  };

  const handleCreatePayment = async () => {
    if (!companyId || !paymentForm.employeeId || !paymentForm.amountCents) return;
    await createPayment({
      companyId,
      employeeId: paymentForm.employeeId as Id<"employees">,
      type: paymentForm.type,
      amountCents: paymentForm.amountCents,
      currency: paymentForm.currency,
      description: paymentForm.description || undefined,
    });
    setShowCreatePayment(false);
    setPaymentForm({
      employeeId: "",
      type: "salary",
      amountCents: 0,
      currency: "USD",
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
      {/* ─── Payment Summary ─── */}
      <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Draft</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatCents(statusGroups.draft.filter((p) => (p.currency ?? "USD") === "USD").reduce((s, p) => s + p.amountCents, 0), "USD")}
              {statusGroups.draft.some((p) => p.currency === "EUR") && (
                <span className="text-lg ml-2">{formatCents(statusGroups.draft.filter((p) => p.currency === "EUR").reduce((s, p) => s + p.amountCents, 0), "EUR")}</span>
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
              {(() => {
                const aq = [...statusGroups.approved, ...statusGroups.queued];
                const usd = aq.filter((p) => (p.currency ?? "USD") === "USD").reduce((s, p) => s + p.amountCents, 0);
                const eur = aq.filter((p) => p.currency === "EUR").reduce((s, p) => s + p.amountCents, 0);
                return <>{formatCents(usd, "USD")}{eur > 0 && <span className="text-lg ml-2">{formatCents(eur, "EUR")}</span>}</>;
              })()}
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
              {formatCents(statusGroups.settled.filter((p) => (p.currency ?? "USD") === "USD").reduce((s, p) => s + p.amountCents, 0), "USD")}
              {statusGroups.settled.some((p) => p.currency === "EUR") && (
                <span className="text-lg ml-2">{formatCents(statusGroups.settled.filter((p) => p.currency === "EUR").reduce((s, p) => s + p.amountCents, 0), "EUR")}</span>
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

      {/* ─── Employee Roster ─── */}
      <Card data-tour="employee-roster">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Roster</CardTitle>
              <CardDescription>
                {employees.length} employee{employees.length !== 1 ? "s" : ""} in
                this workspace
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              Add employee
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {employees.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No employees yet. Add your first team member.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Payout</TableHead>
                    <TableHead>Next payment</TableHead>
                    <TableHead>Salary in Advance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((emp) => (
                    <TableRow
                      key={emp._id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/dashboard/employees/${emp._id}`)}
                    >
                      <TableCell className="font-medium">
                        {emp.displayName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{emp.role}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {emp.employmentType}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatCents(emp.totalCompensationCents || emp.payoutAmountCents || 0, emp.payoutAsset === "EURC" ? "EUR" : "USD")}/{emp.payoutFrequency ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {emp.nextPaymentDate
                          ? formatDateShort(emp.nextPaymentDate)
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={isAdvanceEnabled(emp.notes)}
                          onCheckedChange={() => toggleAdvance(emp._id, emp.notes)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={emp.status} />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget({ id: emp._id, name: emp.displayName });
                          }}
                        >
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Payment Runs ─── */}
      <Card data-tour="payment-runs">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Payment runs</CardTitle>
              <CardDescription>
                Outbound settlement desk for payroll, freelance, bonuses, and
                advances
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

      {/* ─── Create Employee Dialog ─── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add employee</DialogTitle>
            <DialogDescription>
              Add a new team member to this workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                value={formData.displayName}
                onChange={(e) =>
                  setFormData({ ...formData, displayName: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <Input
                id="role"
                value={formData.role}
                onChange={(e) =>
                  setFormData({ ...formData, role: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Employment type</Label>
              <Select
                value={formData.employmentType}
                onValueChange={(v) =>
                  setFormData({
                    ...formData,
                    employmentType: v as typeof formData.employmentType,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full-time">Full-time</SelectItem>
                  <SelectItem value="part-time">Part-time</SelectItem>
                  <SelectItem value="contractor">Contractor</SelectItem>
                  <SelectItem value="freelance">Freelance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email (optional)</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="walletAddress">Wallet address</Label>
                <Input
                  id="walletAddress"
                  placeholder="0x..."
                  value={formData.walletAddress}
                  onChange={(e) =>
                    setFormData({ ...formData, walletAddress: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Compensation model</Label>
                <Select
                  value={formData.compensationModel}
                  onValueChange={(v) =>
                    setFormData({
                      ...formData,
                      compensationModel: v as typeof formData.compensationModel,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="salary">Salary</SelectItem>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="per-task">Per task</SelectItem>
                    <SelectItem value="milestone">Milestone</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Payout frequency</Label>
                <Select
                  value={formData.payoutFrequency}
                  onValueChange={(v) =>
                    setFormData({
                      ...formData,
                      payoutFrequency: v as typeof formData.payoutFrequency,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="biweekly">Biweekly</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="per-task">Per task</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="payoutAmount">Payout amount ({formData.payoutAsset})</Label>
                <Input
                  id="payoutAmount"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="5000"
                  value={formData.payoutAmountCents ? formData.payoutAmountCents / 100 : ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      payoutAmountCents: Math.round(parseFloat(e.target.value || "0") * 100),
                    })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Payout asset</Label>
                <Select
                  value={formData.payoutAsset}
                  onValueChange={(v) =>
                    setFormData({ ...formData, payoutAsset: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USDC">USDC</SelectItem>
                    <SelectItem value="EURC">EURC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreate()}>Add employee</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <div className="grid grid-cols-3 gap-4">
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
                <Label htmlFor="paymentAmount">Amount ({paymentForm.currency === "EUR" ? "EURC" : "USDC"})</Label>
                <Input
                  id="paymentAmount"
                  type="number"
                  step="any"
                  min="0"
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
              <div className="grid gap-2">
                <Label>Currency</Label>
                <Select
                  value={paymentForm.currency}
                  onValueChange={(v) =>
                    setPaymentForm({
                      ...paymentForm,
                      currency: v as "USD" | "EUR",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USDC</SelectItem>
                    <SelectItem value="EUR">EURC</SelectItem>
                  </SelectContent>
                </Select>
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

      {/* ─── Delete Confirmation ─── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove employee</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{deleteTarget?.name}</strong> from this workspace? This action cannot be undone. Any pending payments for this employee will need to be handled separately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDelete()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
    employeeId?: Id<"employees">;
    type: string;
    amountCents: number;
    currency?: "USD" | "EUR";
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
                {p.employeeId
                  ? (employeeMap.get(p.employeeId)?.displayName ?? "Unknown")
                  : p.description?.includes("with love from")
                    ? "Referral"
                    : "External"}
              </TableCell>
              <TableCell>
                {p.description?.includes("with love from") ? (
                  <Badge className="bg-purple-100 text-purple-700 border-purple-200">Referral</Badge>
                ) : (
                  <Badge variant="outline" className="capitalize">{p.type}</Badge>
                )}
              </TableCell>
              <TableCell className="tabular-nums">
                {formatCents(p.amountCents, p.currency ?? "USD")}
              </TableCell>
              <TableCell>
                <PaymentStatusBadge status={p.status} />
              </TableCell>
              <TableCell className="max-w-64 text-muted-foreground">
                {p.description?.includes("with love from") ? (
                  <span>
                    <span className="italic">{p.description.match(/with love from [^(]+/)?.[0]?.trim()}</span>
                    <span className="text-xs ml-1 opacity-70">{p.description.match(/\(.*\)/)?.[0]}</span>
                  </span>
                ) : (
                  <span className="truncate block max-w-48">{p.description ?? "-"}</span>
                )}
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

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "active"
      ? "default"
      : status === "inactive"
        ? "destructive"
        : "secondary";
  return (
    <Badge variant={variant} className="capitalize">
      {status}
    </Badge>
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

export default function EmployeesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [showCreatePayment, setShowCreatePayment] = useState(false);

  return (
    <>
      <PageHeader
        title="Employees"
        description="Team management, payroll, and salary advances"
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <CompanyGuard>
            <div className="px-4 pt-4 lg:px-6">
              <Tabs defaultValue="roster">
                <TabsList>
                  <TabsTrigger value="roster">Roster & Payments</TabsTrigger>
                  <TabsTrigger value="payroll">Payroll & Advances</TabsTrigger>
                </TabsList>
                <TabsContent value="roster">
                  <EmployeesContent
                    showCreate={showCreate}
                    setShowCreate={setShowCreate}
                    showCreatePayment={showCreatePayment}
                    setShowCreatePayment={setShowCreatePayment}
                  />
                </TabsContent>
                <TabsContent value="payroll">
                  <PayrollContent />
                </TabsContent>
              </Tabs>
            </div>
          </CompanyGuard>
        </div>
      </div>
    </>
  );
}
