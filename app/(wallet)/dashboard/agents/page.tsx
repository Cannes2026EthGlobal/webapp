"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCompany } from "@/hooks/use-company";
import { formatCents, formatDate, formatRelativeDate } from "@/lib/format";
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
import { Skeleton } from "@/components/ui/skeleton";

function AgentsContent() {
  const { companyId } = useCompany();

  const apiKeys = useQuery(
    api.agentBilling.listApiKeys,
    companyId ? { companyId } : "skip"
  );
  const sessions = useQuery(
    api.agentBilling.listSessions,
    companyId ? { companyId } : "skip"
  );
  const settlements = useQuery(
    api.agentSettlement.listByCompany,
    companyId ? { companyId } : "skip"
  );
  const customers = useQuery(
    api.customers.listByCompany,
    companyId ? { companyId } : "skip"
  );

  const generateApiKey = useMutation(api.agentBilling.generateApiKey);
  const revokeApiKey = useMutation(api.agentBilling.revokeApiKey);

  const [showGenerateKey, setShowGenerateKey] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [keyForm, setKeyForm] = useState({
    customerId: "",
    label: "",
    rateLimit: "",
  });

  if (!apiKeys || !sessions || !settlements) {
    return (
      <div className="p-4 lg:p-6">
        <Skeleton className="h-96" />
      </div>
    );
  }

  const customerMap = new Map(
    (customers ?? []).map((c) => [c._id, c.displayName])
  );

  const activeSessionCount = sessions.filter(
    (s: { status: string }) => s.status === "active"
  ).length;
  const totalRevenueCents = sessions.reduce(
    (sum: number, s: { totalMicroCents?: number }) =>
      sum + Math.round((s.totalMicroCents ?? 0) / 10000),
    0
  );
  const activeKeyCount = apiKeys.filter(
    (k: { isActive: boolean }) => k.isActive
  ).length;

  const handleGenerateKey = async () => {
    if (!companyId || !keyForm.customerId || !keyForm.label) return;
    try {
      const key = await generateApiKey({
        companyId,
        customerId: keyForm.customerId as Id<"customers">,
        label: keyForm.label,
        rateLimit: keyForm.rateLimit ? parseInt(keyForm.rateLimit, 10) : undefined,
      });
      setGeneratedKey(key);
      setKeyForm({ customerId: "", label: "", rateLimit: "" });
      toast.success("API key generated");
    } catch (error) {
      toast.error("Failed to generate API key");
    }
  };

  const handleRevokeKey = async (id: Id<"agentApiKeys">) => {
    try {
      await revokeApiKey({ id });
      toast.success("API key revoked");
    } catch (error) {
      toast.error("Failed to revoke API key");
    }
  };

  const handleCopyKey = (key: string) => {
    void navigator.clipboard.writeText(key);
    toast.success("Copied to clipboard");
  };

  const closeGenerateDialog = () => {
    setShowGenerateKey(false);
    setGeneratedKey(null);
    setKeyForm({ customerId: "", label: "", rateLimit: "" });
  };

  const truncateId = (id: string) =>
    id.length > 12 ? `${id.slice(0, 6)}...${id.slice(-4)}` : id;

  const formatDuration = (startMs: number, endMs?: number) => {
    const end = endMs ?? Date.now();
    const diffSec = Math.floor((end - startMs) / 1000);
    if (diffSec < 60) return `${diffSec}s`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ${diffSec % 60}s`;
    return `${Math.floor(diffSec / 3600)}h ${Math.floor((diffSec % 3600) / 60)}m`;
  };

  const sessionStatusVariant = (status: string) => {
    switch (status) {
      case "active":
        return "default" as const;
      case "completed":
        return "secondary" as const;
      case "billed":
        return "outline" as const;
      case "settled":
        return "default" as const;
      default:
        return "secondary" as const;
    }
  };

  const settlementStatusVariant = (status: string) => {
    switch (status) {
      case "initiated":
        return "outline" as const;
      case "confirmed":
        return "default" as const;
      case "disputed":
        return "destructive" as const;
      case "resolved":
        return "secondary" as const;
      default:
        return "secondary" as const;
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      {/* ─── Summary Cards ─── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active sessions</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {activeSessionCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total agent revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {formatCents(totalRevenueCents)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>API keys</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {activeKeyCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Settlements</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {settlements.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ─── API Keys ─── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>
                Manage API keys for agent access
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowGenerateKey(true)}>
              Generate key
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {apiKeys.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No API keys yet. Generate your first key.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Label</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Rate limit</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last used</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiKeys.map((key: {
                    _id: Id<"agentApiKeys">;
                    label: string;
                    customerId: string;
                    apiKey: string;
                    rateLimit?: number;
                    isActive: boolean;
                    lastUsedAt?: number;
                  }) => (
                    <TableRow key={key._id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{key.label}</div>
                          <div className="font-mono text-xs text-muted-foreground">
                            {key.apiKey}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {customerMap.get(key.customerId) ?? truncateId(key.customerId)}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {key.rateLimit ? `${key.rateLimit}/min` : "Unlimited"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={key.isActive ? "default" : "secondary"}>
                          {key.isActive ? "Active" : "Revoked"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {key.lastUsedAt
                          ? formatRelativeDate(key.lastUsedAt)
                          : "Never"}
                      </TableCell>
                      <TableCell>
                        {key.isActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleRevokeKey(key._id)}
                          >
                            Revoke
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Agent Sessions ─── */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Sessions</CardTitle>
          <CardDescription>
            Active and recent agent billing sessions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No agent sessions yet
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Session</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Units</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session: {
                    _id: string;
                    customerId?: string;
                    productName?: string;
                    status: string;
                    totalUnits?: number;
                    totalMicroCents?: number;
                    _creationTime: number;
                    endedAt?: number;
                  }) => (
                    <TableRow key={session._id}>
                      <TableCell className="font-mono text-xs">
                        {truncateId(session._id)}
                      </TableCell>
                      <TableCell>
                        {session.customerId
                          ? customerMap.get(session.customerId) ??
                            truncateId(session.customerId)
                          : "-"}
                      </TableCell>
                      <TableCell>{session.productName ?? "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {session.status === "active" && (
                            <span className="relative flex h-2 w-2">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                            </span>
                          )}
                          <Badge
                            variant={sessionStatusVariant(session.status)}
                            className="capitalize"
                          >
                            {session.status}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {session.totalUnits ?? 0}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatCents(
                          Math.round((session.totalMicroCents ?? 0) / 10000)
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatRelativeDate(session._creationTime)}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {formatDuration(session._creationTime, session.endedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Agent-to-Agent Settlements ─── */}
      <Card>
        <CardHeader>
          <CardTitle>Agent-to-Agent Settlements</CardTitle>
          <CardDescription>
            Cross-agent payment settlements and disputes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {settlements.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No agent settlements yet
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>From / To</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {settlements.map((settlement: {
                    _id: string;
                    fromName?: string;
                    fromId?: string;
                    toName?: string;
                    toId?: string;
                    amountCents?: number;
                    status: string;
                    reason?: string;
                    _creationTime: number;
                  }) => (
                    <TableRow key={settlement._id}>
                      <TableCell>
                        <div className="text-sm">
                          <span className="font-medium">
                            {settlement.fromName ?? truncateId(settlement.fromId ?? "")}
                          </span>
                          <span className="mx-1 text-muted-foreground">&rarr;</span>
                          <span className="font-medium">
                            {settlement.toName ?? truncateId(settlement.toId ?? "")}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatCents(settlement.amountCents ?? 0)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={settlementStatusVariant(settlement.status)}
                          className="capitalize"
                        >
                          {settlement.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-48 truncate text-muted-foreground">
                        {settlement.reason ?? "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(settlement._creationTime)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Generate API Key Dialog ─── */}
      <Dialog open={showGenerateKey} onOpenChange={(open) => {
        if (!open) closeGenerateDialog();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {generatedKey ? "API Key Generated" : "Generate API Key"}
            </DialogTitle>
            <DialogDescription>
              {generatedKey
                ? "Copy your API key now. This key will only be shown once."
                : "Create a new API key for agent access."}
            </DialogDescription>
          </DialogHeader>

          {generatedKey ? (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-2 rounded-lg bg-muted p-3">
                <code className="flex-1 break-all text-sm font-mono">
                  {generatedKey}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyKey(generatedKey)}
                >
                  Copy
                </Button>
              </div>
              <p className="text-sm text-destructive font-medium">
                This key will only be shown once. Store it securely.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="customer">Customer</Label>
                <Select
                  value={keyForm.customerId}
                  onValueChange={(v) =>
                    setKeyForm({ ...keyForm, customerId: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {(customers ?? []).map((c) => (
                      <SelectItem key={c._id} value={c._id}>
                        {c.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="label">Label</Label>
                <Input
                  id="label"
                  placeholder="e.g., Production agent key"
                  value={keyForm.label}
                  onChange={(e) =>
                    setKeyForm({ ...keyForm, label: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="rateLimit">
                  Rate limit (requests/min, optional)
                </Label>
                <Input
                  id="rateLimit"
                  type="number"
                  placeholder="e.g., 100"
                  value={keyForm.rateLimit}
                  onChange={(e) =>
                    setKeyForm({ ...keyForm, rateLimit: e.target.value })
                  }
                />
              </div>
            </div>
          )}

          <DialogFooter>
            {generatedKey ? (
              <Button onClick={closeGenerateDialog}>Done</Button>
            ) : (
              <>
                <Button variant="outline" onClick={closeGenerateDialog}>
                  Cancel
                </Button>
                <Button onClick={() => void handleGenerateKey()}>
                  Generate key
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AgentsPage() {
  return (
    <>
      <PageHeader
        title="Agents"
        description="API keys, billing sessions, and agent-to-agent settlements"
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <CompanyGuard>
            <AgentsContent />
          </CompanyGuard>
        </div>
      </div>
    </>
  );
}
