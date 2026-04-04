"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCompany } from "@/hooks/use-company";
import { formatCents, formatDateShort } from "@/lib/format";
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
import { Skeleton } from "@/components/ui/skeleton";

function EmployeesContent({ showCreate, setShowCreate }: { showCreate: boolean; setShowCreate: (v: boolean) => void }) {
  const router = useRouter();
  const { companyId } = useCompany();
  const employees = useQuery(
    api.employees.listByCompany,
    companyId ? { companyId } : "skip"
  );
  const createEmployee = useMutation(api.employees.create);
  const removeEmployee = useMutation(api.employees.remove);
  const updateEmployee = useMutation(api.employees.update);

  const [deleteTarget, setDeleteTarget] = useState<{ id: Id<"employees">; name: string } | null>(null);

  const [formData, setFormData] = useState({
    displayName: "",
    role: "",
    employmentType: "full-time" as const,
    compensationModel: "salary" as const,
    payoutAsset: "USDC",
    payoutAmountCents: 0,
    payoutFrequency: "monthly" as const,
    email: "",
  });

  if (!employees) {
    return (
      <div className="p-4 lg:p-6">
        <Skeleton className="h-96" />
      </div>
    );
  }

  const handleCreate = async () => {
    if (!companyId || !formData.displayName || !formData.role) return;
    const newId = await createEmployee({
      companyId,
      displayName: formData.displayName,
      role: formData.role,
      employmentType: formData.employmentType,
      walletVerified: false,
      privacyLevel: "pseudonymous",
      status: "onboarding",
      email: formData.email || undefined,
    });
    setShowCreate(false);
    setFormData({
      displayName: "",
      role: "",
      employmentType: "full-time",
      compensationModel: "salary",
      payoutAsset: "USDC",
      payoutAmountCents: 0,
      payoutFrequency: "monthly",
      email: "",
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
      toast.success("Advance requests disabled for this employee");
    } else {
      const cleaned = (currentNotes ?? "").replace("[no-advance]", "");
      await updateEmployee({ id, notes: cleaned || undefined });
      toast.success("Advance requests enabled for this employee");
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Employees</CardTitle>
          <CardDescription>
            {employees.length} employee{employees.length !== 1 ? "s" : ""} in
            this workspace
          </CardDescription>
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
                    <TableHead>Advance</TableHead>
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
                        {formatCents(emp.payoutAmountCents)}/{emp.payoutFrequency}
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

      {/* Create dialog */}
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
                <Label htmlFor="wallet">Wallet address (optional)</Label>
                <Input
                  id="wallet"
                  placeholder="0x..."
                  value={formData.walletAddress}
                  onChange={(e) =>
                    setFormData({ ...formData, walletAddress: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground rounded-md bg-muted px-3 py-2">
            Salary and compensation details are configured on the employee
            profile page. You will be redirected there after creating.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreate()}>Add employee</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
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

export default function EmployeesPage() {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <>
      <PageHeader
        title="Employees"
        description="Manage team members and outbound payment counterparts"
        action={{ label: "Add employee", onClick: () => setShowCreate(true) }}
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <CompanyGuard>
            <EmployeesContent showCreate={showCreate} setShowCreate={setShowCreate} />
          </CompanyGuard>
        </div>
      </div>
    </>
  );
}
